import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"

function cell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"` }

export async function GET(req: NextRequest) {
  const bank = req.nextUrl.searchParams.get("bank") === "theory" ? "theory" : "mcq"
  const permission = bank === "theory" ? "manage_theory_content" : "manage_mcq_content"
  const admin = await requireAdminRequest(req, permission)
  if (!admin) return adminAccessDenied(req)
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json"
  const moduleFilter = (req.nextUrl.searchParams.get("module") ?? "").trim()
  const statusFilter = (req.nextUrl.searchParams.get("status") ?? "").trim()
  const ids = [...new Set(req.nextUrl.searchParams.getAll("id").map((id) => id.trim()).filter(Boolean))].slice(0, 500)
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  let records: Array<Record<string, unknown>>
  if (bank === "mcq") {
    const result = await pool.query("SELECT data FROM mednexus_questions WHERE id=1")
    records = (result.rows[0]?.data ?? []).filter((question: Record<string, unknown>) =>
      (!moduleFilter || question.module === moduleFilter || question.subject === moduleFilter)
      && (!statusFilter || question.status === statusFilter || question.moduleStatus === statusFilter)
      && (!ids.length || ids.includes(String(question.id))))
  } else {
    const result = await pool.query(`
      SELECT q.id,q.title,q.prompt,q.model_answer,q.key_marking_points,q.tags,q.media,q.marks,q.status,q.sort_order,
        c.title AS collection,COALESCE(m.name,d.name) AS group_name,s.name AS set_name
      FROM mednexus_theory_questions q JOIN mednexus_theory_collections c ON c.id=q.collection_id
      LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
      LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
      LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
      WHERE ($1='' OR COALESCE(m.name,d.name)=$1) AND ($2='' OR q.status=$2)
      ORDER BY c.sort_order,COALESCE(m.sort_order,d.sort_order),s.sort_order,q.sort_order`, [moduleFilter, statusFilter])
    records = result.rows
  }
  await auditAdmin(pool, admin.uid, "export", `${bank}_content`, null, { format, records: records.length, moduleFilter, statusFilter, selectedIds: ids.length })
  if (format === "json") return new Response(JSON.stringify({ bank, exportedAt: new Date().toISOString(), records }, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="mednexus-${bank}-export.json"` } })
  const columns = bank === "mcq" ? ["id", "module", "subject", "vignette", "correctAnswer", "moduleStatus"] : ["id", "collection", "group_name", "set_name", "title", "prompt", "model_answer", "marks", "status"]
  const csv = [columns.map(cell).join(","), ...records.map((record) => columns.map((column) => cell(typeof record[column] === "object" ? JSON.stringify(record[column]) : record[column])).join(","))].join("\r\n")
  return new Response(`\uFEFF${csv}`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="mednexus-${bank}-export.csv"` } })
}
