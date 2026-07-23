import { NextRequest, NextResponse } from "next/server"
import { forbidden, getRequestAuth, unauthorized } from "@/lib/request-auth"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool } = await import("@/lib/db")
    return pool
  } catch { return null }
}

// POST /api/assessments/[id]/guest-analytics
// Receives a single analytics payload from a guest after they finish an exam.
// Writes to mednexus_guest_analytics only — no link to any user profile.
// Body: { guestName, score, total, percentage, passed, timeTakenSecs }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getRequestAuth(req, { allowGuest: true })
    if (!auth) return unauthorized()
    if (!auth.isGuest) return forbidden()
    const { id } = await params
    const body = await req.json()
    const {
      score,
      total,
      percentage,
      passed,
      timeTakenSecs,
    } = body

    if (typeof score !== "number" || typeof total !== "number") {
      return NextResponse.json({ error: "score and total are required" }, { status: 400 })
    }

    const pool = await getPool()
    // If there's no DB, silently succeed — the guest still sees their local result.
    if (!pool) return NextResponse.json({ success: true, stored: false })

    // Confirm the assessment exists and is live
    const asmtRes = await pool.query(
      "SELECT title, status FROM mednexus_assessments WHERE id = $1",
      [id]
    )
    const asmt = asmtRes.rows[0]
    if (!asmt) return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    if (asmt.status !== "live") return NextResponse.json({ error: "Assessment is not live" }, { status: 403 })

    const rowId = `ga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    await pool.query(
      `INSERT INTO mednexus_guest_analytics
         (id, assessment_id, assessment_title, guest_name, type,
          score, total, percentage, passed, time_taken_secs, submitted_at)
       VALUES ($1,$2,$3,$4,'guest',$5,$6,$7,$8,$9,NOW())`,
      [
        rowId,
        id,
        asmt.title,
        "Guest",
        score,
        total,
        percentage ?? (total > 0 ? Math.round((score / total) * 100) : 0),
        passed ?? false,
        timeTakenSecs ?? null,
      ]
    )

    return NextResponse.json({ success: true, stored: true, id: rowId })
  } catch (err) {
    console.error("[guest-analytics POST]", err)
    // Return success anyway — a failed analytics write must never break the guest's result screen.
    return NextResponse.json({ success: true, stored: false })
  }
}
