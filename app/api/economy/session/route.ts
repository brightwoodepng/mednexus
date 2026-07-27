import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { abandonStaleSessions } from "@/lib/anti-farming"
import { questionsDatabase } from "@/lib/questions-database"
import type { Question } from "@/lib/types"
import { buildGameQuestionPool } from "@/lib/game-question-pool"

const SCORABLE_MODES = new Set([
  "tutor", "exam", "trial",
  "rapid", "sudden", "timeatk", "double", "streak",
])
const SOLO_GAME_MODES = new Set(["rapid", "sudden", "timeatk", "double", "streak"])
const MAX_SESSION_QUESTIONS = 200
const MAX_SESSION_ANSWERS = MAX_SESSION_QUESTIONS

const COMPLETION_REASONS: Record<string, ReadonlySet<string>> = {
  tutor: new Set(["pool_completed"]),
  exam: new Set(["pool_completed"]),
  trial: new Set(["pool_completed"]),
  rapid: new Set(["lives_exhausted", "pool_completed"]),
  sudden: new Set(["incorrect_answer", "pool_completed"]),
  timeatk: new Set(["timeout", "pool_completed"]),
  double: new Set(["bank_depleted", "pool_completed"]),
  streak: new Set(["player_finished", "pool_completed"]),
}

type AcceptedAnswer = string | string[] | null
type OrderedAnswer = { questionId: string; answer: AcceptedAnswer }
type SnapshotQuestion = {
  id: string
  discipline: string
  correctAnswer: Question["correctAnswer"]
}

function validAnswer(value: unknown): value is AcceptedAnswer {
  return value === null
    || typeof value === "string"
    || (Array.isArray(value) && value.every((item) => typeof item === "string"))
}

type SnapshotResult = {
  snapshot: SnapshotQuestion[] | null
  duplicateCounts: { id: number; content: number }
  invalidQuestionIds: string[]
}

async function loadQuestionSnapshot(questionIds: string[], validateSoloPool: boolean): Promise<SnapshotResult> {
  const saved = await pool.query("SELECT data FROM mednexus_questions WHERE id = 1")
  const savedBank: Question[] = Array.isArray(saved.rows[0]?.data) ? saved.rows[0].data : []
  const bank = savedBank.length ? savedBank : questionsDatabase
  const permittedPool = validateSoloPool ? buildGameQuestionPool(bank) : null
  const permittedQuestions = permittedPool?.questions ?? bank
  const byId = new Map(permittedQuestions.map((question) => [question.id, question]))
  const invalidQuestionIds = questionIds.filter((id) => !byId.has(id))
  const snapshot = questionIds.map((id) => {
    const question = byId.get(id)
    return question
      ? {
          id: question.id,
          discipline: question.subject,
          correctAnswer: question.correctAnswer,
        }
      : null
  })
  return {
    snapshot: invalidQuestionIds.length ? null : snapshot as SnapshotQuestion[],
    duplicateCounts: {
      id: permittedPool?.diagnostics.idDuplicateCount ?? 0,
      content: permittedPool?.diagnostics.contentDuplicateCount ?? 0,
    },
    invalidQuestionIds,
  }
}

