import { NextRequest, NextResponse } from "next/server"

async function getPool() {
  if (!process.env.DATABASE_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
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
      "SELECT * FROM mednexus_assessments WHERE share_token = $1",
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
      status: row.status,
      shareToken: row.share_token,
      createdAt: row.created_at,
    }

    // Return assessment regardless of status so guest page can show "unavailable"
    if (row.status !== "live") {
      return NextResponse.json({ assessment, questions: [] })
    }

    // Fetch question objects
    const qRes = await pool.query("SELECT data FROM mednexus_questions WHERE id = 1")
    const allQuestions: Array<{ id: string }> = qRes.rows[0]?.data ?? []
    const questionIdSet = new Set(assessment.questionIds as string[])
    const questions = allQuestions.filter((q) => questionIdSet.has(q.id))

    return NextResponse.json({ assessment, questions })
  } catch (err) {
    console.error("[by-token GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
