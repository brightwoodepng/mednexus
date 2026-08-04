import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { runtimePool } from "@/lib/runtime-db"
import { auditAdmin } from "@/lib/platform-settings"
import type { Question } from "@/lib/types"
import { externalizeLegacyQuestionMedia } from "@/lib/mcq-media-normalization"

const MAX_UPSERTS = 2_000
const MAX_DELETES = 5_000

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)

  const body = await req.json() as { upserts?: Question[]; deletedIds?: string[] }
  const requestedUpserts = Array.isArray(body.upserts) ? body.upserts : []
  const deletedIds = [...new Set(Array.isArray(body.deletedIds) ? body.deletedIds.filter(Boolean) : [])]
  if (requestedUpserts.length > MAX_UPSERTS || deletedIds.length > MAX_DELETES) {
    return NextResponse.json({ error: "Reconciliation batch is too large." }, { status: 413 })
  }
  if (requestedUpserts.some(question => !question?.id || typeof question.id !== "string")) {
    return NextResponse.json({ error: "Every changed question requires an ID." }, { status: 400 })
  }
  if (!requestedUpserts.length && !deletedIds.length) {
    return NextResponse.json({ success: true, updated: 0, deleted: 0 })
  }

  const pool = await runtimePool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT updated_at FROM mednexus_questions WHERE id=1 FOR UPDATE")
    const upserts = await externalizeLegacyQuestionMedia(client, requestedUpserts, admin.uid)
    await client.query(
      `WITH incoming AS (
         SELECT value, ordinality, value->>'id' AS id
         FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY item(value, ordinality)
       ),
       existing AS (
         SELECT value, ordinality, value->>'id' AS id
         FROM mednexus_questions source
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb))
           WITH ORDINALITY item(value, ordinality)
         WHERE source.id=1
       ),
       merged AS (
         SELECT COALESCE(incoming.value, existing.value) AS value, 0 AS bucket, existing.ordinality
         FROM existing
         LEFT JOIN incoming USING (id)
         WHERE NOT (existing.id = ANY($2::text[]))
         UNION ALL
         SELECT incoming.value, 1 AS bucket, incoming.ordinality
         FROM incoming
         WHERE NOT EXISTS (SELECT 1 FROM existing WHERE existing.id=incoming.id)
       )
       UPDATE mednexus_questions
       SET data=COALESCE(
         (SELECT jsonb_agg(value ORDER BY bucket, ordinality) FROM merged),
         '[]'::jsonb
       ),updated_at=NOW()
       WHERE id=1`,
      [JSON.stringify(upserts), deletedIds],
    )
    await auditAdmin(client, admin.uid, "reconcile", "mcq_question", null, {
      updated: upserts.length,
      deleted: deletedIds.length,
    })
    await client.query("COMMIT")
    return NextResponse.json({ success: true, updated: upserts.length, deleted: deletedIds.length })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[admin/mcq/questions/reconcile PATCH]", error)
    return NextResponse.json({ error: "Question changes were not saved." }, { status: 500 })
  } finally {
    client.release()
  }
}
