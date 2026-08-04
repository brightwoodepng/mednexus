import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import type { Question } from "@/lib/types"
import { runtimePool } from "@/lib/runtime-db"

function publicationIssues(question: Question) {
  const issues: string[] = []
  if (!question.module?.trim()) issues.push("Module is required")
  if (!question.subject?.trim()) issues.push("Discipline is required")
  if (!question.vignette?.trim()) issues.push("Question stem is required")
  if (!Array.isArray(question.options) || question.options.length < 2 || question.options.some((option) => !option.text.trim())) issues.push("At least two complete answer options are required")
  const ids = new Set((question.options ?? []).map((option) => option.id))
  const answers = Array.isArray(question.correctAnswer) ? question.correctAnswer : question.correctAnswer ? [question.correctAnswer] : []
  if (!answers.length || answers.some((answer) => !ids.has(answer))) issues.push("A valid correct answer is required")
  if (!question.explanation?.details?.trim()) issues.push("A correct-answer explanation is required")
  return issues
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminRequest(req, "manage_mcq_content")) return adminAccessDenied(req)
  const { id } = await params
  const pool = await runtimePool()
  const result = await pool.query(
    `SELECT item.value AS question,source.updated_at
     FROM mednexus_questions source
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
     WHERE source.id=1 AND item.value->>'id'=$1 LIMIT 1`,
    [id],
  )
  const question = result.rows[0]?.question as Question | undefined
  if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 })
  return NextResponse.json({ question, validationIssues: publicationIssues(question), bankUpdatedAt: result.rows[0]?.updated_at ?? null })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)
  const { id } = await params
  const body = await req.json() as Partial<Question> & { expectedUpdatedAt?: string }
  const pool = await runtimePool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT updated_at FROM mednexus_questions WHERE id=1 FOR UPDATE")
    const current = await client.query(
      `SELECT item.value AS question
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
       WHERE source.id=1 AND item.value->>'id'=$1 LIMIT 1`,
      [id],
    )
    const existing = current.rows[0]?.question as Question | undefined
    if (!existing) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Question not found." }, { status: 404 }) }
    if (body.expectedUpdatedAt && existing.updatedAt && body.expectedUpdatedAt !== existing.updatedAt) { await client.query("ROLLBACK"); return NextResponse.json({ error: "This question changed in another session. Reload before saving." }, { status: 409 }) }
    const status = body.status ?? existing.status ?? (existing.moduleStatus === "draft" ? "draft" : existing.moduleStatus === "offline" ? "offline" : "live")
    const { expectedUpdatedAt: _expectedUpdatedAt, ...changes } = body
    const next: Question = { ...existing, ...changes, id, module: body.module?.trim() ?? existing.module, subject: body.subject?.trim() ?? existing.subject, vignette: body.vignette?.trim() ?? existing.vignette, options: body.options ?? existing.options, explanation: body.explanation === undefined ? existing.explanation : body.explanation, media: body.media ?? existing.media ?? [], tags: body.tags ?? existing.tags ?? [], status, moduleStatus: status === "live" ? "live" : status === "offline" || status === "archived" ? "offline" : "draft", updatedAt: new Date().toISOString() }
    const issues = publicationIssues(next)
    if (status === "live" && issues.length) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Complete the question before publishing.", validationIssues: issues }, { status: 422 }) }
    await client.query(
      `UPDATE mednexus_questions source
       SET data=(
         SELECT jsonb_agg(
           CASE WHEN item.value->>'id'=$1 THEN $2::jsonb ELSE item.value END
           ORDER BY item.ordinality
         )
         FROM jsonb_array_elements(COALESCE(source.data,'[]'::jsonb))
           WITH ORDINALITY item(value,ordinality)
       ),updated_at=NOW()
       WHERE source.id=1`,
      [id, JSON.stringify(next)],
    )
    const mediaIds = (next.media ?? []).map((asset) => asset.id)
    if (mediaIds.length) await client.query("UPDATE mednexus_mcq_media_assets SET question_id=$1,updated_at=NOW() WHERE id = ANY($2::text[])", [id, mediaIds])
    for (const asset of next.media ?? []) await client.query("UPDATE mednexus_mcq_media_assets SET caption=$1,alt_text=$2,updated_at=NOW() WHERE id=$3 AND question_id=$4", [asset.caption ?? null, asset.alt, asset.id, id])
    await auditAdmin(client, admin.uid, "update", "mcq_question", id, { status, mediaCount: next.media?.length ?? 0 })
    await client.query("COMMIT")
    return NextResponse.json({ question: next, validationIssues: issues })
  } catch (error) { await client.query("ROLLBACK"); console.error("[admin/mcq/questions/id PATCH]", error); return NextResponse.json({ error: "Save failed without changing the question." }, { status: 500 }) } finally { client.release() }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)
  if (req.nextUrl.searchParams.get("confirmation") !== "DELETE MCQ") return NextResponse.json({ error: "Type DELETE MCQ to confirm." }, { status: 400 })
  const { id } = await params
  const pool = await runtimePool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT updated_at FROM mednexus_questions WHERE id=1 FOR UPDATE")
    const exists = await client.query(
      `SELECT 1 FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
       WHERE source.id=1 AND item.value->>'id'=$1 LIMIT 1`,
      [id],
    )
    if (!exists.rows.length) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Question not found." }, { status: 404 }) }
    await client.query(
      `UPDATE mednexus_questions source
       SET data=COALESCE((
         SELECT jsonb_agg(item.value ORDER BY item.ordinality)
         FROM jsonb_array_elements(COALESCE(source.data,'[]'::jsonb))
           WITH ORDINALITY item(value,ordinality)
         WHERE item.value->>'id'<>$1
       ),'[]'::jsonb),updated_at=NOW()
       WHERE source.id=1`,
      [id],
    )
    await auditAdmin(client, admin.uid, "delete", "mcq_question", id)
    await client.query("COMMIT")
    return NextResponse.json({ success: true })
  } catch (error) { await client.query("ROLLBACK"); console.error("[admin/mcq/questions/id DELETE]", error); return NextResponse.json({ error: "Delete failed without changing the bank." }, { status: 500 }) } finally { client.release() }
}
