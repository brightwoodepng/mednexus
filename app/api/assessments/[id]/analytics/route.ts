import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { assessmentGradingModeSql, assessmentPercentage } from "@/lib/assessment-grading"
import { bestAttempts, loadAttempts } from "@/lib/admin-results"
import { optionalRuntimePool } from "@/lib/runtime-db"
import { assessmentErrorResponse } from "@/lib/assessment-api-errors"

async function getPool() {
  return optionalRuntimePool()
}

// GET /api/assessments/[id]/analytics — admin only
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireAdminRequest(req, "manage_assessments")) return await adminAccessDenied(req)

    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    // Get assessment to find pass_mark
    const asmtRes = await pool.query(`SELECT pass_mark, tries_allowed,
      ${assessmentGradingModeSql("mednexus_assessments")} AS grading_mode
      FROM mednexus_assessments WHERE id = $1`, [id])
    if (!asmtRes.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const { pass_mark, tries_allowed, grading_mode } = asmtRes.rows[0]

    // Modern registered and guest attempts share one authoritative table.
    // The shared loader also folds in legacy guest rows without double counting.
    const allRows = bestAttempts(await loadAttempts(pool, id)).map((attempt) => ({
      userName: attempt.participantName,
      isGuest: attempt.isGuest,
      score: attempt.score,
      total: attempt.total,
      submittedAt: attempt.submittedAt,
    }))

    const totalSubmitted  = allRows.length
    const guestCount = allRows.filter(row => row.isGuest).length
    const registeredCount = allRows.length - guestCount
    const uniqueUsers = allRows.length

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
    return assessmentErrorResponse(err)
  }
}
