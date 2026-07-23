import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { authenticateRequest, authError } from "@/lib/request-auth"
import { abandonStaleSessions } from "@/lib/anti-farming"
import { questionsDatabase } from "@/lib/questions-database"

type Answer = string | string[] | null
const SCORABLE_MODES = new Set(["tutor", "exam", "trial", "game"])
const MAX_SESSION_QUESTIONS = 200
const sameAnswer = (answer: Answer, correct: Answer) => Array.isArray(answer) && Array.isArray(correct)
  ? answer.length === correct.length && [...answer].sort().every((x, i) => x === [...correct].sort()[i])
  : answer === correct

/** Starts a scored activity and snapshots answer keys on the server. */
export async function POST(req: NextRequest) {
  try {
    const auth = authenticateRequest(req.headers)
    if (!auth) return authError()
    const { mode, questionIds } = await req.json()
    if (typeof mode !== "string" || !SCORABLE_MODES.has(mode) || !Array.isArray(questionIds) || !questionIds.length || questionIds.length > MAX_SESSION_QUESTIONS || questionIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "A valid mode and a bounded list of question IDs are required" }, { status: 400 })
    }
    const byId = new Map(questionsDatabase.map(q => [q.id, q]))
    const snapshot = questionIds.map((id: unknown) => {
      const q = typeof id === "string" ? byId.get(id) : undefined
      return q && { id: q.id, discipline: q.subject, correctAnswer: q.correctAnswer }
    })
    if (snapshot.length !== questionIds.length || snapshot.some(q => !q)) return NextResponse.json({ error: "Unknown question in scored activity" }, { status: 400 })
    await abandonStaleSessions(auth.uid)
    const sessionId = `esess-${crypto.randomUUID()}`
    await pool.query(`INSERT INTO mednexus_exam_sessions (id, user_id, mode, question_ids, answer_key, status)
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, 'active')`, [sessionId, auth.uid, mode, JSON.stringify(questionIds), JSON.stringify(snapshot)])
    return NextResponse.json({ sessionId })
  } catch (error) { console.error("economy session POST", error); return NextResponse.json({ error: "Server error" }, { status: 500 }) }
}

/** Records accepted answers. Completion remains idempotent and belongs only to its creator. */
export async function PATCH(req: NextRequest) {
  try {
    const auth = authenticateRequest(req.headers)
    if (!auth) return authError()
    const { sessionId, answers } = await req.json()
    if (!sessionId || !answers || typeof answers !== "object" || Array.isArray(answers)) return NextResponse.json({ error: "sessionId and answers are required" }, { status: 400 })
    const session = await pool.query("SELECT question_ids FROM mednexus_exam_sessions WHERE id = $1 AND user_id = $2", [sessionId, auth.uid])
    if (!session.rows[0]) return NextResponse.json({ error: "Session not found" }, { status: 404 })
    const allowedIds = new Set<string>(session.rows[0].question_ids ?? [])
    if (Object.keys(answers).some((id) => !allowedIds.has(id))) return NextResponse.json({ error: "Answers include a question outside this session" }, { status: 400 })
    const updated = await pool.query(`UPDATE mednexus_exam_sessions SET status = 'completed', accepted_answers = $3::jsonb, submitted_at = NOW()
      WHERE id = $1 AND user_id = $2 AND status = 'active' RETURNING id`, [sessionId, auth.uid, JSON.stringify(answers)])
    if (!updated.rowCount) {
      const existing = await pool.query("SELECT user_id, status FROM mednexus_exam_sessions WHERE id = $1", [sessionId])
      if (!existing.rows[0]) return NextResponse.json({ error: "Session not found" }, { status: 404 })
      if (existing.rows[0].user_id !== auth.uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) { console.error("economy session PATCH", error); return NextResponse.json({ error: "Server error" }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req.headers); if (!auth) return authError()
  const { staleMins } = await req.json()
  const boundedStaleMins = typeof staleMins === "number" && Number.isFinite(staleMins)
    ? Math.min(24 * 60, Math.max(1, Math.floor(staleMins)))
    : 480
  return NextResponse.json(await abandonStaleSessions(auth.uid, boundedStaleMins))
}

export { sameAnswer }
