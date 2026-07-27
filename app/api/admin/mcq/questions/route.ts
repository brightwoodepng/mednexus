import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import type { Question } from "@/lib/types"

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

export async function GET(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_mcq_content")) return adminAccessDenied(req)
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const result = await pool.query("SELECT data,updated_at FROM mednexus_questions WHERE id=1")
  const all: Question[] = result.rows[0]?.data ?? []
  const search = (req.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase()
  const moduleName = req.nextUrl.searchParams.get("module") ?? ""
  const subject = req.nextUrl.searchParams.get("subject") ?? ""
  const status = req.nextUrl.searchParams.get("status") ?? ""
  const media = req.nextUrl.searchParams.get("media") ?? ""
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? 1) || 1)
  const pageSize = Math.min(48, Math.max(6, Number(req.nextUrl.searchParams.get("pageSize") ?? 18) || 18))
  const filtered = all.filter((question) => {
    const searchable = [question.id, question.module, question.subject, question.vignette, ...(question.options ?? []).map((option) => option.text), ...(question.tags ?? [])].join(" ").toLowerCase()
    const hasMedia = Boolean(question.mediaBase64 || question.media?.length || question.options?.some((option) => option.media?.length))
    return (!search || searchable.includes(search))
      && (!moduleName || (question.module ?? "") === moduleName)
      && (!subject || question.subject === subject)
      && (!status || statusOf(question) === status)
      && (!media || (media === "with" ? hasMedia : !hasMedia))
  })
  const start = (page - 1) * pageSize
  const modules = [...new Set(all.map((question) => question.module).filter(Boolean))].sort()
  const subjects = [...new Set(all.map((question) => question.subject).filter(Boolean))].sort()
  const counts = all.reduce<Record<string, number>>((acc, question) => { const key = statusOf(question); acc[key] = (acc[key] ?? 0) + 1; return acc }, {})
  return NextResponse.json({ questions: filtered.slice(start, start + pageSize).map(summary), pagination: { page, pageSize, total: filtered.length, pages: Math.max(1, Math.ceil(filtered.length / pageSize)) }, filters: { modules, subjects }, counts, updatedAt: result.rows[0]?.updated_at ?? null })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)
  const body = await req.json() as Partial<Question>
  const question: Question = { id: body.id?.trim() || randomUUID(), module: body.module?.trim() || "", moduleStatus: "draft", subject: body.subject?.trim() || "", vignette: body.vignette?.trim() || "", questionType: body.questionType ?? "STANDARD_MCQ", options: body.options ?? [{ id: "A", text: "" }, { id: "B", text: "" }], correctAnswer: body.correctAnswer ?? null, explanation: body.explanation ?? null, media: body.media ?? [], tags: body.tags ?? [], status: "draft", updatedAt: new Date().toISOString() }
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const current = await client.query("SELECT data FROM mednexus_questions WHERE id=1 FOR UPDATE")
    const bank: Question[] = current.rows[0]?.data ?? []
    if (bank.some((item) => item.id === question.id)) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Question ID already exists." }, { status: 409 }) }
    await client.query("UPDATE mednexus_questions SET data=$1::jsonb,updated_at=NOW() WHERE id=1", [JSON.stringify([...bank, question])])
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
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const current = await client.query("SELECT data FROM mednexus_questions WHERE id=1 FOR UPDATE")
    const bank: Question[] = current.rows[0]?.data ?? []
    const selected = new Set(ids)
    const now = new Date().toISOString()
    let affected = 0
    const additions: Question[] = []
    const next = bank.flatMap<Question>((question) => {
      if (!selected.has(question.id)) return [question]
      affected++
      if (body.action === "delete") return []
      if (body.action === "duplicate") { additions.push({ ...question, id: randomUUID(), status: "draft", moduleStatus: "draft", vignette: question.vignette + " (Copy)", updatedAt: now }); return [question] }
      if (body.action === "status") return [{ ...question, status: body.status, moduleStatus: body.status === "live" ? "live" : body.status === "offline" || body.status === "archived" ? "offline" : "draft", updatedAt: now }]
      if (body.action === "move") return [{ ...question, module: body.module?.trim() || question.module, subject: body.subject?.trim() || question.subject, updatedAt: now }]
      if (body.action === "tags") return [{ ...question, tags: [...new Set(body.tags ?? [])], updatedAt: now }]
      return [question]
    })
    await client.query("UPDATE mednexus_questions SET data=$1::jsonb,updated_at=NOW() WHERE id=1", [JSON.stringify([...next, ...additions])])
    await auditAdmin(client, admin.uid, body.action ?? "bulk_update", "mcq_question", null, { ids, affected, created: additions.length, status: body.status, module: body.module, subject: body.subject })
    await client.query("COMMIT")
    return NextResponse.json({ success: true, affected, created: additions.length })
  } catch (error) { await client.query("ROLLBACK"); console.error("[admin/mcq/questions PATCH]", error); return NextResponse.json({ error: "Bulk update failed without changing the bank." }, { status: 500 }) } finally { client.release() }
}
