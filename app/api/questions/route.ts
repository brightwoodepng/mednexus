import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"
import {
  getQuestionBankMetadata,
  getQuestionBankStatus,
  getQuestionPage,
} from "@/lib/question-bank-server"

export const maxDuration = 120
export const dynamic = "force-dynamic"

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}

export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  try {
    if (req.nextUrl.searchParams.get("view") === "meta") {
      const metadata = await getQuestionBankMetadata()
      const response = measuredJson({
        route: "GET /api/questions?view=meta",
        queryStartedAt,
        rowCount: metadata.count ? 1 : 0,
        payload: metadata,
      })
      response.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300")
      return response
    }

    const { page, pageSize, offset } = boundedPagination(req.nextUrl.searchParams)
    const publicProjection = req.nextUrl.searchParams.get("view") !== "runtime"
    const result = await getQuestionPage({
      pageSize,
      offset,
      moduleName: req.nextUrl.searchParams.get("module")?.trim() || undefined,
      discipline: req.nextUrl.searchParams.get("discipline")?.trim() || undefined,
      search: req.nextUrl.searchParams.get("q")?.trim().slice(0, 200) || undefined,
      publicProjection,
    })
    const payload = {
      questions: result.questions,
      updatedAt: result.updatedAt,
      pagination: {
        page,
        pageSize,
        total: result.total,
        pages: Math.ceil(result.total / pageSize),
      },
    }
    return noStore(measuredJson({
      route: publicProjection
        ? "GET /api/questions"
        : "GET /api/questions?view=runtime",
      queryStartedAt,
      rowCount: result.questions.length,
      payload,
    }))
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
