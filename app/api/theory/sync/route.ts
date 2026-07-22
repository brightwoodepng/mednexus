/**
 * POST /api/theory/sync
 *
 * Updates only the Theory Vault progress fields in mednexus_progress.
 * Unlike the main /api/sync route, this does NOT touch mednexus_users
 * (so it never risks overwriting the user's name).
 *
 * Body (all fields optional — only present keys are merged):
 *   { theoryBookmarks?, revisionQueue?, theoryNotes?, theoryAnswered? }
 *
 * Auth: x-session-token (registered) or x-guest-token (guest).
 */

import { NextRequest, NextResponse } from "next/server"
import { getTheoryCaller } from "@/lib/theory-auth"
import crypto from "crypto"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    return pool
  } catch { return null }
}

function getVerifiedUid(req: NextRequest): string | null {
  return getTheoryCaller(req)?.uid ?? null
}

export async function POST(req: NextRequest) {
  try {
    const uid = getVerifiedUid(req)
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const body = await req.json()

    // Build a partial update object — only include fields that were sent
    const update: Record<string, unknown> = {}

    if (Array.isArray(body.theoryBookmarks))
      update.theoryBookmarks = body.theoryBookmarks

    if (Array.isArray(body.revisionQueue))
      update.revisionQueue = body.revisionQueue

    if (Array.isArray(body.theoryAnswered))
      update.theoryAnswered = body.theoryAnswered

    if (
      body.theoryNotes !== undefined &&
      body.theoryNotes !== null &&
      typeof body.theoryNotes === "object" &&
      !Array.isArray(body.theoryNotes)
    ) {
      update.theoryNotes = body.theoryNotes
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ success: true }) // nothing to do
    }

    // JSONB merge — existing || incoming so unrelated MCQ keys are untouched.
    // Right-hand side wins for keys present in both.
    await pool.query(
      `INSERT INTO mednexus_progress (uid, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (uid) DO UPDATE
         SET data       = mednexus_progress.data || EXCLUDED.data,
             updated_at = NOW()`,
      [uid, JSON.stringify(update)],
    )

    // Keep the legacy study interface and the normalized Theory views in sync.
    // These statements are all constrained by uid and derive hierarchy values
    // from the question row, never from client-provided identifiers.
    if (Array.isArray(body.theoryBookmarks)) {
      await pool.query("DELETE FROM mednexus_theory_bookmarks WHERE user_id=$1 AND NOT (question_id = ANY($2::text[]))", [uid, body.theoryBookmarks])
      for (const questionId of body.theoryBookmarks) await pool.query("INSERT INTO mednexus_theory_bookmarks(user_id,collection_id,discipline_id,set_id,question_id) SELECT $1,collection_id,discipline_id,set_id,id FROM mednexus_theory_questions WHERE id=$2 ON CONFLICT(user_id,question_id) DO NOTHING", [uid, questionId])
    }
    if (Array.isArray(body.revisionQueue)) {
      await pool.query("DELETE FROM mednexus_theory_revision_entries WHERE user_id=$1 AND completed_at IS NULL AND NOT (question_id = ANY($2::text[]))", [uid, body.revisionQueue])
      for (const questionId of body.revisionQueue) await pool.query("INSERT INTO mednexus_theory_revision_entries(id,user_id,collection_id,discipline_id,set_id,question_id,due_at) SELECT $1,$2,collection_id,discipline_id,set_id,id,NOW() FROM mednexus_theory_questions WHERE id=$3 AND NOT EXISTS (SELECT 1 FROM mednexus_theory_revision_entries WHERE user_id=$2 AND question_id=$3 AND completed_at IS NULL)", [crypto.randomUUID(), uid, questionId])
    }
    if (Array.isArray(body.theoryAnswered)) for (const questionId of body.theoryAnswered) {
      await pool.query("INSERT INTO mednexus_theory_completion_progress(user_id,collection_id,discipline_id,set_id,question_id) SELECT $1,collection_id,discipline_id,set_id,id FROM mednexus_theory_questions WHERE id=$2 ON CONFLICT(user_id,question_id) DO UPDATE SET completed_at=NOW()", [uid, questionId])
      await pool.query("INSERT INTO mednexus_theory_recent_activity(id,user_id,collection_id,discipline_id,set_id,question_id,activity_type) SELECT $1,$2,collection_id,discipline_id,set_id,id,'completed' FROM mednexus_theory_questions WHERE id=$3", [crypto.randomUUID(), uid, questionId])
    }
    if (body.theoryNotes && typeof body.theoryNotes === "object" && !Array.isArray(body.theoryNotes)) for (const [questionId, note] of Object.entries(body.theoryNotes)) {
      if (typeof note !== "string" || !note.trim()) continue
      await pool.query("INSERT INTO mednexus_theory_notes(id,user_id,collection_id,discipline_id,set_id,question_id,body) SELECT $1,$2,collection_id,discipline_id,set_id,id,$3 FROM mednexus_theory_questions WHERE id=$4 ON CONFLICT(user_id,question_id) DO UPDATE SET body=EXCLUDED.body,updated_at=NOW()", [crypto.randomUUID(), uid, note.trim(), questionId])
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[theory/sync POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
