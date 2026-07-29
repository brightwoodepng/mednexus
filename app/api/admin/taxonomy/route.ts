import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import { measuredJson } from "@/lib/api-efficiency"

type Mcq = { id: string; module?: string; subject?: string; [key: string]: unknown }

export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  if (!await requireAdminRequest(req, "manage_mcq_content")) return adminAccessDenied(req)
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const result = await pool.query<{ module_name: string; discipline: string; question_count: number }>(
    `SELECT
       COALESCE(NULLIF(BTRIM(question.value->>'module'), ''), 'Unassigned') AS module_name,
       COALESCE(NULLIF(BTRIM(question.value->>'subject'), ''), 'Unassigned') AS discipline,
       COUNT(*)::int AS question_count
     FROM mednexus_questions source
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb)) question(value)
     WHERE source.id=1
     GROUP BY 1,2
     ORDER BY 1,2`,
  )
  const grouped = new Map<string, Array<{ name: string; questionCount: number }>>()
  for (const row of result.rows) {
    const disciplines = grouped.get(row.module_name) ?? []
    disciplines.push({ name: row.discipline, questionCount: Number(row.question_count) })
    grouped.set(row.module_name, disciplines)
  }
  const modules = [...grouped].map(([name, disciplines]) => ({
    name,
    questionCount: disciplines.reduce((sum, item) => sum + item.questionCount, 0),
    disciplines,
  }))
  return measuredJson({
    route: "GET /api/admin/taxonomy",
    queryStartedAt,
    rowCount: result.rows.length,
    payload: { modules },
  }, { headers: { "Cache-Control": "private, max-age=60" } })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)
  const body = await req.json() as { action?: string; module?: string; discipline?: string; newName?: string; destinationModule?: string; destinationDiscipline?: string; confirm?: boolean }
  if (!body.confirm) return NextResponse.json({ error: "Confirmation required." }, { status: 400 })
  const action = body.action ?? ""
  if (!["rename_module", "rename_discipline", "move_discipline", "delete_module", "delete_discipline"].includes(action)) return NextResponse.json({ error: "Unsupported taxonomy action." }, { status: 400 })
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await client.query("SELECT data FROM mednexus_questions WHERE id=1 FOR UPDATE")
    const questions: Mcq[] = result.rows[0]?.data ?? []
    let affected = 0
    const next = questions.map((question) => {
      const moduleName = question.module?.trim() || "Unassigned"
      const discipline = question.subject?.trim() || "Unassigned"
      if (action === "rename_module" && moduleName === body.module) { affected++; return { ...question, module: body.newName?.trim() } }
      if (action === "rename_discipline" && moduleName === body.module && discipline === body.discipline) { affected++; return { ...question, subject: body.newName?.trim() } }
      if (action === "move_discipline" && moduleName === body.module && discipline === body.discipline) { affected++; return { ...question, module: body.destinationModule?.trim(), subject: body.destinationDiscipline?.trim() || discipline } }
      return question
    })
    if (action.startsWith("delete_")) {
      const count = questions.filter((question) => (question.module?.trim() || "Unassigned") === body.module && (action === "delete_module" || (question.subject?.trim() || "Unassigned") === body.discipline)).length
      if (count > 0) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This group still contains questions. Reassign them before deletion." }, { status: 409 }) }
    } else {
      if (!affected) { await client.query("ROLLBACK"); return NextResponse.json({ error: "No matching questions were found." }, { status: 404 }) }
      if (!body.newName?.trim() && action !== "move_discipline") { await client.query("ROLLBACK"); return NextResponse.json({ error: "A new name is required." }, { status: 400 }) }
      if (action === "move_discipline" && !body.destinationModule?.trim()) { await client.query("ROLLBACK"); return NextResponse.json({ error: "A destination module is required." }, { status: 400 }) }
      await client.query("UPDATE mednexus_questions SET data=$1::jsonb,updated_at=NOW() WHERE id=1", [JSON.stringify(next)])
    }
    await auditAdmin(client, admin.uid, action!, "mcq_taxonomy", body.discipline || body.module || null, { ...body, confirm: undefined, affected })
    await client.query("COMMIT")
    return NextResponse.json({ success: true, affected })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[admin/taxonomy]", error)
    return NextResponse.json({ error: "Taxonomy was not changed." }, { status: 500 })
  } finally { client.release() }
}
