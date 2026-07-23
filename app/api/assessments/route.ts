import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/admin-access"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool } = await import("@/lib/db")
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

// GET /api/assessments
// Public: returns live assessments only
// Administrators receive the management view after a server-verified role check
export async function GET(req: NextRequest) {
  try {
    const pool = await getPool()
    if (!pool) return NextResponse.json({ assessments: [] })

    const isAdmin = Boolean(await requireAdminRequest(req, "manage_assessments"))

    const { rows } = isAdmin
      ? await pool.query("SELECT * FROM mednexus_assessments ORDER BY created_at DESC")
      : await pool.query("SELECT * FROM mednexus_assessments WHERE status = 'live' ORDER BY created_at DESC")

    return NextResponse.json({ assessments: rows.map(rowToAssessment) })
  } catch (err) {
    console.error("[assessments GET]", err)
    return NextResponse.json({ assessments: [] })
  }
}

// POST /api/assessments — admin only
// body: { title, moduleName, questionCount, timeLimitMins, triesAllowed, passMark }
export async function POST(req: NextRequest) {
  try {
    if (!await requireAdminRequest(req, "manage_assessments")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const body = await req.json()
    const { title, moduleName, questionCount, timeLimitMins, triesAllowed, passMark } = body

    if (!title?.trim() || !moduleName?.trim()) {
      return NextResponse.json({ error: "title and moduleName are required" }, { status: 400 })
    }

    const qCount = Math.max(1, Number(questionCount) || 10)

    // Fetch questions from DB to pick IDs for this module
    const qRes = await pool.query("SELECT data FROM mednexus_questions WHERE id = 1")
    const allQuestions: Array<{ id: string; module?: string; subject: string }> = qRes.rows[0]?.data ?? []
    const moduleQs = allQuestions.filter(
      (q) => (q.module?.trim() || q.subject) === moduleName
    )

    if (moduleQs.length === 0) {
      return NextResponse.json({ error: "No questions found for this module" }, { status: 400 })
    }

    // Deduplicate by id before shuffling so the stored question_ids array is always unique
    const seen = new Set<string>()
    const uniqueModuleQs = moduleQs.filter((q) => {
      if (seen.has(q.id)) return false
      seen.add(q.id)
      return true
    })

    // Randomly select up to qCount questions
    const shuffled = [...uniqueModuleQs].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(qCount, shuffled.length))
    const questionIds = selected.map((q) => q.id)

    const id = `asmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const shareToken = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

    await pool.query(
      `INSERT INTO mednexus_assessments
         (id, title, module_name, question_ids, question_count, time_limit_mins, tries_allowed, pass_mark, status, share_token)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,'offline',$9)`,
      [id, title.trim(), moduleName, JSON.stringify(questionIds), questionIds.length, Number(timeLimitMins) || 30, Number(triesAllowed) || 1, Number(passMark) || 50, shareToken]
    )

    return NextResponse.json({ success: true, id, shareToken })
  } catch (err) {
    console.error("[assessments POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
