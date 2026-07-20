// ── Exam Session API ───────────────────────────────────────────────────────────
// POST   /api/economy/session  — open a new session (called when exam starts)
// PATCH  /api/economy/session  — close/complete a session (called on submit)
// DELETE /api/economy/session  — trigger stale-session sweep for a user
//
// Only exam-mode sessions are tracked; other modes can call this optionally.

import { NextRequest, NextResponse } from "next/server"
import { ensureSchema } from "@/lib/db"
import {
  openExamSession,
  completeExamSession,
  abandonStaleSessions,
} from "@/lib/anti-farming"

// POST /api/economy/session
// body: { uid, mode, questionIds: string[] }
export async function POST(req: NextRequest) {
  try {
    await ensureSchema()
    const { uid, mode, questionIds } = await req.json()

    if (!uid || !mode || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { error: "uid, mode, and questionIds are required" },
        { status: 400 },
      )
    }

    // Before opening, sweep any stale sessions this user left open
    await abandonStaleSessions(uid)

    const sessionId = await openExamSession(uid, mode, questionIds)
    return NextResponse.json({ sessionId })
  } catch (err) {
    console.error("[economy/session POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH /api/economy/session
// body: { sessionId, answeredIds: string[] }
export async function PATCH(req: NextRequest) {
  try {
    const { sessionId, answeredIds } = await req.json()

    if (!sessionId || !Array.isArray(answeredIds)) {
      return NextResponse.json(
        { error: "sessionId and answeredIds are required" },
        { status: 400 },
      )
    }

    await completeExamSession(sessionId, answeredIds)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[economy/session PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/economy/session
// body: { uid, staleMins? }  — manually trigger abandonment sweep
export async function DELETE(req: NextRequest) {
  try {
    const { uid, staleMins } = await req.json()

    if (!uid) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 })
    }

    const result = await abandonStaleSessions(uid, staleMins ?? 480)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[economy/session DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
