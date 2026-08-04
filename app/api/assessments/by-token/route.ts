import { NextRequest, NextResponse } from "next/server"
import { loadAssessmentQuestions } from "@/lib/assessment-questions"
import { assessmentErrorResponse } from "@/lib/assessment-api-errors"
import { assessmentGradingModeSql } from "@/lib/assessment-grading"
import { randomUUID } from "crypto"
import { createAssessmentParticipantToken } from "@/lib/assessment-participant-token"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool } = await import("@/lib/db")
    return pool
  } catch { return null }
}

// GET /api/assessments/by-token?token=[shareToken]
// Returns assessment + questions for guest exam pages
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const res = await pool.query(
      `SELECT id,title,module_name,question_ids,question_count,
        time_limit_mins,tries_allowed,pass_mark,
        ${assessmentGradingModeSql("mednexus_assessments")} AS grading_mode,
        status,share_token,created_at
       FROM mednexus_assessments WHERE share_token = $1`,
      [token]
    )
    const row = res.rows[0]
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const assessment = {
      id: row.id,
      title: row.title,
      moduleName: row.module_name,
      questionIds: row.question_ids,
      questionCount: row.question_count,
      timeLimitMins: row.time_limit_mins,
      triesAllowed: row.tries_allowed,
      passMark: row.pass_mark,
      gradingMode: row.grading_mode ?? "standard",
      status: row.status,
      shareToken: row.share_token,
      createdAt: row.created_at,
    }

    // Return assessment regardless of status so guest page can show "unavailable"
    if (row.status !== "live") {
      return NextResponse.json({ assessment, questions: [] })
    }

    const questions = await loadAssessmentQuestions(pool, row.id, "safe")

    return NextResponse.json({ assessment, questions })
  } catch (err) {
    console.error("[by-token GET]", err)
    return assessmentErrorResponse(err)
  }
}

// Creates an assessment-scoped external participant. This is deliberately not
// an application guest account and does not write to a user/profile table.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { token?: unknown; name?: unknown } | null
    const shareToken = typeof body?.token === "string" ? body.token.trim() : ""
    const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 120) : ""
    if (!shareToken || !name) return NextResponse.json({ error: "Assessment link and participant name are required." }, { status: 400 })
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "The assessment database is not configured." }, { status: 503 })
    const result = await pool.query("SELECT id,status FROM mednexus_assessments WHERE share_token=$1", [shareToken])
    const assessment = result.rows[0]
    if (!assessment || assessment.status !== "live") return NextResponse.json({ error: "This assessment link is unavailable." }, { status: 404 })
    const participantId = `assessment_${randomUUID()}`
    const participantToken = createAssessmentParticipantToken({ participantId, assessmentId: assessment.id, name })
    return NextResponse.json({ participantId, name, participantToken }, { status: 201 })
  } catch (error) {
    console.error("[by-token POST]", error)
    return assessmentErrorResponse(error)
  }
}
