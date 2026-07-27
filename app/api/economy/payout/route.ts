import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import {
  calculatePayout,
  getTodaysBounties,
  computeBountyProgress,
  TODAY_DATE,
  type GameResult,
} from "@/lib/economy"
import { calculateSessionNP, type SessionQuestionInput } from "@/lib/anti-farming"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import {
  applyNPCredits,
  completionBonusAvailable,
  recordDailyActivity,
  type NPCredit,
} from "@/lib/np-ledger"

type Key = {
  id: string
  discipline: string
  correctAnswer: string | string[] | null
}
type OrderedAnswer = {
  questionId: string
  answer: string | string[] | null
}

const SOLO_GAME_MODES = new Set(["rapid", "sudden", "timeatk", "double", "streak"])

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
  if (mode === "double") return correct * 100
  return attempts.length ? Math.round(correct * 100 / attempts.length) : 0
}

async function updatePersonalBest(
  userId: string,
  mode: string,
  score: number,
  client: Awaited<ReturnType<typeof pool.connect>>,
) {
  if (!SOLO_GAME_MODES.has(mode) || score <= 0) return false
  const existing = await client.query(
    `SELECT best_score FROM mednexus_game_personal_bests
     WHERE user_id = $1 AND mode = $2
     FOR UPDATE`,
    [userId, mode],
  )
  const previous = Number(existing.rows[0]?.best_score ?? 0)
  const isNewHigh = score > previous
  await client.query(
    `INSERT INTO mednexus_game_personal_bests
       (user_id, mode, best_score, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id, mode) DO UPDATE
       SET best_score = GREATEST(mednexus_game_personal_bests.best_score, EXCLUDED.best_score),
           updated_at = CASE
             WHEN EXCLUDED.best_score > mednexus_game_personal_bests.best_score THEN NOW()
             ELSE mednexus_game_personal_bests.updated_at
           END`,
    [userId, mode, score],
  )
  return isNewHigh
}

