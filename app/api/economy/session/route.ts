import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"
import { authenticateRequest, authError, identityMismatch } from "@/lib/request-auth"
import { abandonStaleSessions } from "@/lib/anti-farming"
import { questionsDatabase } from "@/lib/questions-database"

type Answer = string | string[] | null
const sameAnswer = (answer: Answer, correct: Answer) => Array.isArray(answer) && Array.isArray(correct)
  ? answer.length === correct.length && [...answer].sort().every((x, i) => x === [...correct].sort()[i])
  : answer === correct

/** Starts a scored activity and snapshots answer keys on the server. */
export async function POST(req: NextRequest) {
  try {
    const auth = authenticateRequest(req.headers)
    if (!auth) return authError()
    await ensureSchema()
    const { uid, mode, questionIds } = await req.json()
    if (identityMismatch(uid, auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!mode || !Array.isArray(questionIds) || !questionIds.length) return NextResponse.json({ error: "mode and questionIds are required" }, { status: 400 })
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
    await ensureSchema()
    const { sessionId, uid, answers } = await req.json()
    if (identityMismatch(uid, auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (!sessionId || !answers || typeof answers !== "object" || Array.isArray(answers)) return NextResponse.json({ error: "sessionId and answers are required" }, { status: 400 })
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
  const { uid, staleMins } = await req.json(); if (identityMismatch(uid, auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  return NextResponse.json(await abandonStaleSessions(auth.uid, staleMins ?? 480))
}

export { sameAnswer }
