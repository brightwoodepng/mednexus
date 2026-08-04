import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { assessmentPercentage } from "@/lib/assessment-grading"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool } = await import("@/lib/db")
    return pool
  } catch { return null }
}

// GET /api/assessments/[id]/analytics — admin only
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdminRequest(req, "manage_assessments")) return await adminAccessDenied(req)

    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    // Get assessment to find pass_mark
    const asmtRes = await pool.query("SELECT pass_mark, tries_allowed, grading_mode FROM mednexus_assessments WHERE id = $1", [id])
    if (!asmtRes.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const { pass_mark, tries_allowed, grading_mode } = asmtRes.rows[0]

    // ── Registered user attempts ──────────────────────────────────────────────
    // Fetch all submitted attempts from the registered-user table.
    const attRes = await pool.query(
      `SELECT user_id, user_name, false AS is_guest, score, total, submitted_at
       FROM mednexus_assessment_attempts
       WHERE assessment_id = $1 AND submitted_at IS NOT NULL`,
      [id]
    )

    // Deduplicate registered users: keep personal best only.
    type RegRow = { user_id: string; user_name: string; is_guest: boolean; score: number; total: number; submitted_at: string }
    const bestByUser = attRes.rows.reduce<Map<string, RegRow>>((acc, row) => {
      const existing = acc.get(row.user_id)
      if (!existing || row.score > existing.score) acc.set(row.user_id, row)
      return acc
    }, new Map())
    const registeredRows = Array.from(bestByUser.values())

    // ── Guest analytics ───────────────────────────────────────────────────────
    // Deduplicate guests by name — keep only their personal best score.
    // Guests who take multiple tries would otherwise appear once per attempt.
    const guestRes = await pool.query(
      `SELECT guest_name AS user_name, true AS is_guest, score, total, submitted_at
       FROM mednexus_guest_analytics
       WHERE assessment_id = $1`,
      [id]
    )
    type GuestRow = { user_name: string; is_guest: boolean; score: number; total: number; submitted_at: string }
    const bestByGuestName = guestRes.rows.reduce<Map<string, GuestRow>>((acc, row) => {
      const existing = acc.get(row.user_name)
      if (!existing || row.score > existing.score) acc.set(row.user_name, row)
      return acc
    }, new Map())
    const guestRows: GuestRow[] = Array.from(bestByGuestName.values())

    // ── Merge for aggregated stats ────────────────────────────────────────────
    const allRows = [
      ...registeredRows.map((r) => ({ userName: r.user_name, isGuest: false, score: r.score, total: r.total, submittedAt: r.submitted_at })),
      ...guestRows.map((r) => ({ userName: r.user_name, isGuest: true, score: r.score, total: r.total, submittedAt: r.submitted_at })),
    ]

    const totalSubmitted  = allRows.length
    const guestCount      = guestRows.length
    const registeredCount = registeredRows.length
    const uniqueUsers     = registeredRows.length + guestRows.length  // guests each count as unique

    const scores = allRows.map((r) => assessmentPercentage(r.score, r.total))
    const averageScore  = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const passCount     = scores.filter((s) => s >= pass_mark).length
    const failCount     = scores.filter((s) => s < pass_mark).length
    const highestScore  = scores.length > 0 ? Math.max(...scores) : 0
    const lowestScore   = scores.length > 0 ? Math.min(...scores) : 0

    // Median
    const pctSorted = [...scores].sort((a, b) => a - b)
    const mid = Math.floor(pctSorted.length / 2)
    const medianScore = pctSorted.length === 0 ? 0
      : pctSorted.length % 2 === 0 ? Math.round((pctSorted[mid - 1] + pctSorted[mid]) / 2)
      : pctSorted[mid]

    // Sort high → low for the leaderboard view
    const recentAttempts = allRows
      .sort((a, b) => b.score - a.score)
      .map((r) => ({
        userName: r.userName,
        isGuest: r.isGuest,
        score: r.score,
        total: r.total,
        percentage: assessmentPercentage(r.score, r.total),
        submittedAt: r.submittedAt,
      }))

    return NextResponse.json({
      analytics: {
        totalSubmitted,
        uniqueParticipants: uniqueUsers,
        averageScore,
        passCount,
        failCount,
        highestScore,
        lowestScore,
        medianScore,
        guestCount,
        registeredCount,
        passMark: pass_mark,
        triesAllowed: tries_allowed,
        gradingMode: grading_mode ?? "standard",
      },
      recentAttempts,
    })
  } catch (err) {
    console.error("[analytics GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
