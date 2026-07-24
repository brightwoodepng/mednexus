import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { getQuestionBankStatus } from "@/lib/question-bank-server"

export const maxDuration = 120
export const dynamic = "force-dynamic"

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}

// GET remains learner-safe: source diagnostics are added only for Super Admins.
export async function GET(req: NextRequest) {
  try {
    const status = await getQuestionBankStatus()
    const admin = await requireAdminRequest(req, "manage_system").catch(() => null)
    const payload: Record<string, unknown> = { questions: status.questions, updatedAt: status.updatedAt }
    if (admin?.role === "SUPER_ADMIN") {
      payload.source = status.source
      payload.count = status.questions.length
    }
    return noStore(NextResponse.json(payload))
  } catch (err) {
    console.error("[questions GET]", err)
    return noStore(NextResponse.json({ error: "Server error" }, { status: 500 }))
  }
}

export async function PUT(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_mcq_content")) return await adminAccessDenied(req)
  try {
    const { questions } = await req.json()
    if (!Array.isArray(questions)) return NextResponse.json({ error: "questions must be an array" }, { status: 400 })
    const status = await getQuestionBankStatus()
    if (status.postgres.available) {
      const { default: pool } = await import("@/lib/db")
      await pool.query(`INSERT INTO mednexus_questions (id, data, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`, [JSON.stringify(questions)])
      return noStore(NextResponse.json({ success: true, count: questions.length }))
    }
    if (status.firestore.available) {
      const { getAdminDb } = await import("@/lib/firebase-admin")
      const { FieldValue } = await import("firebase-admin/firestore")
      await getAdminDb()!.collection("mednexus").doc("questions").set({ data: questions, updatedAt: FieldValue.serverTimestamp() })
      return noStore(NextResponse.json({ success: true, count: questions.length }))
    }
    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  } catch (err) {
    console.error("[questions PUT]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
