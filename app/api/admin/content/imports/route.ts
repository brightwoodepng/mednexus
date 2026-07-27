import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"

export async function GET(req: NextRequest) {
  const canMcq = await requireAdminRequest(req, "manage_mcq_content")
  const canTheory = await requireAdminRequest(req, "manage_theory_content")
  if (!canMcq && !canTheory) return adminAccessDenied(req)
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const bank = req.nextUrl.searchParams.get("bank")
  const values: string[] = []
  const where = bank === "mcq" || bank === "theory" ? (values.push(bank), "WHERE bank=$1") : ""
  const result = await pool.query(`SELECT id,bank,source_name,status,total_count,valid_count,error_count,validation_errors,created_by,created_at,updated_at,committed_at FROM mednexus_content_import_jobs ${where} ORDER BY created_at DESC LIMIT 100`, values)
  return NextResponse.json({ jobs: result.rows.map((row) => ({
    id: row.id, bank: row.bank, sourceName: row.source_name, status: row.status,
    totalCount: row.total_count, validCount: row.valid_count, errorCount: row.error_count,
    errors: row.validation_errors, actorId: row.created_by, createdAt: row.created_at,
    updatedAt: row.updated_at, committedAt: row.committed_at,
  })) })
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { bank?: string; sourceName?: string; drafts?: unknown[]; errors?: unknown[] }
  const bank = body.bank === "theory" ? "theory" : "mcq"
  const permission = bank === "theory" ? "manage_theory_content" : "manage_mcq_content"
  const admin = await requireAdminRequest(req, permission)
  if (!admin) return adminAccessDenied(req)
  if (!Array.isArray(body.drafts) || body.drafts.length === 0 || body.drafts.length > 1000) return NextResponse.json({ error: "Provide 1–1000 parsed drafts." }, { status: 400 })
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const existingIds = new Set<string>()
  if (bank === "mcq") {
    const bankResult = await pool.query("SELECT data FROM mednexus_questions WHERE id=1")
    for (const question of bankResult.rows[0]?.data ?? []) existingIds.add(String(question.id))
  } else {
    const theoryResult = await pool.query("SELECT id FROM mednexus_theory_questions")
    for (const question of theoryResult.rows) existingIds.add(String(question.id))
  }
  const seen = new Set<string>()
  const errors: Array<{ index: number; message: string }> = Array.isArray(body.errors) ? body.errors as Array<{ index: number; message: string }> : []
  const drafts = body.drafts.map((draft, index) => {
    const record = draft && typeof draft === "object" ? draft as Record<string, unknown> : {}
    const id = String(record.id ?? (bank === "theory" ? `theory-staged-${record.sourceOrder ?? index}` : ""))
    if (!id) errors.push({ index, message: "Question ID is missing." })
    else if (existingIds.has(id) || seen.has(id)) errors.push({ index, message: `Duplicate question ID: ${id}` })
    seen.add(id)
    return { ...record, id, importStatus: "draft", importIndex: index }
  })
  const id = `import-${randomUUID()}`
  await pool.query(`INSERT INTO mednexus_content_import_jobs(id,bank,source_name,source_type,status,total_count,valid_count,error_count,validation_errors,draft_payload,created_by) VALUES($1,$2,$3,'parsed','review',$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
    [id, bank, String(body.sourceName || "Imported content").slice(0, 255), drafts.length, Math.max(0, drafts.length - errors.length), errors.length, JSON.stringify(errors), JSON.stringify(drafts), admin.uid])
  await auditAdmin(pool, admin.uid, "stage", `${bank}_import`, id, { total: drafts.length, errors: errors.length })
  return NextResponse.json({ id, status: "review", totalCount: drafts.length, errorCount: errors.length }, { status: 201 })
}
