import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import type { Question } from "@/lib/types"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"
import { runtimePool } from "@/lib/runtime-db"

export const dynamic = "force-dynamic"

type ManagedStatus = "draft" | "review" | "live" | "offline" | "archived"
const statuses = new Set<ManagedStatus>(["draft", "review", "live", "offline", "archived"])

function statusOf(question: Question): ManagedStatus {
  if (question.status && statuses.has(question.status)) return question.status
  if (question.moduleStatus === "draft") return "draft"
  if (question.moduleStatus === "offline") return "offline"
  return "live"
}

function issues(question: Question) {
  const found: string[] = []
  if (!question.module?.trim()) found.push("Missing module")
  if (!question.subject?.trim()) found.push("Missing discipline")
  if (!question.vignette?.trim()) found.push("Missing question stem")
  if (!Array.isArray(question.options) || question.options.length < 2) found.push("At least two answer options required")
  const validIds = new Set((question.options ?? []).map((option) => option.id))
  const answers = Array.isArray(question.correctAnswer) ? question.correctAnswer : question.correctAnswer ? [question.correctAnswer] : []
  if (!answers.length || answers.some((answer) => !validIds.has(answer))) found.push("Valid correct answer required")
  if (!question.explanation?.details?.trim()) found.push("Missing explanation")
  return found
}

function summary(question: Question) {
  const mediaCount = (question.media ?? []).length + (question.mediaBase64 ? 1 : 0)
  return { ...question, status: statusOf(question), validationIssues: issues(question), mediaCount }
}

const issueExpression = `(COALESCE(BTRIM(question.value->>'module'),'')=''
  OR COALESCE(BTRIM(question.value->>'subject'),'')=''
  OR COALESCE(BTRIM(question.value->>'vignette'),'')=''
  OR jsonb_array_length(CASE WHEN jsonb_typeof(question.value->'options')='array' THEN question.value->'options' ELSE '[]'::jsonb END)<2
  OR question.value->'correctAnswer' IS NULL
  OR COALESCE(BTRIM(question.value->'explanation'->>'details'),'')='')`

const sortExpressions: Record<string, string> = {
  "updated-desc": `COALESCE(question.value->>'updatedAt','') DESC,question.value->>'id'`,
  "updated-asc": `COALESCE(question.value->>'updatedAt','') ASC,question.value->>'id'`,
  module: `COALESCE(question.value->>'module',''),COALESCE(question.value->>'subject',''),question.value->>'id'`,
  stem: `COALESCE(question.value->>'vignette',''),question.value->>'id'`,
}

