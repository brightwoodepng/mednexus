import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken } from "@/lib/admin-auth"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    return pool
  } catch { return null }
}

// GET /api/assessments/[id]/analytics — admin only
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get("x-admin-token") ?? ""
    if (!verifyAdminToken(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    // Get assessment to find pass_mark
    const asmtRes = await pool.query("SELECT pass_mark, tries_allowed FROM mednexus_assessments WHERE id = $1", [id])
    if (!asmtRes.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const { pass_mark, tries_allowed } = asmtRes.rows[0]

    // Fetch all submitted attempts (all columns needed for deduplication)
    const attRes = await pool.query(
      `SELECT user_id, user_name, is_guest, score, total, submitted_at
       FROM mednexus_assessment_attempts
       WHERE assessment_id = $1 AND submitted_at IS NOT NULL`,
      [id]
    )

    // ── Deduplicate: one entry per user, keeping their personal best score ────
    // Uses a Map keyed on user_id so the reduce is O(n) and stable.
    type Row = typeof attRes.rows[0]
    const bestByUser = attRes.rows.reduce<Map<string, Row>>((acc, row) => {
      const existing = acc.get(row.user_id)
      if (!existing || row.score > existing.score) {
        acc.set(row.user_id, row)
      }
      return acc
    }, new Map())

    const dedupedRows = Array.from(bestByUser.values())

    // ── All stats computed from the deduplicated set ──────────────────────────
    const totalSubmitted = dedupedRows.length           // one entry per unique user
    const guestCount = dedupedRows.filter((r) => r.is_guest).length
    const registeredCount = dedupedRows.filter((r) => !r.is_guest).length
    const uniqueUsers = totalSubmitted                  // by definition after dedup

    const scores = dedupedRows.map((r) => (r.total > 0 ? Math.round((r.score / r.total) * 100) : 0))
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const passCount = scores.filter((s) => s >= pass_mark).length
    const failCount = scores.filter((s) => s < pass_mark).length
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0
    const lowestScore = scores.length > 0 ? Math.min(...scores) : 0

    // Median
    const pctSorted = [...scores].sort((a, b) => a - b)
    const mid = Math.floor(pctSorted.length / 2)
    const medianScore = pctSorted.length === 0 ? 0
      : pctSorted.length % 2 === 0 ? Math.round((pctSorted[mid - 1] + pctSorted[mid]) / 2)
      : pctSorted[mid]

    // ── Return deduplicated attempts sorted high → low (no second DB query) ──
    const allAttempts = dedupedRows
      .sort((a, b) => b.score - a.score)
      .map((r) => ({
        userName: r.user_name,
        isGuest: r.is_guest,
        score: r.score,
        total: r.total,
        percentage: r.total > 0 ? Math.round((r.score / r.total) * 100) : 0,
        submittedAt: r.submitted_at,
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
      },
      recentAttempts: allAttempts,
    })
  } catch (err) {
    console.error("[analytics GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
