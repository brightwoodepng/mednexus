import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import { measuredJson } from "@/lib/api-efficiency"
import { loadAssessmentQuestions } from "@/lib/assessment-questions"
import { isAssessmentGradingMode } from "@/lib/assessment-grading"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
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
    gradingMode: row.grading_mode ?? "standard",
    status: row.status,
    shareToken: row.share_token,
    createdAt: row.created_at,
  }
}

// GET /api/assessments/[id]?token=[shareToken]
// Returns assessment + questions (by share_token for guests, or by id for admin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const queryStartedAt = performance.now()
  try {
    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const canManageAssessments = Boolean(await requireAdminRequest(req, "manage_assessments"))
    const shareToken = req.nextUrl.searchParams.get("token")

    let row: Record<string, unknown> | null = null
    const projection = `id,title,module_name,question_ids,question_count,
      time_limit_mins,tries_allowed,pass_mark,grading_mode,status,share_token,created_at`

    if (canManageAssessments) {
      const res = await pool.query(`SELECT ${projection} FROM mednexus_assessments WHERE id = $1`, [id])
      row = res.rows[0] ?? null
    } else if (shareToken) {
      const res = await pool.query(
        `SELECT ${projection} FROM mednexus_assessments WHERE share_token = $1 AND status = 'live'`,
        [shareToken]
      )
      row = res.rows[0] ?? null
    } else {
      const res = await pool.query(
        `SELECT ${projection} FROM mednexus_assessments WHERE id = $1 AND status = 'live'`,
        [id]
      )
      row = res.rows[0] ?? null
    }

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const assessment = rowToAssessment(row)

    const questions = await loadAssessmentQuestions(
      pool,
      String(row.id),
      canManageAssessments ? "full" : "safe",
    )

    const payload = { assessment, questions }
    return measuredJson({
      route: "GET /api/assessments/[id]",
      queryStartedAt,
      rowCount: questions.length,
      payload,
    })
  } catch (err) {
    console.error("[assessments/[id] GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PUT /api/assessments/[id] — admin only
// body: { status?, title?, timeLimitMins?, triesAllowed?, passMark?, gradingMode? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminRequest(req, "manage_assessments")
    if (!admin) return await adminAccessDenied(req)

    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const body = await req.json()
    const fields: string[] = []
    const values: unknown[] = []
    let i = 1

    if (body.gradingMode !== undefined) {
      if (!isAssessmentGradingMode(body.gradingMode)) {
        return NextResponse.json({ error: "Invalid grading mode" }, { status: 400 })
      }
      fields.push(`grading_mode = $${i++}`)
      values.push(body.gradingMode)
    }

    if (body.status !== undefined) { fields.push(`status = $${i++}`); values.push(body.status) }
    if (body.title !== undefined) { fields.push(`title = $${i++}`); values.push(body.title) }
    if (body.timeLimitMins !== undefined) { fields.push(`time_limit_mins = $${i++}`); values.push(body.timeLimitMins) }
    if (body.triesAllowed !== undefined) { fields.push(`tries_allowed = $${i++}`); values.push(body.triesAllowed) }
    if (body.passMark !== undefined) { fields.push(`pass_mark = $${i++}`); values.push(body.passMark) }

    if (fields.length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    values.push(id)
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      if (body.gradingMode !== undefined) {
        await client.query("SELECT id FROM mednexus_assessments WHERE id = $1 FOR UPDATE", [id])
        const submitted = await client.query(
          "SELECT 1 FROM mednexus_assessment_attempts WHERE assessment_id = $1 AND submitted_at IS NOT NULL LIMIT 1",
          [id],
        )
        if (submitted.rows.length) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Grading cannot be changed after the first submission" }, { status: 409 })
        }
      }
      await client.query(`UPDATE mednexus_assessments SET ${fields.join(", ")} WHERE id = $${i}`, values)
      await auditAdmin(client, admin.uid, "update", "assessment", id, body)
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally { client.release() }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[assessments/[id] PUT]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/assessments/[id] — admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdminRequest(req, "manage_assessments")
    if (!admin) return await adminAccessDenied(req)
    if (req.nextUrl.searchParams.get("confirm") !== "true") return NextResponse.json({ error: "Confirmation required." }, { status: 400 })

    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await auditAdmin(client, admin.uid, "delete", "assessment", id)
      await client.query("DELETE FROM mednexus_assessment_attempts WHERE assessment_id = $1", [id])
      await client.query("DELETE FROM mednexus_guest_analytics WHERE assessment_id = $1", [id])
      await client.query("DELETE FROM mednexus_assessments WHERE id = $1", [id])
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally { client.release() }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[assessments/[id] DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
