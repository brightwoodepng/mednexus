import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import { measuredJson } from "@/lib/api-efficiency"

export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  if (!await requireAdminRequest(req, "manage_mcq_content")) return adminAccessDenied(req)
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    const result = await pool.query<{ module_name: string; discipline: string; question_count: number }>(
      `SELECT
         COALESCE(NULLIF(BTRIM(question.value->>'module'), ''), NULLIF(BTRIM(question.value->>'subject'), ''), 'Unassigned') AS module_name,
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
    }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[admin/taxonomy GET]", error)
    return NextResponse.json(
      { error: "Modules and disciplines are temporarily unavailable. Retry after checking the database connection." },
      { status: 503 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)
  let body: { action?: string; module?: string; discipline?: string; newName?: string; destinationModule?: string; destinationDiscipline?: string; confirm?: boolean; allowMerge?: boolean }
  try {
    const value = await req.json()
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request.")
    body = value
  } catch { return NextResponse.json({ error: "Send a valid JSON object." }, { status: 400 }) }
  if (body.confirm !== true) return NextResponse.json({ error: "Confirmation required." }, { status: 400 })
  const action = body.action ?? ""
  if (!["rename_module", "rename_discipline", "move_discipline", "delete_module", "delete_discipline"].includes(action)) return NextResponse.json({ error: "Unsupported taxonomy action." }, { status: 400 })
  const validName = (value: unknown) => typeof value === "string" && Boolean(value.trim()) && value.trim().length <= 160
  if (!validName(body.module) || (!["rename_module", "delete_module"].includes(action) && !validName(body.discipline))) {
    return NextResponse.json({ error: "Choose a valid module and discipline." }, { status: 400 })
  }
  if (action.startsWith("rename_") && !validName(body.newName)) return NextResponse.json({ error: "Enter a name of 1–160 characters." }, { status: 400 })
  if (action === "move_discipline" && (!validName(body.destinationModule) || (body.destinationDiscipline != null && !validName(body.destinationDiscipline)))) return NextResponse.json({ error: "Choose a valid destination." }, { status: 400 })
  body.module = body.module!.trim()
  if (body.discipline) body.discipline = body.discipline.trim()
  if (body.newName) body.newName = body.newName.trim()
  if (body.destinationModule) body.destinationModule = body.destinationModule.trim()
  if (body.destinationDiscipline) body.destinationDiscipline = body.destinationDiscipline.trim()
  if ((action === "rename_module" && body.newName === body.module)
    || (action === "rename_discipline" && body.newName === body.discipline)
    || (action === "move_discipline" && body.destinationModule === body.module && (!body.destinationDiscipline || body.destinationDiscipline === body.discipline))) {
    return NextResponse.json({ error: "Choose a different name or destination." }, { status: 400 })
  }
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT updated_at FROM mednexus_questions WHERE id=1 FOR UPDATE")
    const match = `COALESCE(NULLIF(BTRIM(item.value->>'module'), ''), NULLIF(BTRIM(item.value->>'subject'), ''), 'Unassigned')=$1
      AND ($2::text IS NULL OR COALESCE(NULLIF(BTRIM(item.value->>'subject'), ''), 'Unassigned')=$2)`
    const discipline = action === "rename_module" || action === "delete_module" ? null : body.discipline ?? null
    const countResult = await client.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
       WHERE source.id=1 AND ${match}`,
      [body.module, discipline],
    )
    const affected = Number(countResult.rows[0]?.count ?? 0)
    if (action.startsWith("delete_")) {
      if (affected > 0) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This group still contains questions. Reassign them before deletion." }, { status: 409 }) }
    } else {
      if (!affected) { await client.query("ROLLBACK"); return NextResponse.json({ error: "No matching questions were found." }, { status: 404 }) }
      const destinationModule = action === "rename_module" ? body.newName : action === "move_discipline" ? body.destinationModule : body.module
      const destinationDiscipline = action === "rename_module" ? null : action === "rename_discipline" ? body.newName : body.destinationDiscipline ?? body.discipline
      const destination = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM mednexus_questions source
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
         WHERE source.id=1 AND ${match}`, [destinationModule, destinationDiscipline],
      )
      if (Number(destination.rows[0]?.count ?? 0) > 0 && body.allowMerge !== true) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "The destination group already exists. Confirm combining the groups.", requiresMerge: true }, { status: 409 })
      }
      if (!body.newName?.trim() && action !== "move_discipline") { await client.query("ROLLBACK"); return NextResponse.json({ error: "A new name is required." }, { status: 400 }) }
      if (action === "move_discipline" && !body.destinationModule?.trim()) { await client.query("ROLLBACK"); return NextResponse.json({ error: "A destination module is required." }, { status: 400 }) }
      const replacement = action === "rename_module"
        ? `jsonb_set(item.value, '{module}', to_jsonb($3::text), true)`
        : action === "rename_discipline"
          ? `jsonb_set(jsonb_set(item.value, '{module}', to_jsonb($1::text), true), '{subject}', to_jsonb($3::text), true)`
          : `jsonb_set(jsonb_set(item.value, '{module}', to_jsonb($3::text), true),
              '{subject}', to_jsonb(COALESCE(NULLIF($4::text,''), item.value->>'subject')), true)`
      const updateParameters = action === "move_discipline"
        ? [body.module, discipline, body.destinationModule?.trim() ?? null, body.destinationDiscipline?.trim() ?? null]
        : [body.module, discipline, body.newName?.trim() ?? null]
      await client.query(
        `UPDATE mednexus_questions source
         SET data=(
           SELECT jsonb_agg(
             CASE WHEN ${match} THEN ${replacement} ELSE item.value END
             ORDER BY item.ordinality
           )
           FROM jsonb_array_elements(COALESCE(source.data,'[]'::jsonb))
             WITH ORDINALITY item(value,ordinality)
         ),updated_at=NOW()
         WHERE source.id=1`,
        updateParameters,
      )
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
