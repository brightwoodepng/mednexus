import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { getQuestionBankDiagnostics, getQuestionBankStatus } from "@/lib/question-bank-server"
import { measuredJson } from "@/lib/api-efficiency"
import { questionsDatabase } from "@/lib/questions-database"
import type { Pool } from "pg"

export const dynamic = "force-dynamic"

const confirmation = "CLEAR MCQ BANK"
type Action = "export" | "replace" | "clear-postgres" | "restore-demo" | "clear-firestore" | "refresh"

async function audit(pool: Pool, adminId: string, action: string, source: string, count: number, backup: unknown[]) {
  await pool.query(`CREATE TABLE IF NOT EXISTS mednexus_question_bank_audit_log (
    id BIGSERIAL PRIMARY KEY, admin_id TEXT NOT NULL, action TEXT NOT NULL, source TEXT NOT NULL,
    affected_count INTEGER NOT NULL, backup JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
  await pool.query("INSERT INTO mednexus_question_bank_audit_log (admin_id, action, source, affected_count, backup) VALUES ($1, $2, $3, $4, $5::jsonb)", [adminId, action, source, count, JSON.stringify(backup)])
}

export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  const admin = await requireAdminRequest(req, "manage_system")
  if (!admin || admin.role !== "SUPER_ADMIN") return await adminAccessDenied(req)
  const status = await getQuestionBankDiagnostics()
  let recentActions: unknown[] = []
  try {
    const { default: pool } = await import("@/lib/db")
    const auditRows = await pool.query(`SELECT action,source,affected_count AS "affectedCount",created_at AS "createdAt" FROM mednexus_question_bank_audit_log ORDER BY created_at DESC LIMIT 5`)
    recentActions = auditRows.rows
  } catch { /* The audit table is created on the first recovery action. */ }
  return measuredJson({
    route: "GET /api/admin/question-bank",
    queryStartedAt,
    rowCount: 1,
    payload: { ...status, confirmation, recentActions },
  })
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_system")
  if (!admin || admin.role !== "SUPER_ADMIN") return await adminAccessDenied(req)
  try {
    const body = await req.json() as { action?: Action; confirmation?: string; questions?: unknown[] }
    const action = body.action
    if (!action || !["export", "replace", "clear-postgres", "restore-demo", "clear-firestore", "refresh"].includes(action)) return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    if (action === "refresh") return NextResponse.json({ success: true, message: "Question caches marked stale. Clients will refetch on their next request." }, { headers: { "Cache-Control": "no-store" } })
    const status = await getQuestionBankStatus()
    if (action === "export") return NextResponse.json({ questions: status.questions, source: status.source, updatedAt: status.updatedAt, count: status.questions.length })
    if (body.confirmation !== confirmation) return NextResponse.json({ error: `Type ${confirmation} to confirm.` }, { status: 400 })
    if (action === "replace" && !Array.isArray(body.questions)) return NextResponse.json({ error: "Reviewed import questions are required." }, { status: 400 })

    if (action === "clear-firestore") {
      if (!status.firestore.available) return NextResponse.json({ error: "Firestore fallback is not configured or unavailable." }, { status: 503 })
      const { getAdminDb } = await import("@/lib/firebase-admin")
      const db = getAdminDb()!
      const fallback = await db.collection("mednexus").doc("questions").get()
      const backup = Array.isArray(fallback.data()?.data) ? fallback.data()!.data : []
      // Firestore-only installations retain the same durable audit/backup record.
      await db.collection("mednexus_question_bank_audit_log").add({ adminId: admin.uid, action, source: "firestore", affectedCount: backup.length, backup, createdAt: new Date().toISOString() })
      await db.collection("mednexus").doc("questions").delete()
      if (status.postgres.available) { const { default: pool } = await import("@/lib/db"); await audit(pool, admin.uid, action, "firestore", backup.length, backup) }
      return NextResponse.json({ success: true, invalidated: true })
    }

    if (!status.postgres.available) return NextResponse.json({ error: "PostgreSQL is required for this action to preserve an explicit live-bank state." }, { status: 503 })
    const { default: pool } = await import("@/lib/db")
    const next = action === "clear-postgres" ? [] : action === "restore-demo" ? questionsDatabase : body.questions!
    // Audit row includes the automatic JSON backup before the mutation.
    await audit(pool, admin.uid, action, status.source, status.questions.length, status.questions)
    await pool.query(`INSERT INTO mednexus_questions (id, data, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`, [JSON.stringify(next)])
    return NextResponse.json({ success: true, count: next.length, invalidated: true })
  } catch (error) {
    console.error("[question-bank action]", error)
    return NextResponse.json({ error: "Unable to complete question-bank action." }, { status: 500 })
  }
}
