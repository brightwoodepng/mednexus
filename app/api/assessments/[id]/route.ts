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

function rowToAssessment(row: Record<string, unknown>) {
  return {
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
}

// GET /api/assessments/[id]?token=[shareToken]
// Returns assessment + questions (by share_token for guests, or by id for admin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const token = req.headers.get("x-admin-token") ?? ""
    const isAdmin = verifyAdminToken(token)
    const shareToken = req.nextUrl.searchParams.get("token")

    let row: Record<string, unknown> | null = null

    if (isAdmin) {
      const res = await pool.query("SELECT * FROM mednexus_assessments WHERE id = $1", [id])
      row = res.rows[0] ?? null
    } else if (shareToken) {
      const res = await pool.query(
        "SELECT * FROM mednexus_assessments WHERE share_token = $1 AND status = 'live'",
        [shareToken]
      )
      row = res.rows[0] ?? null
    } else {
      const res = await pool.query(
        "SELECT * FROM mednexus_assessments WHERE id = $1 AND status = 'live'",
        [id]
      )
      row = res.rows[0] ?? null
    }

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const assessment = rowToAssessment(row)

    // Also return the actual question objects for the selected IDs
    const qRes = await pool.query("SELECT data FROM mednexus_questions WHERE id = 1")
    const allQuestions: Array<{ id: string }> = qRes.rows[0]?.data ?? []
    const questionIdSet = new Set(assessment.questionIds as string[])
    const questions = allQuestions.filter((q) => questionIdSet.has(q.id))

    return NextResponse.json({ assessment, questions })
  } catch (err) {
    console.error("[assessments/[id] GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PUT /api/assessments/[id] — admin only
// body: { status?, title?, timeLimitMins?, triesAllowed?, passMark? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get("x-admin-token") ?? ""
    if (!verifyAdminToken(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const body = await req.json()
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    if (body.status !== undefined) { fields.push(`status = $${i++}`); values.push(body.status) }
    if (body.title !== undefined) { fields.push(`title = $${i++}`); values.push(body.title) }
    if (body.timeLimitMins !== undefined) { fields.push(`time_limit_mins = $${i++}`); values.push(body.timeLimitMins) }
    if (body.triesAllowed !== undefined) { fields.push(`tries_allowed = $${i++}`); values.push(body.triesAllowed) }
    if (body.passMark !== undefined) { fields.push(`pass_mark = $${i++}`); values.push(body.passMark) }

    if (fields.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    values.push(id)
    await pool.query(`UPDATE mednexus_assessments SET ${fields.join(", ")} WHERE id = $${i}`, values)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[assessments/[id] PUT]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/assessments/[id] — admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get("x-admin-token") ?? ""
    if (!verifyAdminToken(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    await pool.query("DELETE FROM mednexus_assessment_attempts WHERE assessment_id = $1", [id])
    await pool.query("DELETE FROM mednexus_assessments WHERE id = $1", [id])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[assessments/[id] DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
