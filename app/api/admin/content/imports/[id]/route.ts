import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { default: pool } = await import("@/lib/db")
  const result = await pool.query(
    `SELECT id,bank,source_name,status,total_count,valid_count,error_count,
      validation_errors,draft_payload,created_at
     FROM mednexus_content_import_jobs WHERE id=$1`,
    [id],
  )
  const job = result.rows[0]
  if (!job) return NextResponse.json({ error: "Import job not found" }, { status: 404 })
  const permission = job.bank === "theory" ? "manage_theory_content" : "manage_mcq_content"
  if (!await requireAdminRequest(req, permission)) return adminAccessDenied(req)
  return NextResponse.json({ job: { id: job.id, bank: job.bank, sourceName: job.source_name, status: job.status, drafts: job.draft_payload, errors: job.validation_errors, totalCount: job.total_count, validCount: job.valid_count, errorCount: job.error_count, createdAt: job.created_at } })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { default: pool } = await import("@/lib/db")
  const found = await pool.query(
    "SELECT id,bank,status,total_count FROM mednexus_content_import_jobs WHERE id=$1",
    [id],
  )
  const job = found.rows[0]
  if (!job) return NextResponse.json({ error: "Import job not found" }, { status: 404 })
  const permission = job.bank === "theory" ? "manage_theory_content" : "manage_mcq_content"
  const admin = await requireAdminRequest(req, permission)
  if (!admin) return adminAccessDenied(req)
  const body = await req.json() as { action?: string; selectedIndexes?: number[] }
  if (body.action === "retry") {
    await pool.query("UPDATE mednexus_content_import_jobs SET status='review',updated_at=NOW() WHERE id=$1", [id])
    await auditAdmin(pool, admin.uid, "retry", `${job.bank}_import`, id)
    return NextResponse.json({ success: true, status: "review" })
  }
  if (body.action === "mark_committed" && job.bank === "theory") {
    await pool.query("UPDATE mednexus_content_import_jobs SET status='committed',committed_count=total_count,valid_count=0,draft_payload='[]'::jsonb,committed_at=NOW(),updated_at=NOW() WHERE id=$1", [id])
    await auditAdmin(pool, admin.uid, "approve", "theory_import", id, { approved: job.total_count })
    return NextResponse.json({ success: true, status: "committed" })
  }
  if (body.action !== "approve" || job.bank !== "mcq") return NextResponse.json({ error: "This approval action is not supported." }, { status: 400 })
  const payloadResult = await pool.query(
    "SELECT draft_payload FROM mednexus_content_import_jobs WHERE id=$1",
    [id],
  )
  job.draft_payload = payloadResult.rows[0]?.draft_payload ?? []
  const selected = new Set((body.selectedIndexes ?? []).filter(Number.isInteger))
  const drafts = (job.draft_payload as Array<Record<string, unknown>>).filter((draft) => selected.has(Number(draft.importIndex)))
  if (!drafts.length) return NextResponse.json({ error: "Select at least one draft." }, { status: 400 })
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT updated_at FROM mednexus_questions WHERE id=1 FOR UPDATE")
    const candidateIds = drafts.map(question => String(question.id ?? "")).filter(Boolean)
    const existingResult = await client.query(
      `SELECT question.value->>'id' AS id
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb)) question(value)
       WHERE source.id=1 AND question.value->>'id'=ANY($1::text[])`,
      [candidateIds],
    )
    const ids = new Set(existingResult.rows.map(question => String(question.id)))
    const approved = drafts.filter((question) => question.id && !ids.has(String(question.id))).map(({ importStatus: _status, importIndex: _index, ...question }) => ({ ...question, moduleStatus: question.moduleStatus || "draft" }))
    if (approved.length) {
      await client.query(
        `UPDATE mednexus_questions
         SET data=COALESCE(data, '[]'::jsonb) || $1::jsonb,updated_at=NOW()
         WHERE id=1`,
        [JSON.stringify(approved)],
      )
    }
    const remaining = (job.draft_payload as Array<Record<string, unknown>>).filter((draft) => !selected.has(Number(draft.importIndex)))
    await client.query("UPDATE mednexus_content_import_jobs SET draft_payload=$1::jsonb,status=$2,valid_count=$3,committed_count=committed_count+$4,committed_at=CASE WHEN $2='committed' THEN NOW() ELSE committed_at END,updated_at=NOW() WHERE id=$5", [JSON.stringify(remaining), remaining.length ? "partial" : "committed", remaining.length, approved.length, id])
    await auditAdmin(client, admin.uid, "approve", "mcq_import", id, { approved: approved.length, remaining: remaining.length })
    await client.query("COMMIT")
    return NextResponse.json({ success: true, approved: approved.length, remaining: remaining.length })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[admin/content/import approve]", error)
    return NextResponse.json({ error: "Draft approval failed without changing the live bank." }, { status: 500 })
  } finally { client.release() }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { default: pool } = await import("@/lib/db")
  const found = await pool.query("SELECT bank FROM mednexus_content_import_jobs WHERE id=$1", [id])
  if (!found.rows[0]) return NextResponse.json({ error: "Import job not found" }, { status: 404 })
  const permission = found.rows[0].bank === "theory" ? "manage_theory_content" : "manage_mcq_content"
  const admin = await requireAdminRequest(req, permission)
  if (!admin) return adminAccessDenied(req)
  if (req.nextUrl.searchParams.get("confirm") !== "true") return NextResponse.json({ error: "Confirmation required." }, { status: 400 })
  await auditAdmin(pool, admin.uid, "delete", `${found.rows[0].bank}_import`, id)
  await pool.query("DELETE FROM mednexus_content_import_jobs WHERE id=$1", [id])
  return NextResponse.json({ success: true })
}
