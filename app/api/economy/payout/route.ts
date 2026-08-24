import { NextRequest, NextResponse } from "next/server"
import type { PoolClient } from "pg"
import pool from "@/lib/db"
import {
  calculatePayout,
  getTodaysBounties,
  computeBountyProgress,
  mergeBountyProgress,
  TODAY_DATE,
  economyWeekId,
  type GameResult,
} from "@/lib/economy"
import { calculateSessionNP, type SessionQuestionInput } from "@/lib/anti-farming"
import { ECONOMY_CONFIG, isEarningModeEnabled } from "@/lib/economy-config"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import {
  applyNPCredits,
  completionBonusAvailable,
  dailyRewardRemaining,
  recordDailyActivity,
  type NPCredit,
} from "@/lib/np-ledger"
import { recordWeeklyGoalActivity, weeklyGoalView, type WeeklyGoalProgress } from "@/lib/weekly-goals"
import { calculateDoubleBank, hasConsistentSoloCompletion } from "@/lib/solo-completion-validation"
import { getPersonalBestUpdate, personalBestValue, type SoloPersonalBestResult } from "@/lib/game-personal-best"
import { getActiveSeason } from "@/lib/economy-seasons"
import { countEconomyQueries, economyJson, economyMetrics } from "@/lib/economy-api"
import { applyXPCredits, sessionXPCredits } from "@/lib/xp-ledger"
import { XP_CONFIG } from "@/lib/xp-config"

type Key = {
  id: string
  discipline: string
  correctAnswer: string | string[] | null
}
type OrderedAnswer = {
  questionId: string
  answer: string | string[] | null
  firstAnswer?: string | string[] | null
  secondAnswer?: string | string[] | null
  assisted?: boolean
}

const SOLO_GAME_MODES = new Set<string>(ECONOMY_CONFIG.modeIds.soloGames)

function isCorrect(answer: unknown, expected: Key["correctAnswer"]) {
  if (Array.isArray(answer) && Array.isArray(expected)) {
    return answer.length === expected.length
      && [...answer].sort().every((value, index) => value === [...expected].sort()[index])
  }
  return answer === expected
}

function rapidBonus(streak: number) {
  if (streak >= 10) return 150
  if (streak >= 5) return 100
  if (streak >= 3) return 50
  return 0
}

function calculateServerScore(
  mode: string,
  attempts: Array<SessionQuestionInput & { currentStreak: number }>,
  bestStreak: number,
  wagerHistory?: unknown,
) {
  const correct = attempts.filter((attempt) => attempt.isCorrect).length
  if (mode === "rapid") {
    return attempts.reduce(
      (score, attempt) => score + (attempt.isCorrect ? 100 + rapidBonus(attempt.currentStreak) : 0),
      0,
    )
  }
  if (mode === "sudden" || mode === "timeatk") return correct * 100
  if (mode === "streak") return bestStreak * 50 + correct * 10
  if (mode === "double") return calculateDoubleBank(attempts, wagerHistory) ?? 0
  return attempts.length ? Math.round(correct * 100 / attempts.length) : 0
}

async function updatePersonalBest(
  userId: string,
  mode: string,
  score: number,
  client: PoolClient,
  seasonId: string,
) {
  if (!SOLO_GAME_MODES.has(mode) || score <= 0) return false
  const existing = await client.query(
    `SELECT best_score FROM mednexus_game_personal_bests
     WHERE season_id = $1 AND user_id = $2 AND mode = $3
     FOR UPDATE`,
    [seasonId, userId, mode],
  )
  const previous = Number(existing.rows[0]?.best_score ?? 0)
  const { isNewHigh } = getPersonalBestUpdate(previous, score)
  await client.query(
    `INSERT INTO mednexus_game_personal_bests
       (season_id, user_id, mode, best_score, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (season_id, user_id, mode) DO UPDATE
       SET best_score = GREATEST(mednexus_game_personal_bests.best_score, EXCLUDED.best_score),
           updated_at = CASE
             WHEN EXCLUDED.best_score > mednexus_game_personal_bests.best_score THEN NOW()
             ELSE mednexus_game_personal_bests.updated_at
           END`,
    [seasonId, userId, mode, score],
  )
  return isNewHigh
}

