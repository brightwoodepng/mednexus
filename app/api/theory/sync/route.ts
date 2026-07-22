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

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[theory/sync POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
