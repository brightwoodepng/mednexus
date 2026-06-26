import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken } from "@/lib/admin-auth"

async function getPool() {
  if (!process.env.DATABASE_URL) return null
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

    // Get all submitted attempts
    const attRes = await pool.query(
      "SELECT user_id, user_name, is_guest, score, total FROM mednexus_assessment_attempts WHERE assessment_id = $1 AND submitted_at IS NOT NULL",
      [id]
    )
    const rows = attRes.rows

    const totalSubmitted = rows.length
    const guestCount = rows.filter((r) => r.is_guest).length
    const registeredCount = rows.filter((r) => !r.is_guest).length

    const scores = rows.map((r) => (r.total > 0 ? Math.round((r.score / r.total) * 100) : 0))
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const passCount = scores.filter((s) => s >= pass_mark).length

    // Unique participants (by user_id)
    const uniqueUsers = new Set(rows.map((r) => r.user_id)).size

    // Recent attempts (last 20)
    const recentRes = await pool.query(
      `SELECT user_name, is_guest, score, total, submitted_at
       FROM mednexus_assessment_attempts
       WHERE assessment_id = $1 AND submitted_at IS NOT NULL
       ORDER BY submitted_at DESC LIMIT 20`,
      [id]
    )
    const recentAttempts = recentRes.rows.map((r) => ({
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
        guestCount,
        registeredCount,
        passMark: pass_mark,
        triesAllowed: tries_allowed,
      },
      recentAttempts,
    })
  } catch (err) {
    console.error("[analytics GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