export async function GET(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_mcq_content")) return adminAccessDenied(req)
  try {
    const queryStartedAt = performance.now()
    const pool = await runtimePool()
    const search = (req.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 200)
    const moduleName = req.nextUrl.searchParams.get("module") ?? ""
    const subject = req.nextUrl.searchParams.get("subject") ?? ""
    const status = req.nextUrl.searchParams.get("status") ?? ""
    const media = req.nextUrl.searchParams.get("media") ?? ""
    const issuesOnly = req.nextUrl.searchParams.get("issues") === "with"
    const sort = req.nextUrl.searchParams.get("sort") ?? "updated-desc"
    const sortExpression = sortExpressions[sort] ?? sortExpressions["updated-desc"]
    const { page, pageSize, offset } = boundedPagination(req.nextUrl.searchParams)
    const statusExpression = `COALESCE(NULLIF(question.value->>'status',''),
      CASE question.value->>'moduleStatus' WHEN 'draft' THEN 'draft'
        WHEN 'offline' THEN 'offline' ELSE 'live' END)`
    const hasMediaExpression = `(COALESCE(question.value->>'mediaBase64','') <> ''
    OR jsonb_array_length(CASE WHEN jsonb_typeof(question.value->'media')='array'
      THEN question.value->'media' ELSE '[]'::jsonb END) > 0
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(question.value->'options')='array'
        THEN question.value->'options' ELSE '[]'::jsonb END) option
      WHERE jsonb_array_length(CASE WHEN jsonb_typeof(option->'media')='array'
        THEN option->'media' ELSE '[]'::jsonb END) > 0
      ))`
    const [result, taxonomy, statusCounts, issueCount] = await Promise.all([
    pool.query(
      `SELECT question.value AS question, source.updated_at,
              COUNT(*) OVER()::int AS total_count
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) question(value)
       WHERE source.id=1
         AND ($1='' OR COALESCE(question.value->>'module','')=$1)
         AND ($2='' OR COALESCE(question.value->>'subject','')=$2)
         AND ($3='' OR ${statusExpression}=$3)
         AND ($4='' OR ($4='with')=${hasMediaExpression})
         AND (NOT $8::boolean OR ${issueExpression})
         AND ($5='' OR question.value->>'id' ILIKE '%'||$5||'%'
           OR question.value->>'module' ILIKE '%'||$5||'%'
           OR question.value->>'subject' ILIKE '%'||$5||'%'
           OR question.value->>'vignette' ILIKE '%'||$5||'%'
           OR (question.value->'options')::text ILIKE '%'||$5||'%'
           OR (question.value->'tags')::text ILIKE '%'||$5||'%')
       ORDER BY ${sortExpression}
       LIMIT $6 OFFSET $7`,
      [moduleName, subject, status, media, search, pageSize, offset, issuesOnly],
    ),
    pool.query(
      `SELECT DISTINCT question.value->>'module' AS module, question.value->>'subject' AS subject
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) question(value)
       WHERE source.id=1`,
    ),
    pool.query(
      `SELECT ${statusExpression} AS status, COUNT(*)::int AS count
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) question(value)
      WHERE source.id=1 GROUP BY 1`,
    ),
      pool.query(`SELECT COUNT(*)::int AS count FROM mednexus_questions source
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) question(value)
        WHERE source.id=1 AND ${issueExpression}`),
    ])
    const questions = result.rows.map(row => summary(row.question as Question))
    const modules = [...new Set(taxonomy.rows.map(row => row.module).filter(Boolean))].sort()
    const subjects = [...new Set(taxonomy.rows.map(row => row.subject).filter(Boolean))].sort()
    const counts = { ...Object.fromEntries(statusCounts.rows.map(row => [row.status, Number(row.count)])), issues: Number(issueCount.rows[0]?.count ?? 0) }
    const total = Number(result.rows[0]?.total_count ?? 0)
    const payload = {
      questions,
      pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) },
      filters: { modules, subjects },
      counts,
      updatedAt: result.rows[0]?.updated_at ?? null,
    }
    return measuredJson({ route: "GET /api/admin/mcq/questions", queryStartedAt, rowCount: questions.length, payload })
  } catch (error) {
    console.error("[admin/mcq/questions GET]", error)
    return NextResponse.json({ error: "Unable to load the MCQ bank." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)
  const body = await req.json() as Partial<Question>
  const question: Question = { id: body.id?.trim() || randomUUID(), module: body.module?.trim() || "", moduleStatus: "draft", subject: body.subject?.trim() || "", vignette: body.vignette?.trim() || "", questionType: body.questionType ?? "STANDARD_MCQ", options: body.options ?? [{ id: "A", text: "" }, { id: "B", text: "" }], correctAnswer: body.correctAnswer ?? null, explanation: body.explanation ?? null, media: body.media ?? [], tags: body.tags ?? [], status: "draft", updatedAt: new Date().toISOString() }
  const pool = await runtimePool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const exists = await client.query(
      `SELECT 1 FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
       WHERE source.id=1 AND item.value->>'id'=$1 LIMIT 1`,
      [question.id],
    )
    if (exists.rows.length) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Question ID already exists." }, { status: 409 }) }
    await client.query(
      `UPDATE mednexus_questions
       SET data=COALESCE(data,'[]'::jsonb)||jsonb_build_array($1::jsonb),updated_at=NOW()
       WHERE id=1`,
      [JSON.stringify(question)],
    )
    await auditAdmin(client, admin.uid, "create", "mcq_question", question.id, { status: "draft" })
    await client.query("COMMIT")
    return NextResponse.json({ question: summary(question) }, { status: 201 })
  } catch (error) { await client.query("ROLLBACK"); console.error("[admin/mcq/questions POST]", error); return NextResponse.json({ error: "Unable to create the question." }, { status: 500 }) } finally { client.release() }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)
  const body = await req.json() as { ids?: string[]; action?: "status" | "move" | "tags" | "duplicate" | "delete"; status?: ManagedStatus; module?: string; subject?: string; tags?: string[]; confirmation?: string }
  const ids = [...new Set((body.ids ?? []).filter(Boolean))]
  if (!ids.length) return NextResponse.json({ error: "Select at least one question." }, { status: 400 })
  if (body.action === "delete" && body.confirmation !== "DELETE SELECTED MCQS") return NextResponse.json({ error: "Type DELETE SELECTED MCQS to confirm." }, { status: 400 })
  if (body.action === "status" && (!body.status || !statuses.has(body.status))) return NextResponse.json({ error: "Choose a valid status." }, { status: 400 })
  const pool = await runtimePool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT updated_at FROM mednexus_questions WHERE id=1 FOR UPDATE")
    const current = await client.query<{ question: Question }>(
      `SELECT item.value AS question
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
       WHERE source.id=1 AND item.value->>'id'=ANY($1::text[])`,
      [ids],
    )
    const selectedQuestions = current.rows.map(row => row.question)
    if (body.action === "status" && body.status === "live") {
      const blocked = selectedQuestions.filter((question) => issues(question).length > 0)
      if (blocked.length) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: `${blocked.length} selected question${blocked.length === 1 ? " is" : "s are"} incomplete and cannot be published.`, blocked: blocked.map((question) => question.id) }, { status: 422 })
      }
    }
    const now = new Date().toISOString()
    const affected = selectedQuestions.length
    const additions: Question[] = []
    const upserts = selectedQuestions.flatMap<Question>((question) => {
      if (body.action === "delete") return []
      if (body.action === "duplicate") { additions.push({ ...question, id: randomUUID(), status: "draft", moduleStatus: "draft", vignette: question.vignette + " (Copy)", updatedAt: now }); return [question] }
      if (body.action === "status") return [{ ...question, status: body.status, moduleStatus: body.status === "live" ? "live" : body.status === "offline" || body.status === "archived" ? "offline" : "draft", updatedAt: now }]
      if (body.action === "move") return [{ ...question, module: body.module?.trim() || question.module, subject: body.subject?.trim() || question.subject, updatedAt: now }]
      if (body.action === "tags") return [{ ...question, tags: [...new Set(body.tags ?? [])], updatedAt: now }]
      return [question]
    })
    const incoming = body.action === "duplicate" ? additions : upserts
    const deletedIds = body.action === "delete" ? ids : []
    await client.query(
      `WITH incoming AS (
         SELECT value, ordinality, value->>'id' AS id
         FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY item(value, ordinality)
       ),
       existing AS (
         SELECT value, ordinality, value->>'id' AS id
         FROM mednexus_questions source
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb))
           WITH ORDINALITY item(value,ordinality)
         WHERE source.id=1
       ),
       merged AS (
         SELECT COALESCE(incoming.value,existing.value) AS value,0 AS bucket,existing.ordinality
         FROM existing LEFT JOIN incoming USING (id)
         WHERE NOT (existing.id=ANY($2::text[]))
         UNION ALL
         SELECT incoming.value,1,incoming.ordinality
         FROM incoming
         WHERE NOT EXISTS (SELECT 1 FROM existing WHERE existing.id=incoming.id)
       )
       UPDATE mednexus_questions
       SET data=COALESCE((SELECT jsonb_agg(value ORDER BY bucket,ordinality) FROM merged),'[]'::jsonb),
           updated_at=NOW()
       WHERE id=1`,
      [JSON.stringify(incoming), deletedIds],
    )
    await auditAdmin(client, admin.uid, body.action ?? "bulk_update", "mcq_question", null, { ids, affected, created: additions.length, status: body.status, module: body.module, subject: body.subject })
    await client.query("COMMIT")
    return NextResponse.json({ success: true, affected, created: additions.length })
  } catch (error) { await client.query("ROLLBACK"); console.error("[admin/mcq/questions PATCH]", error); return NextResponse.json({ error: "Bulk update failed without changing the bank." }, { status: 500 }) } finally { client.release() }
}