/** Credits a completed, server-recorded activity exactly once. */
export async function POST(req: NextRequest) {
  const metrics = economyMetrics()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 })

    const connectedClient = await pool.connect()
    const client = countEconomyQueries(connectedClient, metrics)
    try {
      await client.query("BEGIN")
      const activeSeason = await getActiveSeason(client, true)
      const { rows } = await client.query(
        `SELECT id,user_id,season_id,mode,question_ids,answered_ids,answer_key,
                accepted_answers,answer_order,result_meta,payout,status,started_at,submitted_at
         FROM mednexus_exam_sessions
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [sessionId, auth.uid],
      )
      const session = rows[0]
      if (!session) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      if (session.season_id && session.season_id !== activeSeason.id) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "This activity belongs to a closed economy season" }, { status: 409 })
      }
      const seasonId = session.season_id ?? activeSeason.id
      if (!session.season_id) {
        await client.query(
          "UPDATE mednexus_exam_sessions SET season_id = $2 WHERE id = $1 AND season_id IS NULL",
          [sessionId, seasonId],
        )
      }
      if (session.payout) {
        await client.query("COMMIT")
        return NextResponse.json(session.payout)
      }
      if (session.status !== "completed") {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Activity is not completed" }, { status: 409 })
      }
      const enabledMode = session.mode === "exam"
        ? isEarningModeEnabled("mcq_exam")
        : SOLO_GAME_MODES.has(session.mode)
          ? isEarningModeEnabled("mcq_solo_game")
          : (ECONOMY_CONFIG.modeIds.trialTutor as readonly string[]).includes(session.mode)
            && isEarningModeEnabled("mcq_trial_tutor")
      if (!enabledMode) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Rewards are disabled for this mode" }, { status: 422 })
      }

      const keys: Key[] = Array.isArray(session.answer_key) ? session.answer_key : []
      const keyById = new Map(keys.map((key) => [key.id, key]))
      const answerMap = (session.accepted_answers ?? {}) as Record<string, unknown>
      const storedOrder: OrderedAnswer[] = Array.isArray(session.answer_order)
        ? session.answer_order
        : []
      const orderedAnswers: OrderedAnswer[] = storedOrder.length
        ? storedOrder
        : keys
            .filter((key) => Object.prototype.hasOwnProperty.call(answerMap, key.id))
            .map((key) => ({ questionId: key.id, answer: answerMap[key.id] as OrderedAnswer["answer"] }))

      let currentStreak = 0
      let bestStreak = 0
      let survivedCount = 0
      let suddenAlive = true
      const sessionData: Array<SessionQuestionInput & { currentStreak: number }> = []
      const continuationData: Array<SessionQuestionInput & { currentStreak: number; assisted?: boolean }> = []
      let continuationStreak = 0
      let hasAssistedAttempt = false

      for (const attempt of orderedAnswers) {
        const key = keyById.get(attempt.questionId)
        if (!key) continue
        const assisted = attempt.assisted === true
        const firstAnswer = attempt.firstAnswer ?? attempt.answer
        const firstCorrect = isCorrect(firstAnswer, key.correctAnswer)
        const secondCorrect = assisted && isCorrect(attempt.secondAnswer, key.correctAnswer)
        // An assisted record is valid only for a wrong first attempt. Corrected
        // retries continue play, but deliberately remain incorrect for rewards.
        if (assisted && firstCorrect) continue
        hasAssistedAttempt ||= assisted
        const correct = firstCorrect
        const continuationCorrect = firstCorrect || secondCorrect
        currentStreak = correct ? currentStreak + 1 : 0
        continuationStreak = continuationCorrect ? continuationStreak + 1 : 0
        bestStreak = Math.max(bestStreak, currentStreak)
        if (suddenAlive && continuationCorrect) survivedCount++
        else if (!continuationCorrect) suddenAlive = false
        sessionData.push({
          questionId: key.id,
          discipline: key.discipline,
          isCorrect: correct,
          currentStreak,
        })
        continuationData.push({
          questionId: key.id,
          discipline: key.discipline,
          isCorrect: continuationCorrect,
          currentStreak: continuationStreak,
          assisted,
        })
      }

      const snapshotIds = keys.map((key) => key.id)
      const verifiedFreezeResult = session.mode === "timeatk"
        ? await client.query(
            `SELECT COUNT(*)::int AS count
             FROM mednexus_session_consumable_events
             WHERE user_id = $1 AND session_id = $2 AND item_id = 'lifeline_freeze'
               AND used_at BETWEEN $3 AND $4`,
            [auth.uid, sessionId, session.started_at, session.submitted_at],
          )
        : null
      const completionMetadataConsistent = SOLO_GAME_MODES.has(session.mode)
        ? hasConsistentSoloCompletion(session.mode, snapshotIds, continuationData, session.result_meta ?? {}, {
            startedAt: session.started_at,
            finishedAt: session.submitted_at,
            verifiedFreezeCount: Number(verifiedFreezeResult?.rows[0]?.count ?? 0),
          })
        : session.result_meta?.completionReason === "pool_completed"
          && sessionData.length === snapshotIds.length
          && sessionData.every((attempt, index) => attempt.questionId === snapshotIds[index])
          && session.result_meta?.selectedQuestionCount === snapshotIds.length
          && session.result_meta?.answeredQuestionCount === sessionData.length

      const total = sessionData.length
      const correctCount = sessionData.filter((question) => question.isCorrect).length
      const accuracy = total ? Math.round(correctCount * 100 / total) : 0
      const isSoloGame = SOLO_GAME_MODES.has(session.mode)
      const minimumAnswers = session.mode === "sudden"
        ? ECONOMY_CONFIG.gameRewards.solo.suddenDeathMinimumAnswers
        : ECONOMY_CONFIG.gameRewards.solo.minimumAnswers
      const meaningfulSoloCompletion = isSoloGame
        && completionMetadataConsistent
        && total >= minimumAnswers
        && keys.length > 0
        && sessionData.every((answer) => keyById.has(answer.questionId))
      const score = calculateServerScore(session.mode, sessionData, bestStreak, session.result_meta?.wagerHistory)
      const personalBestScore = isSoloGame
        ? personalBestValue({ mode: session.mode, score, bestStreak, survivedCount } as SoloPersonalBestResult)
        : score
      const isNewHigh = meaningfulSoloCompletion && !hasAssistedAttempt
        ? await updatePersonalBest(auth.uid, session.mode, personalBestScore, client, seasonId)
        : false
      const result: GameResult = {
        mode: session.mode,
        score,
        correct: correctCount,
        total,
        bestStreak,
        isNewHigh,
        survivedCount,
        accuracy,
        disciplines: [...new Set(sessionData.map(answer => answer.discipline).filter(Boolean))],
        lifelineUsed: session.result_meta?.lifelineUsed === true,
      }

      const anti = await calculateSessionNP(
        auth.uid,
        session.mode,
        completionMetadataConsistent ? sessionData : [],
        client,
        session.mode === "exam"
          ? {
              accuracy,
              correct: correctCount,
              total,
              primaryDiscipline: keys[0]?.discipline,
            }
          : undefined,
        sessionId,
        seasonId,
      )

      const gross = calculatePayout(result)
      const canAwardFirstCompletion = meaningfulSoloCompletion
        && await completionBonusAvailable(client, auth.uid, seasonId)
      const achievementBreakdown = isSoloGame && completionMetadataConsistent
        ? gross.breakdown.filter((item) => item.label !== "Valid Completion")
        : []
      const achievementNP = achievementBreakdown.reduce((sum, item) => sum + item.amount, 0)
      const credits: NPCredit[] = []
      if (session.mode === "trial" || session.mode === "tutor") {
        const categories = [
          ["trial_tutor_question", anti.rewardComponents.questions],
          ["trial_tutor_streak", anti.rewardComponents.streaks],
          ["trial_tutor_completion", anti.rewardComponents.completion],
        ] as const
        for (const [source, amount] of categories) {
          if (amount > 0) credits.push({ source, sourceId: sessionId, amount, metadata: { mode: session.mode, rewardCategory: source } })
        }
      } else if (anti.totalNP > 0) {
        credits.push({ source: session.mode === "exam" ? "exam_reward" : "question_reward", sourceId: sessionId, amount: anti.totalNP, metadata: { mode: session.mode } })
      }
      if (meaningfulSoloCompletion) {
        credits.push({
          source: "game_completion",
          sourceId: sessionId,
          amount: ECONOMY_CONFIG.gameRewards.solo.completion,
          metadata: { mode: session.mode, multiplayer: false, rewardCategory: "solo_completion" },
        })
      }
      if (canAwardFirstCompletion) credits.push({
        source: "game_achievement",
        sourceId: `${sessionId}:first-daily-completion`,
        amount: ECONOMY_CONFIG.gameRewards.solo.firstDailyCompletion,
        metadata: { mode: session.mode, economyDate: TODAY_DATE(), reward: "first_daily_completion" },
      })
      if (achievementNP > 0) {
        credits.push({
          source: "game_achievement",
          sourceId: sessionId,
          amount: achievementNP,
          metadata: { mode: session.mode, score, accuracy, bestStreak, rewardCategory: "solo_achievement" },
        })
      }

      let soloFamilySuppressed = 0
      if (isSoloGame) {
        let remaining = await dailyRewardRemaining(client, auth.uid, "solo", seasonId)
        for (const entry of credits) {
          const requestedAmount = entry.amount
          entry.amount = Math.min(requestedAmount, remaining)
          soloFamilySuppressed += requestedAmount - entry.amount
          remaining -= entry.amount
        }
      }
      const credit = await applyNPCredits(client, auth.uid, credits)
      await recordDailyActivity(client, auth.uid, total, correctCount)
      const weekly = completionMetadataConsistent
        ? await recordWeeklyGoalActivity(client, auth.uid, seasonId, {
            answered: total,
            correct: correctCount,
            qualifyingExam: session.mode === "exam" && total >= ECONOMY_CONFIG.examRewards.minimumAnswered,
            occurredAt: session.submitted_at ? new Date(session.submitted_at) : undefined,
          })
        : { newlyCompleted: [] as string[], credited: {
            credited: 0, suppressed: 0, newBalance: credit.newBalance,
            rankBreakdown: [] as Array<{ label: string; amount: number }>, dailyRepeatableCredited: 0,
          } }

      const bountyUpdates: Array<{
        id: string
        progress: number
        target: number
        claimed: boolean
        newlyComplete: boolean
        reward: number
      }> = []
      const bountyCredits: NPCredit[] = []
      for (const bounty of completionMetadataConsistent ? getTodaysBounties() : []) {
        const delta = computeBountyProgress(bounty, result)
        if (!delta) continue
        const old = await client.query(
          `SELECT progress, claimed FROM mednexus_bounty_progress
           WHERE season_id = $1 AND uid = $2 AND bounty_id = $3 AND bounty_date = $4
           FOR UPDATE`,
          [seasonId, auth.uid, bounty.id, TODAY_DATE()],
        )
        if (old.rows[0]?.claimed) continue
        const oldProgress = Number(old.rows[0]?.progress ?? 0)
        const progress = mergeBountyProgress(bounty, oldProgress, delta)
        const newlyComplete = progress === bounty.target && oldProgress < bounty.target
        await client.query(
          `INSERT INTO mednexus_bounty_progress
             (season_id, uid, bounty_id, bounty_date, progress, claimed)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (season_id, uid, bounty_id, bounty_date) DO UPDATE
             SET progress = EXCLUDED.progress, claimed = EXCLUDED.claimed`,
          [seasonId, auth.uid, bounty.id, TODAY_DATE(), progress, newlyComplete],
        )
        if (newlyComplete) bountyCredits.push({
          source: "bounty", sourceId: `${TODAY_DATE()}:${bounty.id}`, amount: bounty.reward,
          metadata: { bountyId: bounty.id, automatic: true },
        })
        bountyUpdates.push({
          id: bounty.id,
          progress,
          target: bounty.target,
          claimed: newlyComplete,
          newlyComplete,
          reward: newlyComplete ? bounty.reward : 0,
        })
      }
      const bountyCredit = await applyNPCredits(client, auth.uid, bountyCredits)

      const rewardMultipliers = sessionData.map((attempt, index) => {
        if (!attempt.isCorrect) return 1
        const awarded = anti.perQuestion[index]?.awardedNP ?? 0
        if (session.mode === "trial" || session.mode === "tutor") {
          const streakBonus = attempt.currentStreak >= 10 ? ECONOMY_CONFIG.questionRewards.trialTutor.streakThresholds[1].bonus
            : attempt.currentStreak >= 5 ? ECONOMY_CONFIG.questionRewards.trialTutor.streakThresholds[0].bonus : 0
          return awarded / (ECONOMY_CONFIG.questionRewards.trialTutor.correct + streakBonus)
        }
        if (isSoloGame) return awarded / ECONOMY_CONFIG.gameRewards.solo.correctAnswer
        return 1
      })
      const xpCredits = sessionXPCredits({
        userId: auth.uid, seasonId, sessionId, mode: session.mode, attempts: sessionData,
        rewardMultipliers, meaningfulCompletion: session.mode === "exam" ? total >= ECONOMY_CONFIG.examRewards.minimumAnswered : meaningfulSoloCompletion,
        firstDailyCompletion: canAwardFirstCompletion, accuracy, isNewHigh,
      })
      for (const bounty of bountyUpdates.filter(item => item.newlyComplete)) xpCredits.push({
        source: "bounty", sourceId: `${TODAY_DATE()}:${bounty.id}`, amount: XP_CONFIG.bounty[bounty.id] ?? 0,
        seasonId, metadata: { bountyId: bounty.id, label: `Bounty: ${bounty.id}` },
      })
      for (const goalId of weekly.newlyCompleted) xpCredits.push({
        source: "weekly_goal", sourceId: `${economyWeekId(session.submitted_at ? new Date(session.submitted_at) : undefined)}:${goalId}`, amount: XP_CONFIG.weeklyGoal[goalId] ?? 0,
        seasonId, metadata: { goalId, label: `Weekly goal: ${goalId}` },
      })
      const xp = await applyXPCredits(client, auth.uid, xpCredits)

      const breakdown = [
        ...anti.breakdown,
        ...(meaningfulSoloCompletion ? [{ label: "Valid Completion", amount: ECONOMY_CONFIG.gameRewards.solo.completion }] : []),
        ...(canAwardFirstCompletion ? [{ label: "First Solo Completion", amount: ECONOMY_CONFIG.gameRewards.solo.firstDailyCompletion }] : []),
        ...achievementBreakdown,
        ...bountyUpdates.filter(item => item.newlyComplete).map(item => ({ label: `Bounty: ${getTodaysBounties().find(b => b.id === item.id)?.label ?? item.id}`, amount: item.reward })),
        ...credit.rankBreakdown,
        ...weekly.newlyCompleted.map(id => ({ label: `Weekly goal: ${id}`, amount: ECONOMY_CONFIG.weeklyGoals.find(goal => goal.id === id)?.reward ?? 0 })),
        ...weekly.credited.rankBreakdown,
        ...bountyCredit.rankBreakdown,
      ]
      if (soloFamilySuppressed > 0) breakdown.push({ label: "Daily solo-game NP cap", amount: -soloFamilySuppressed })
      const suppressed = soloFamilySuppressed + credit.suppressed + bountyCredit.suppressed + weekly.credited.suppressed
      if (suppressed > 0) breakdown.push({ label: "Daily repeatable NP ceiling", amount: -suppressed })
      const [walletState, bountyState, weeklyState] = await Promise.all([
        client.query("SELECT balance,lifetime_earned,rank_points FROM mednexus_season_wallets WHERE user_id=$1 AND season_id=$2", [auth.uid, seasonId]),
        client.query("SELECT bounty_id,progress,claimed FROM mednexus_bounty_progress WHERE season_id=$1 AND uid=$2 AND bounty_date=$3", [seasonId, auth.uid, TODAY_DATE()]),
        client.query(`SELECT eligible_answered,eligible_correct,qualifying_exams,distinct_exam_dates,credited_goal_ids
          FROM mednexus_weekly_goal_progress WHERE season_id=$1 AND uid=$2 AND week_id=$3`, [seasonId, auth.uid, economyWeekId()]),
      ])
      const walletRow = walletState.rows[0]
      const bountyMap = Object.fromEntries(bountyState.rows.map(row => [row.bounty_id, row]))
      const weeklyRow = weeklyState.rows[0]
      const weeklyProgress: WeeklyGoalProgress = {
        weekId: economyWeekId(), eligibleAnswered: Number(weeklyRow?.eligible_answered ?? 0),
        eligibleCorrect: Number(weeklyRow?.eligible_correct ?? 0), qualifyingExams: Number(weeklyRow?.qualifying_exams ?? 0),
        distinctExamDates: weeklyRow?.distinct_exam_dates ?? [], creditedGoalIds: weeklyRow?.credited_goal_ids ?? [],
      }
      const payload = {
        earned: credit.credited + bountyCredit.credited + weekly.credited.credited,
        xpEarned: xp.credited,
        lifetimeXP: xp.lifetimeXP,
        xpBreakdown: xp.breakdown,
        newBalance: bountyCredit.credited > 0 ? bountyCredit.newBalance : weekly.credited.newBalance,
        breakdown,
        suppressed,
        dailyCeiling: credit.dailyCeiling,
        dailyRepeatableCredited: Math.max(credit.dailyRepeatableCredited, bountyCredit.dailyRepeatableCredited, weekly.credited.dailyRepeatableCredited),
        examRewardBreakdown: anti.examRewardBreakdown,
        bountyUpdates,
        score,
        correct: correctCount,
        total,
        isNewHigh,
        wallet: { balance: Number(walletRow?.balance ?? 0), lifetimeEarned: Number(walletRow?.lifetime_earned ?? 0), rankPoints: Number(walletRow?.rank_points ?? 0) },
        bounties: getTodaysBounties().map(item => ({ ...item, progress: Number(bountyMap[item.id]?.progress ?? 0), claimed: bountyMap[item.id]?.claimed ?? false })),
        weeklyGoals: weeklyGoalView(weeklyProgress),
      }
      await client.query(
        "UPDATE mednexus_exam_sessions SET payout = $3::jsonb WHERE id = $1 AND season_id = $2",
        [sessionId, seasonId, JSON.stringify(payload)],
      )
      await client.query("COMMIT")
      return economyJson("economy.payout", payload, metrics)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      connectedClient.release()
    }
  } catch (error) {
    console.error("economy payout", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
