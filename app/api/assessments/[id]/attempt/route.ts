import { NextRequest, NextResponse } from "next/server"

async function getPool() {
  if (!process.env.DATABASE_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    return pool
  } catch { return null }
}

// GET /api/assessments/[id]/attempt?userId=[uid]
// Returns how many completed attempts this user has for this assessment
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const userId = req.nextUrl.searchParams.get("userId")
    if (!userId) return NextResponse.json({ count: 0, attempts: [] })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ count: 0, attempts: [] })

    const res = await pool.query(
      "SELECT * FROM mednexus_assessment_attempts WHERE assessment_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL ORDER BY started_at DESC",
      [id, userId]
    )

    const attempts = res.rows.map((row) => ({
      id: row.id,
      assessmentId: row.assessment_id,
      userId: row.user_id,
      userName: row.user_name,
      isGuest: row.is_guest,
      answers: row.answers,
      score: row.score,
      total: row.total,
      startedAt: row.started_at,
      submittedAt: row.submitted_at,
    }))

    return NextResponse.json({ count: attempts.length, attempts })
  } catch (err) {
    console.error("[attempt GET]", err)
    return NextResponse.json({ count: 0, attempts: [] })
  }
}

// POST /api/assessments/[id]/attempt
// body: { userId, userName, isGuest, answers }
// Submits or creates an attempt
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const body = await req.json()
    const { userId, userName, isGuest = false, answers = {} } = body

    if (!userId || !userName) {
      return NextResponse.json({ error: "userId and userName are required" }, { status: 400 })
    }

    // Check assessment exists and is live
    const asmtRes = await pool.query(
      "SELECT * FROM mednexus_assessments WHERE id = $1",
      [id]
    )
    const asmt = asmtRes.rows[0]
    if (!asmt) return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
    if (asmt.status !== "live") return NextResponse.json({ error: "Assessment is not live" }, { status: 403 })

    // Check tries limit for non-guests
    if (!isGuest) {
      const triesRes = await pool.query(
        "SELECT COUNT(*) FROM mednexus_assessment_attempts WHERE assessment_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL",
        [id, userId]
      )
      const tries = Number(triesRes.rows[0]?.count ?? 0)
      if (tries >= asmt.tries_allowed) {
        return NextResponse.json({ error: "No tries remaining" }, { status: 403 })
      }
    }

    // Compute score using stored question_ids
    const qRes = await pool.query("SELECT data FROM mednexus_questions WHERE id = 1")
    const allQuestions: Array<{ id: string; correctAnswer: string }> = qRes.rows[0]?.data ?? []
    const qMap = new Map(allQuestions.map((q) => [q.id, q]))

    let score = 0
    for (const qId of (asmt.question_ids as string[])) {
      const q = qMap.get(qId)
      if (q && answers[qId] === q.correctAnswer) score++
    }
    const total = (asmt.question_ids as string[]).length

    const attemptId = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    await pool.query(
      `INSERT INTO mednexus_assessment_attempts
         (id, assessment_id, user_id, user_name, is_guest, answers, score, total, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NOW())`,
      [attemptId, id, userId, userName, isGuest, JSON.stringify(answers), score, total]
    )

    return NextResponse.json({ success: true, attemptId, score, total })
  } catch (err) {
    console.error("[attempt POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
