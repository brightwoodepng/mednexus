// ── Anti-Farming Engine ────────────────────────────────────────────────────────
// Enforces three NP integrity rules:
//   1. 3-Repeat Cap    — a question that a user has answered correctly ≥3 times
//                        yields 0 NP on all subsequent correct answers.
//   2. Discipline Fatigue — once a user has earned ≥1000 NP in a single
//                        discipline over the rolling 7-day window, further
//                        questions in that discipline yield 0 NP.
//   3. Exam Abandonment — if an "exam" session is opened but never properly
//                        submitted, it is marked "abandoned" and all unanswered
//                        questions are recorded as incorrect in the user's
//                        question-progress table (hurts their accuracy).
//
// All DB writes are done via a passed-in PoolClient so callers can wrap them
// inside their own transaction.

import type { PoolClient } from "pg"
import pool from "@/lib/db"
import { applyNPCredits } from "@/lib/np-ledger"
import { ECONOMY_CONFIG, isEarningModeEnabled } from "@/lib/economy-config"

// ── Types ─────────────────────────────────────────────────────────────────────

/** Per-question input supplied by the quiz / game session */
export interface SessionQuestionInput {
  questionId: string
  discipline:  string
  isCorrect:   boolean
  /** Trial mode: consecutive correct answers INCLUDING this one (0 if not tracked) */
  currentStreak?: number
}

/** Exam-mode completion metadata for the bounty calculator */
export interface ExamMeta {
  accuracy:           number   // 0-100 percentage
  correct:            number
  total:              number
  /** Discipline used for the 7-day fatigue cap check */
  primaryDiscipline?: string
}