/** Starts a scored activity and snapshots answer keys on the server. */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { mode, questionIds } = await req.json()
    if (
      typeof mode !== "string"
      || !SCORABLE_MODES.has(mode)
      || !Array.isArray(questionIds)
      || !questionIds.length
      || questionIds.length > MAX_SESSION_QUESTIONS
      || questionIds.some((id) => typeof id !== "string")
      || new Set(questionIds).size !== questionIds.length
    ) {
      return NextResponse.json(
        { error: "A valid mode and a bounded list of question IDs are required" },
        { status: 400 },
      )
    }

    const loaded = await loadQuestionSnapshot(questionIds, SOLO_GAME_MODES.has(mode))
    if (loaded.duplicateCounts.id || loaded.duplicateCounts.content) {
      console.warn("[economy-session] Duplicate question records excluded", loaded.duplicateCounts)
    }
    if (!loaded.snapshot) {
      return NextResponse.json({
        error: "Activity includes a question that is unavailable or duplicates canonical content",
        duplicateCounts: loaded.duplicateCounts,
        invalidQuestionCount: loaded.invalidQuestionIds.length,
      }, { status: 400 })
    }

    await abandonStaleSessions(auth.uid)
    const sessionId = `esess-${crypto.randomUUID()}`
    await pool.query(
      `INSERT INTO mednexus_exam_sessions
        (id, user_id, mode, question_ids, answer_key, status)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'active')`,
      [sessionId, auth.uid, mode, JSON.stringify(questionIds), JSON.stringify(loaded.snapshot)],
    )
    return NextResponse.json({ sessionId, duplicateCounts: loaded.duplicateCounts })
  } catch (error) {
    console.error("economy session POST", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

/** Records accepted answers. Completion remains idempotent and belongs only to its creator. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const body = await req.json() as {
      sessionId?: string
      answers?: Record<string, AcceptedAnswer>
      orderedAnswers?: OrderedAnswer[]
      resultMeta?: {
        lifelineUsed?: boolean
        completionReason?: string
        clientRoundStartedAt?: string
        clientRoundFinishedAt?: string
        selectedQuestionCount?: number
        answeredQuestionCount?: number
        freezeCount?: number
        wagerHistory?: number[]
      }
    }
    const { sessionId } = body
    const answers = body.answers ?? {}
    const orderedAnswers = body.orderedAnswers ?? Object.entries(answers)
      .map(([questionId, answer]) => ({ questionId, answer }))

    if (
      !sessionId
      || typeof answers !== "object"
      || Array.isArray(answers)
      || !Array.isArray(orderedAnswers)
      || orderedAnswers.length > MAX_SESSION_ANSWERS
    ) {
      return NextResponse.json({ error: "sessionId and valid answers are required" }, { status: 400 })
    }

    const session = await pool.query(
      "SELECT question_ids, status, mode FROM mednexus_exam_sessions WHERE id = $1 AND user_id = $2",
      [sessionId, auth.uid],
    )
    if (!session.rows[0]) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    const allowedIds = new Set<string>(session.rows[0].question_ids ?? [])
    const invalidOrderedAnswer = orderedAnswers.some((entry) =>
      !entry
      || typeof entry.questionId !== "string"
      || !allowedIds.has(entry.questionId)
      || !validAnswer(entry.answer),
    )
    const invalidAnswerMap = Object.entries(answers)
      .some(([id, answer]) => !allowedIds.has(id) || !validAnswer(answer))
    const orderedIds = orderedAnswers.map((entry) => entry?.questionId)
    const duplicateOrderedAnswer = new Set(orderedIds).size !== orderedIds.length
    if (invalidOrderedAnswer || invalidAnswerMap || duplicateOrderedAnswer) {
      return NextResponse.json({ error: "Answers include an invalid question or option value" }, { status: 400 })
    }

    const meta = body.resultMeta
    const startedAt = typeof meta?.clientRoundStartedAt === "string" ? Date.parse(meta.clientRoundStartedAt) : NaN
    const finishedAt = typeof meta?.clientRoundFinishedAt === "string" ? Date.parse(meta.clientRoundFinishedAt) : NaN
    const validCompletionMeta = !!meta
      && typeof meta.completionReason === "string"
      && COMPLETION_REASONS[session.rows[0].mode]?.has(meta.completionReason)
      && Number.isFinite(startedAt)
      && Number.isFinite(finishedAt)
      && finishedAt >= startedAt
      && Number.isInteger(meta.selectedQuestionCount)
      && meta.selectedQuestionCount === allowedIds.size
      && Number.isInteger(meta.answeredQuestionCount)
      && meta.answeredQuestionCount === orderedAnswers.length
      && meta.answeredQuestionCount >= 0
      && meta.answeredQuestionCount <= meta.selectedQuestionCount
      && (meta.freezeCount === undefined || (Number.isInteger(meta.freezeCount) && meta.freezeCount >= 0 && meta.freezeCount <= 100))
      && (meta.wagerHistory === undefined || (Array.isArray(meta.wagerHistory)
        && meta.wagerHistory.length === orderedAnswers.length
        && meta.wagerHistory.every((wager) => Number.isInteger(wager) && wager > 0)))
    if (!validCompletionMeta) {
      return NextResponse.json({ error: "Completion metadata is invalid for this mode" }, { status: 400 })
    }
    const resultMeta = {
      lifelineUsed: meta.lifelineUsed === true,
      completionReason: meta.completionReason,
      clientRoundStartedAt: meta.clientRoundStartedAt,
      clientRoundFinishedAt: meta.clientRoundFinishedAt,
      selectedQuestionCount: meta.selectedQuestionCount,
      answeredQuestionCount: meta.answeredQuestionCount,
      freezeCount: meta.freezeCount ?? 0,
      wagerHistory: meta.wagerHistory ?? [],
    }
    const updated = await pool.query(
      `UPDATE mednexus_exam_sessions
       SET status = 'completed',
           accepted_answers = $3::jsonb,
           answer_order = $4::jsonb,
           result_meta = $5::jsonb,
           submitted_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING id`,
      [
        sessionId,
        auth.uid,
        JSON.stringify(answers),
        JSON.stringify(orderedAnswers),
        JSON.stringify(resultMeta),
      ],
    )
    if (!updated.rowCount && session.rows[0].status !== "completed") {
      return NextResponse.json({ error: "Activity can no longer be completed" }, { status: 409 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("economy session PATCH", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireRegisteredUser(req)
  if (!auth) return unauthorized()
  const { staleMins } = await req.json()
  const boundedStaleMins = typeof staleMins === "number" && Number.isFinite(staleMins)
    ? Math.min(24 * 60, Math.max(1, Math.floor(staleMins)))
    : 480
  return NextResponse.json(await abandonStaleSessions(auth.uid, boundedStaleMins))
}

