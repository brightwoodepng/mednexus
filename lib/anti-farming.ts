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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuestionResult {
  questionId: string
  discipline:  string
  isCorrect:   boolean
  /** Gross NP this question would earn before anti-farming checks */
  baseNP:      number
}

export interface SessionNPResult {
  /** NP approved for crediting after all anti-farming rules applied */
  totalNP: number
  breakdown: {
    questionId:   string
    discipline:   string
    baseNP:       number
    awardedNP:    number
    /** Reason NP was suppressed, or null if paid in full */
    suppressedReason: "repeat_cap" | "discipline_fatigue" | null
  }[]
  /** Disciplines that hit the fatigue ceiling during this session */
  fatiguedDisciplines: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REPEAT_CAP          = 3      // correct answers before a question earns 0 NP
const DISCIPLINE_NP_LIMIT = 1000   // NP ceiling per discipline per 7-day window
const FATIGUE_DAYS        = 7

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
  sessionData: QuestionResult[],
  client:      PoolClient,
): Promise<SessionNPResult> {
  const today    = todayStr()
  const window7  = last7DaysStrings()

  // ── Load current correct-counts for all questions in this session ──────────
  const questionIds = sessionData.map((q) => q.questionId)

  const { rows: progressRows } = await client.query<{
    question_id: string
    correct_count: number
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
  const disciplines = [...new Set(sessionData.map((q) => q.discipline))]

  const { rows: fatigueRows } = await client.query<{
    discipline: string
    total: string
  }>(
    `SELECT discipline, COALESCE(SUM(np_earned), 0)::text AS total
       FROM mednexus_discipline_np_log
      WHERE user_id = $1
        AND discipline = ANY($2::text[])
        AND earned_date = ANY($3::text[])
      GROUP BY discipline`,
    [userId, disciplines, window7],
  )

  // Running totals start from existing 7-day values; we'll add session amounts
  const disciplineRunningNP = new Map<string, number>(
    fatigueRows.map((r) => [r.discipline, parseInt(r.total, 10)]),
  )

  // ── Evaluate each question ────────────────────────────────────────────────
  const breakdown: SessionNPResult["breakdown"] = []
  let totalNP = 0

  // Track which question_ids need progress upserts and by how much
  const correctIncrements = new Map<string, { discipline: string; delta: number }>()
  // Track NP accumulated per discipline this session (for the log upsert)
  const disciplineNPThisSession = new Map<string, number>()

  for (const q of sessionData) {
    if (!q.isCorrect || q.baseNP <= 0) {
      breakdown.push({
        questionId: q.questionId,
        discipline: q.discipline,
        baseNP: q.baseNP,
        awardedNP: 0,
        suppressedReason: null,
      })
      continue
    }

    // ── Rule 1: 3-Repeat Cap ──────────────────────────────────────────────
    const correctCount = correctCountMap.get(q.questionId) ?? 0
    if (correctCount >= REPEAT_CAP) {
      breakdown.push({
        questionId: q.questionId,
        discipline: q.discipline,
        baseNP: q.baseNP,
        awardedNP: 0,
        suppressedReason: "repeat_cap",
      })
      continue
    }

    // ── Rule 2: Discipline Fatigue ────────────────────────────────────────
    const runningNP = disciplineRunningNP.get(q.discipline) ?? 0
    if (runningNP >= DISCIPLINE_NP_LIMIT) {
      breakdown.push({
        questionId: q.questionId,
        discipline: q.discipline,
        baseNP: q.baseNP,
        awardedNP: 0,
        suppressedReason: "discipline_fatigue",
      })
      continue
    }

    // ── Approved — award NP ───────────────────────────────────────────────
    totalNP += q.baseNP

    // Update running maps so later questions in the same session see the
    // accumulated state (prevents farming a discipline within one session)
    correctCountMap.set(q.questionId, correctCount + 1)
    disciplineRunningNP.set(q.discipline, runningNP + q.baseNP)

    // Stage DB writes
    const prev = correctIncrements.get(q.questionId) ?? { discipline: q.discipline, delta: 0 }
    correctIncrements.set(q.questionId, { discipline: q.discipline, delta: prev.delta + 1 })

    disciplineNPThisSession.set(
      q.discipline,
      (disciplineNPThisSession.get(q.discipline) ?? 0) + q.baseNP,
    )

    breakdown.push({
      questionId: q.questionId,
      discipline: q.discipline,
      baseNP: q.baseNP,
      awardedNP: q.baseNP,
      suppressedReason: null,
    })
  }

  // ── Flush DB side-effects (still inside the caller's transaction) ─────────

  // Upsert correct-count increments
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

  // Upsert discipline NP log for today
  for (const [discipline, np] of disciplineNPThisSession) {
    await client.query(
      `INSERT INTO mednexus_discipline_np_log
         (user_id, discipline, earned_date, np_earned)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, discipline, earned_date) DO UPDATE
         SET np_earned = mednexus_discipline_np_log.np_earned + $4`,
      [userId, discipline, today, np],
    )
  }

  const fatiguedDisciplines = [...disciplineRunningNP.entries()]
    .filter(([, total]) => total >= DISCIPLINE_NP_LIMIT)
    .map(([d]) => d)

  return { totalNP, breakdown, fatiguedDisciplines }
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
  staleMins: number = 480,
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