export interface SessionNPResult {
  totalNP: number
  /** Ready-to-append payout-style breakdown entries */
  breakdown: { label: string; amount: number }[]
  fatiguedDisciplines: string[]
  /** Separately ledgered Trial/Tutor reward categories. */
  rewardComponents: { questions: number; streaks: number; completion: number }
  /** Per-question detail (trial mode only) */
  perQuestion: {
    questionId:       string
    awardedNP:        number
    suppressedReason: "repeat_cap" | "discipline_fatigue" | null
  }[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REPEAT_MULTIPLIERS = ECONOMY_CONFIG.antiFarming.repeatRewardMultipliers
const DISCIPLINE_NP_LIMIT = ECONOMY_CONFIG.antiFarming.disciplineNPWindowLimit
const FATIGUE_DAYS = ECONOMY_CONFIG.antiFarming.disciplineWindowDays

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Returns the YYYY-MM-DD strings for today and the previous (FATIGUE_DAYS - 1)
 * days, used to build the 7-day rolling window filter.
 */
function last7DaysStrings(): string[] {
  const dates: string[] = []
  for (let i = 0; i < FATIGUE_DAYS; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

// ── Core: calculateSessionNP ──────────────────────────────────────────────────

/**
 * Evaluates each question result against the anti-farming rules and returns the
 * NP that should actually be credited.  Also writes the side-effects (correct
 * count increments and discipline NP accumulation) to the DB within the supplied
 * client — the caller owns the transaction.
 *
 * @param userId      Registered user UID (guests skip anti-farming)
 * @param mode        Game/session mode string (informational, kept for logging)
 * @param sessionData Per-question results with gross NP values
 * @param client      An already-connected pg.PoolClient (within a transaction)
 */
export async function calculateSessionNP(
  userId:      string,
  mode:        string,
  sessionData: SessionQuestionInput[],
  client:      PoolClient,
  examMeta?:   ExamMeta,
  sessionId?:  string,
): Promise<SessionNPResult> {
  const enabled = mode === "exam"
    ? isEarningModeEnabled("mcq_exam") && (ECONOMY_CONFIG.modeIds.exam as readonly string[]).includes(mode)
    : (isEarningModeEnabled("mcq_trial_tutor") && (ECONOMY_CONFIG.modeIds.trialTutor as readonly string[]).includes(mode))
      || (isEarningModeEnabled("mcq_solo_game") && (ECONOMY_CONFIG.modeIds.soloGames as readonly string[]).includes(mode))
  if (!enabled) throw new Error(`Economy rewards are disabled for mode: ${mode}`)

  const today   = todayStr()
  const window7 = last7DaysStrings()

  // Reconstruct Trial/Tutor results from server-owned session data. Client
  // correctness and streak claims are deliberately ignored.
  if ((ECONOMY_CONFIG.modeIds.trialTutor as readonly string[]).includes(mode)) {
    if (!sessionId) throw new Error("A server session is required for Trial/Tutor rewards")
    const { rows } = await client.query<{
      answer_key: Array<{ id: string; discipline: string; correctAnswer: unknown }>
      accepted_answers: Record<string, unknown>
      answer_order: Array<{ questionId: string }>
    }>(`SELECT answer_key, accepted_answers, answer_order
          FROM mednexus_exam_sessions
         WHERE id = $1 AND user_id = $2 AND mode = $3 AND status = 'completed'`,
      [sessionId, userId, mode])
    if (!rows[0]) throw new Error("Completed Trial/Tutor session not found")
    const keys = Array.isArray(rows[0].answer_key) ? rows[0].answer_key : []
    const keyById = new Map(keys
      .filter((key) => key && typeof key.id === "string" && typeof key.discipline === "string" && key.correctAnswer != null)
      .map((key) => [key.id, key]))
    const answers = rows[0].accepted_answers && typeof rows[0].accepted_answers === "object" ? rows[0].accepted_answers : {}
    const order = Array.isArray(rows[0].answer_order) ? rows[0].answer_order : []
    const seen = new Set<string>()
    let streak = 0
    sessionData = order.flatMap((entry) => {
      const id = entry?.questionId
      const key = typeof id === "string" ? keyById.get(id) : undefined
      // Absent answers include revealed-only questions. Unknown and duplicate
      // attempts are invalid; none count toward rewards or completion.
      if (!key || seen.has(id) || !Object.prototype.hasOwnProperty.call(answers, id) || answers[id] == null) return []
      seen.add(id)
      const actual = answers[id]
      const expected = key.correctAnswer
      const correct = Array.isArray(actual) && Array.isArray(expected)
        ? actual.length === expected.length && [...actual].sort().every((value, index) => value === [...expected].sort()[index])
        : actual === expected
      streak = correct ? streak + 1 : 0
      return [{ questionId: id, discipline: key.discipline, isCorrect: correct, currentStreak: streak }]
    })
  }

  const questionIds = sessionData.map((q) => q.questionId)
  const disciplines = [...new Set(sessionData.map((q) => q.discipline))]

  // ── Load correct-counts for all questions in this session ─────────────────
  const { rows: progressRows } = await client.query<{
    question_id: string; correct_count: number
  }>(
    `SELECT question_id, correct_count
       FROM mednexus_user_question_progress
      WHERE user_id = $1 AND question_id = ANY($2::text[])`,
    [userId, questionIds],
  )
  const correctCountMap = new Map<string, number>(
    progressRows.map((r) => [r.question_id, r.correct_count]),
  )

  // ── Load 7-day discipline NP totals ───────────────────────────────────────
  const fatigueDiscs = mode === "exam" && examMeta?.primaryDiscipline
    ? [examMeta.primaryDiscipline]
    : disciplines

  const { rows: fatigueRows } = await client.query<{
    discipline: string; total: string
  }>(
    `SELECT discipline, COALESCE(SUM(np_earned), 0)::text AS total
       FROM mednexus_discipline_np_log
      WHERE user_id = $1
        AND discipline = ANY($2::text[])
        AND earned_date = ANY($3::text[])
      GROUP BY discipline`,
    [userId, fatigueDiscs, window7],
  )
  const disciplineRunningNP = new Map<string, number>(
    fatigueRows.map((r) => [r.discipline, parseInt(r.total, 10)]),
  )

  // Always track correct-count increments (both modes, no NP implied)
  const correctIncrements       = new Map<string, { discipline: string; delta: number }>()
  const disciplineNPThisSession = new Map<string, number>()

  for (const q of sessionData) {
    if (!q.isCorrect) continue
    const prev = correctIncrements.get(q.questionId) ?? { discipline: q.discipline, delta: 0 }
    correctIncrements.set(q.questionId, { discipline: q.discipline, delta: prev.delta + 1 })
  }

  // ── Mode-specific NP calculation ──────────────────────────────────────────
  const perQuestion: SessionNPResult["perQuestion"] = []
  const breakdown:   SessionNPResult["breakdown"]   = []
  const fatiguedDisciplines: string[]               = []
  let totalNP = 0
  const rewardComponents = { questions: 0, streaks: 0, completion: 0 }

  if (mode === "exam") {
    // ── Exam: single completion bounty ────────────────────────────────────
    if (examMeta) {
      const { accuracy, correct, total, primaryDiscipline } = examMeta
      const accuracyBonus = [...ECONOMY_CONFIG.examRewards.accuracyThresholds]
        .reverse().find((threshold) => accuracy > threshold.above)?.bonus ?? 0
      const bounty = ECONOMY_CONFIG.examRewards.completion + accuracyBonus

      const disc     = primaryDiscipline ?? disciplines[0] ?? ""
      const runningNP = disciplineRunningNP.get(disc) ?? 0

      if (disc && runningNP >= DISCIPLINE_NP_LIMIT) {
        fatiguedDisciplines.push(disc)
        breakdown.push({ label: "⚡ Discipline Fatigue — exam bounty suppressed", amount: 0 })
      } else {
        totalNP = bounty
        breakdown.push({ label: `📋 Exam Completion (${correct}/${total} correct)`, amount: ECONOMY_CONFIG.examRewards.completion })
        if (accuracyBonus > 0) {
          breakdown.push({ label: `🎯 Accuracy Bonus (${Math.round(accuracy)}%)`, amount: accuracyBonus })
        }
        if (disc) disciplineNPThisSession.set(disc, bounty)
      }
    }
  } else {
    // ── Trial: per-question NP with streak bonus ──────────────────────────
    let repeatCappedCount = 0
    let fatiguedCount     = 0

    for (const q of sessionData) {
      if (!q.isCorrect) {
        perQuestion.push({ questionId: q.questionId, awardedNP: 0, suppressedReason: null })
        continue
      }

      const streak      = q.currentStreak ?? 0
      const streakBonus = [...ECONOMY_CONFIG.questionRewards.trialTutor.streakThresholds]
        .reverse().find((threshold) => streak >= threshold.minimum)?.bonus ?? 0
      const correctCount = correctCountMap.get(q.questionId) ?? 0
      const multiplier = REPEAT_MULTIPLIERS[correctCount] ?? 0
      const questionNP = Math.floor(ECONOMY_CONFIG.questionRewards.trialTutor.correct * multiplier)
      const streakNP = Math.floor(streakBonus * multiplier)
      const baseNP = questionNP + streakNP

      // Rule 1: configurable repeat-encounter schedule
      if (multiplier <= 0) {
        repeatCappedCount++
        perQuestion.push({ questionId: q.questionId, awardedNP: 0, suppressedReason: "repeat_cap" })
        continue
      }

      // Rule 2: Discipline fatigue
      const runningNP = disciplineRunningNP.get(q.discipline) ?? 0
      if (runningNP >= DISCIPLINE_NP_LIMIT) {
        fatiguedCount++
        if (!fatiguedDisciplines.includes(q.discipline)) fatiguedDisciplines.push(q.discipline)
        perQuestion.push({ questionId: q.questionId, awardedNP: 0, suppressedReason: "discipline_fatigue" })
        continue
      }

      // Approved
      totalNP += baseNP
      rewardComponents.questions += questionNP
      rewardComponents.streaks += streakNP
      correctCountMap.set(q.questionId, correctCount + 1)
      disciplineRunningNP.set(q.discipline, runningNP + baseNP)
      disciplineNPThisSession.set(q.discipline, (disciplineNPThisSession.get(q.discipline) ?? 0) + baseNP)

      perQuestion.push({ questionId: q.questionId, awardedNP: baseNP, suppressedReason: null })
    }

    const answeredCount = sessionData.length
    rewardComponents.completion = ECONOMY_CONFIG.questionRewards.trialTutor.completionThresholds
      .filter(({ minimumAnswered }) => answeredCount >= minimumAnswered)
      .reduce((sum, threshold) => sum + threshold.bonus, 0)

    // The three sources share one economy-date cap. The surrounding payout
    // transaction and locked session make this calculation atomic per session.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`trial-tutor-cap:${userId}:${today}`])
    const capRows = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total FROM mednexus_np_transactions
        WHERE user_id = $1 AND source = ANY($2::text[])
          AND created_at >= $3::date AND created_at < $3::date + INTERVAL '1 day'`,
      [userId, ["trial_tutor_question", "trial_tutor_streak", "trial_tutor_completion"], today],
    )
    let remaining = Math.max(0, ECONOMY_CONFIG.questionRewards.trialTutor.dailyCap - Number(capRows.rows[0]?.total ?? 0))
    for (const category of ["questions", "streaks", "completion"] as const) {
      rewardComponents[category] = Math.min(rewardComponents[category], remaining)
      remaining -= rewardComponents[category]
    }
    totalNP = rewardComponents.questions + rewardComponents.streaks + rewardComponents.completion
    if (rewardComponents.questions) breakdown.push({ label: `📚 Correct Answers (${answeredCount} answered)`, amount: rewardComponents.questions })
    if (rewardComponents.streaks) breakdown.push({ label: "🔥 Streak Bonuses", amount: rewardComponents.streaks })
    if (rewardComponents.completion) breakdown.push({ label: `✅ Completion Bonuses (${answeredCount} answered)`, amount: rewardComponents.completion })
    if (repeatCappedCount > 0) {
      breakdown.push({ label: `🚫 Repeat Cap (${repeatCappedCount}q already mastered)`, amount: 0 })
    }
    if (fatiguedCount > 0) {
      breakdown.push({ label: `⚡ Discipline Fatigue (${fatiguedCount}q over daily limit)`, amount: 0 })
    }
  }

  // ── Flush correct-count increments ────────────────────────────────────────
  for (const [qId, { discipline, delta }] of correctIncrements) {
    await client.query(
      `INSERT INTO mednexus_user_question_progress
         (user_id, question_id, correct_count, discipline)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, question_id) DO UPDATE
         SET correct_count = mednexus_user_question_progress.correct_count + $3`,
      [userId, qId, delta, discipline],
    )
  }

  // ── Flush discipline NP log for today ─────────────────────────────────────
  for (const [discipline, np] of disciplineNPThisSession) {
    await client.query(
      `INSERT INTO mednexus_discipline_np_log
         (user_id, discipline, earned_date, np_earned)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, discipline, earned_date) DO UPDATE
         SET np_earned = mednexus_discipline_np_log.np_earned + EXCLUDED.np_earned`,
      [userId, discipline, today, np],
    )
  }

  return { totalNP, breakdown, fatiguedDisciplines, rewardComponents, perQuestion }
}

// ── Daily Login Reward ────────────────────────────────────────────────────────

export interface DailyLoginMilestone {
  day: number
  reward: number
  name: string
}

function nextLoginMilestone(streak: number): DailyLoginMilestone | null {
  const milestone = ECONOMY_CONFIG.dailyLogin.milestones.find(({ day }) => day > streak)
  return milestone
    ? { day: milestone.day, reward: milestone.bonus, name: milestone.name }
    : null
}

export interface DailyLoginResult {
  /** True when the user already got their reward today — caller should no-op */
  alreadyDone:   boolean
  earned:        number
  newStreak:     number
  longestStreak: number
  /** e.g. "7-Day Streak" when a milestone was hit, otherwise null */
  milestoneName: string | null
  /** The next one-time streak milestone, or null after completing day 30. */
  nextMilestone: DailyLoginMilestone | null
  breakdown:     { label: string; amount: number }[]
}

/**
 * Awards daily login NP to a registered user.  Safe to call on every app open —
 * it is idempotent within the same calendar day (UTC).
 *
 * Streak rules:
 *   - Same calendar day  → no-op (alreadyDone: true)
 *   - Previous calendar day → streak + 1
 *   - 2+ calendar days ago  → streak resets to 1
 *
 * NP payout:
 * Payout values and the finite, non-repeating 30-day milestone program live in
 * ECONOMY_CONFIG.dailyLogin.
 */
export async function processDailyLogin(userId: string): Promise<DailyLoginResult> {
  if (!isEarningModeEnabled("daily_login")) throw new Error("Daily login rewards are disabled")
  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    // ── Lock the user row to guard against concurrent calls ───────────────────
    const { rows } = await client.query<{
      login_streak:    number
      longest_streak:  number
      last_login_date: Date | null
    }>(
      `SELECT login_streak, longest_streak, last_login_date
         FROM mednexus_registered_users
        WHERE uid = $1
        FOR UPDATE`,
      [userId],
    )

    if (rows.length === 0) {
      await client.query("ROLLBACK")
      return { alreadyDone: true, earned: 0, newStreak: 0, longestStreak: 0, milestoneName: null, nextMilestone: nextLoginMilestone(0), breakdown: [] }
    }

    const row       = rows[0]
    const todayDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD UTC

    // last_login_date stored as TIMESTAMPTZ; convert to date string for day comparison
    const lastDate  = row.last_login_date
      ? new Date(row.last_login_date).toISOString().slice(0, 10)
      : null

    // ── Same day → already rewarded ──────────────────────────────────────────
    if (lastDate === todayDate) {
      await client.query("ROLLBACK")
      return {
        alreadyDone: true, earned: 0,
        newStreak: row.login_streak, longestStreak: row.longest_streak,
        milestoneName: null, nextMilestone: nextLoginMilestone(row.login_streak), breakdown: [],
      }
    }

    // ── Compute yesterday's date string (UTC) ─────────────────────────────────
    const yest = new Date()
    yest.setUTCDate(yest.getUTCDate() - 1)
    const yesterdayDate = yest.toISOString().slice(0, 10)

    const newStreak    = lastDate === yesterdayDate ? row.login_streak + 1 : 1
    const newLongest   = Math.max(row.longest_streak, newStreak)

    // ── NP calculation ────────────────────────────────────────────────────────
    const breakdown: DailyLoginResult["breakdown"] = [
      { label: "📅 Daily Login", amount: ECONOMY_CONFIG.dailyLogin.base },
    ]
    let earned: number = ECONOMY_CONFIG.dailyLogin.base
    let milestoneName = null as string | null

    // Milestones are exact, one-time streak achievements. In particular, the
    // day-30 reward does not implicitly recur on day 60, 90, and so on.
    for (const m of ECONOMY_CONFIG.dailyLogin.milestones) {
      if (newStreak === m.day) {
        const label = m.name
        breakdown.push({ label: `🔥 ${label} Milestone!`, amount: m.bonus })
        earned        += m.bonus
        milestoneName  = label
        break // only one milestone per login
      }
    }

    // ── Write: user streak counters ────────────────────────────────────────────
    await client.query(
      `UPDATE mednexus_registered_users
          SET login_streak    = $1,
              longest_streak  = $2,
              last_login_date = NOW()
        WHERE uid = $3`,
      [newStreak, newLongest, userId],
    )

    // ── Write: credit wallet, lifetime earnings and ledger ───────────────────
    const credit = await applyNPCredits(client, userId, [{
      source: "daily_login",
      sourceId: `daily-login:${todayDate}`,
      amount: earned,
      metadata: { streak: newStreak, milestoneName },
    }])
    earned = credit.credited
    breakdown.push(...credit.rankBreakdown)

    // ── Write: user notification (deterministic ID = idempotent) ─────────────
    const notifId     = `login-${userId}-${todayDate}`
    const streakLabel = newStreak === 1 ? "Welcome back" : `Day ${newStreak} streak`
    const message     = milestoneName
      ? `${streakLabel} — ${milestoneName} milestone reached! +${earned} NP`
      : `${streakLabel} — +${earned} NP for logging in today`

    await client.query(
      `INSERT INTO mednexus_user_notifications (id, user_id, type, message, is_read)
       VALUES ($1, $2, 'streak', $3, FALSE)
       ON CONFLICT (id) DO NOTHING`,
      [notifId, userId, message],
    )

    await client.query("COMMIT")

    return {
      alreadyDone: false,
      earned,
      newStreak,
      longestStreak: newLongest,
      milestoneName,
      nextMilestone: nextLoginMilestone(newStreak),
      breakdown,
    }
  } catch (err) {
    await client.query("ROLLBACK")
    throw err
  } finally {
    client.release()
  }
}

// ── Exam Session Lifecycle ─────────────────────────────────────────────────────

/**
 * Opens a new exam session record.  Call this when the user starts an exam-mode
 * game.  Returns the session ID to pass back to the client so it can close the
 * session on submit.
 */
export async function openExamSession(
  userId:      string,
  mode:        string,
  questionIds: string[],
): Promise<string> {
  const id = `esess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  await pool.query(
    `INSERT INTO mednexus_exam_sessions
       (id, user_id, mode, question_ids, answered_ids, status, started_at)
     VALUES ($1, $2, $3, $4::jsonb, '[]'::jsonb, 'active', NOW())`,
    [id, userId, mode, JSON.stringify(questionIds)],
  )
  return id
}

/**
 * Marks an exam session as properly completed.  Call this after a successful
 * submit so the session is not later swept as abandoned.
 */
export async function completeExamSession(
  sessionId:   string,
  answeredIds: string[],
): Promise<void> {
  await pool.query(
    `UPDATE mednexus_exam_sessions
        SET status = 'completed',
            answered_ids = $2::jsonb,
            submitted_at = NOW()
      WHERE id = $1 AND status = 'active'`,
    [sessionId, JSON.stringify(answeredIds)],
  )
}

/**
 * Scans for stale active exam sessions belonging to `userId` and marks them
 * `abandoned`.  For every unanswered question in each abandoned session, a row
 * is upserted into `mednexus_user_question_progress` WITHOUT incrementing
 * correct_count (i.e. the question registers as an incorrect attempt that
 * counts against the user's overall accuracy without awarding the repeat-cap
 * protection that a correct answer would give).
 *
 * "Stale" = started more than `staleMins` minutes ago and still `active`.
 * Default 480 minutes (8 h) is intentionally generous to avoid penalising
 * network disruptions; tighten it per deployment as needed.
 */
export async function abandonStaleSessions(
  userId:    string,
  staleMins: number = ECONOMY_CONFIG.antiFarming.abandonedExamMinutes,
): Promise<{ abandoned: number; penalisedQuestions: number }> {
  const { rows: staleSessions } = await pool.query<{
    id: string
    question_ids: string[]
    answered_ids: string[]
  }>(
    `UPDATE mednexus_exam_sessions
        SET status = 'abandoned', submitted_at = NOW()
      WHERE user_id  = $1
        AND status   = 'active'
        AND started_at < NOW() - ($2 || ' minutes')::INTERVAL
      RETURNING id, question_ids, answered_ids`,
    [userId, staleMins],
  )

  if (staleSessions.length === 0) return { abandoned: 0, penalisedQuestions: 0 }

  let penalisedQuestions = 0

  for (const sess of staleSessions) {
    const allIds      = sess.question_ids as unknown as string[]
    const answeredSet = new Set(sess.answered_ids as unknown as string[])
    const unanswered  = allIds.filter((id) => !answeredSet.has(id))

    for (const qId of unanswered) {
      // Insert a progress row with correct_count = 0 (no correct answer recorded).
      // ON CONFLICT DO NOTHING: if the user later answers correctly the existing
      // row with correct_count will be incremented normally by calculateSessionNP.
      await pool.query(
        `INSERT INTO mednexus_user_question_progress
           (user_id, question_id, correct_count, discipline)
         VALUES ($1, $2, 0, '')
         ON CONFLICT (user_id, question_id) DO NOTHING`,
        [userId, qId],
      )
      penalisedQuestions++
    }
  }

  return { abandoned: staleSessions.length, penalisedQuestions }
}