/** Credits a completed, server-recorded activity exactly once. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { sessionId } = await req.json()
    if (!sessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 })

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const { rows } = await client.query(
        `SELECT * FROM mednexus_exam_sessions
         WHERE id = $1 AND user_id = $2
         FOR UPDATE`,
        [sessionId, auth.uid],
      )
      const session = rows[0]
      if (!session) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      if (session.payout) {
        await client.query("COMMIT")
        return NextResponse.json(session.payout)
      }
      if (session.status !== "completed") {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Activity is not completed" }, { status: 409 })
      }

      const keys: Key[] = Array.isArray(session.answer_key) ? session.answer_key : []
      const keyById = new Map(keys.map((key) => [key.id, key]))
      const answerMap = (session.accepted_answers ?? {}) as Record<string, unknown>
      const storedOrder: OrderedAnswer[] = Array.isArray(session.answer_order)
        ? session.answer_order
        : []
      const orderedAnswers = storedOrder.length
        ? storedOrder
        : keys
            .filter((key) => Object.prototype.hasOwnProperty.call(answerMap, key.id))
            .map((key) => ({ questionId: key.id, answer: answerMap[key.id] as OrderedAnswer["answer"] }))

      let currentStreak = 0
      let bestStreak = 0
      let survivedCount = 0
      let suddenAlive = true
      const sessionData: Array<SessionQuestionInput & { currentStreak: number }> = []

      for (const attempt of orderedAnswers) {
        const key = keyById.get(attempt.questionId)
        if (!key) continue
        const correct = isCorrect(attempt.answer, key.correctAnswer)
        currentStreak = correct ? currentStreak + 1 : 0
        bestStreak = Math.max(bestStreak, currentStreak)
        if (suddenAlive && correct) survivedCount++
        else if (!correct) suddenAlive = false
        sessionData.push({
          questionId: key.id,
          discipline: key.discipline,
          isCorrect: correct,
          currentStreak,
        })
      }

      const total = sessionData.length
      const correctCount = sessionData.filter((question) => question.isCorrect).length
      const accuracy = total ? Math.round(correctCount * 100 / total) : 0
      const score = calculateServerScore(session.mode, sessionData, bestStreak)
      const isNewHigh = await updatePersonalBest(auth.uid, session.mode, score, client)
      const result: GameResult = {
        mode: session.mode,
        score,
        correct: correctCount,
        total,
        bestStreak,
        isNewHigh,
        survivedCount,
        accuracy,
        lifelineUsed: session.result_meta?.lifelineUsed === true,
      }

      const anti = await calculateSessionNP(
        auth.uid,
        session.mode,
        sessionData,
        client,
        session.mode === "exam"
          ? {
              accuracy,
              correct: correctCount,
              total,
              primaryDiscipline: keys[0]?.discipline,
            }
          : undefined,
      )

      const gross = calculatePayout(result)
      const isSoloGame = SOLO_GAME_MODES.has(session.mode)
      const canAwardCompletion = isSoloGame
        && total > 0
        && await completionBonusAvailable(client, auth.uid)
      const achievementBreakdown = isSoloGame
        ? gross.breakdown.filter((item) => item.label !== "Participation")
        : []
      const achievementNP = achievementBreakdown.reduce((sum, item) => sum + item.amount, 0)
      const credits: NPCredit[] = []
      if (anti.totalNP > 0) {
        credits.push({
          source: session.mode === "exam" ? "exam_reward" : "question_reward",
          sourceId: sessionId,
          amount: anti.totalNP,
          metadata: { mode: session.mode },
        })
      }
      if (canAwardCompletion) {
        credits.push({
          source: "game_completion",
          sourceId: sessionId,
          amount: 25,
          metadata: { mode: session.mode },
        })
      }
      if (achievementNP > 0) {
        credits.push({
          source: "game_achievement",
          sourceId: sessionId,
          amount: achievementNP,
          metadata: { mode: session.mode, score, accuracy, bestStreak },
        })
      }

      const credit = await applyNPCredits(client, auth.uid, credits)
      await recordDailyActivity(client, auth.uid, total, correctCount)

      const bountyUpdates: Array<{
        id: string
        progress: number
        target: number
        claimed: boolean
        newlyComplete: boolean
      }> = []
      for (const bounty of getTodaysBounties()) {
        const delta = computeBountyProgress(bounty, result)
        if (!delta) continue
        const old = await client.query(
          `SELECT progress, claimed FROM mednexus_bounty_progress
           WHERE uid = $1 AND bounty_id = $2 AND bounty_date = $3
           FOR UPDATE`,
          [auth.uid, bounty.id, TODAY_DATE()],
        )
        if (old.rows[0]?.claimed) continue
        const oldProgress = Number(old.rows[0]?.progress ?? 0)
        const progress = Math.min(oldProgress + delta, bounty.target)
        await client.query(
          `INSERT INTO mednexus_bounty_progress
             (uid, bounty_id, bounty_date, progress, claimed)
           VALUES ($1, $2, $3, $4, FALSE)
           ON CONFLICT (uid, bounty_id, bounty_date) DO UPDATE
             SET progress = EXCLUDED.progress`,
          [auth.uid, bounty.id, TODAY_DATE(), progress],
        )
        bountyUpdates.push({
          id: bounty.id,
          progress,
          target: bounty.target,
          claimed: false,
          newlyComplete: progress === bounty.target && oldProgress < bounty.target,
        })
      }

      const breakdown = [
        ...anti.breakdown,
        ...(canAwardCompletion ? [{ label: "Participation", amount: 25 }] : []),
        ...achievementBreakdown,
        ...credit.rankBreakdown,
      ]
      const payload = {
        earned: credit.credited,
        newBalance: credit.newBalance,
        breakdown,
        bountyUpdates,
        score,
        correct: correctCount,
        total,
      }
      await client.query(
        "UPDATE mednexus_exam_sessions SET payout = $2::jsonb WHERE id = $1",
        [sessionId, JSON.stringify(payload)],
      )
      await client.query("COMMIT")
      return NextResponse.json(payload)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("economy payout", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

