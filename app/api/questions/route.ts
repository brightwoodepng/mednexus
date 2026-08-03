import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"
import {
  buildQuestionCatalog,
  getGameQuestionCatalog,
  getQuestionBankMetadata,
  getQuestionCatalog,
  getQuestionPage,
  getQuestionsByIds,
  getRandomGameQuestions,
} from "@/lib/question-bank-server"
import { requireAuthenticatedUser } from "@/lib/request-auth"

export const maxDuration = 120
export const dynamic = "force-dynamic"

// Runtime records include answer options and explanations. Keep this bounded
// well below typical serverless response limits while avoiding tiny-page
// request waterfalls for the few tools that intentionally load the full bank.
// 25 x a representative 200 KiB media-heavy record stays near 5 MiB, leaving
// headroom beneath common 6 MiB serverless response limits.
export const QUESTION_MAX_PAGE_SIZE = 25

function addServerTiming(response: NextResponse, timings: { auth?: number; database: number }) {
  const values = []
  if (timings.auth !== undefined) values.push(`auth;dur=${timings.auth.toFixed(1)}`)
  values.push(`database;dur=${timings.database.toFixed(1)}`)
  response.headers.set("Server-Timing", values.join(", "))
  return response
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0")
  return response
}

export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  try {
    if (req.nextUrl.searchParams.get("view") === "catalog") {
      const authStartedAt = performance.now()
      if (!await requireAuthenticatedUser(req)) {
        return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
      }
      const authDuration = performance.now() - authStartedAt
      const databaseStartedAt = performance.now()
      const catalog = await getQuestionCatalog()
      const response = measuredJson({
        route: "GET /api/questions?view=catalog",
        queryStartedAt: databaseStartedAt,
        rowCount: catalog.modules.length,
        payload: catalog,
      })
      return noStore(addServerTiming(response, {
        auth: authDuration,
        database: performance.now() - databaseStartedAt,
      }))
    }

    if (req.nextUrl.searchParams.get("view") === "game-catalog") {
      const authStartedAt = performance.now()
      if (!await requireAuthenticatedUser(req)) {
        return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
      }
      const authDuration = performance.now() - authStartedAt
      const databaseStartedAt = performance.now()
      const catalog = await getGameQuestionCatalog()
      const response = measuredJson({
        route: "GET /api/questions?view=game-catalog",
        queryStartedAt: databaseStartedAt,
        rowCount: catalog.modules.length,
        payload: catalog,
      })
      return noStore(addServerTiming(response, {
        auth: authDuration,
        database: performance.now() - databaseStartedAt,
      }))
    }

    if (req.nextUrl.searchParams.get("view") === "game") {
      const authStartedAt = performance.now()
      if (!await requireAuthenticatedUser(req)) {
        return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
      }
      const authDuration = performance.now() - authStartedAt
      const requestedQuantity = Number.parseInt(req.nextUrl.searchParams.get("quantity") ?? "10", 10)
      const quantity = Math.min(500, Math.max(1, Number.isFinite(requestedQuantity) ? requestedQuantity : 10))
      const databaseStartedAt = performance.now()
      const selection = await getRandomGameQuestions({
        quantity,
        moduleName: req.nextUrl.searchParams.get("module")?.trim() || undefined,
        discipline: req.nextUrl.searchParams.get("discipline")?.trim() || undefined,
      })
      const response = measuredJson({
        route: "GET /api/questions?view=game",
        queryStartedAt: databaseStartedAt,
        rowCount: selection.questions.length,
        payload: selection,
      })
      return noStore(addServerTiming(response, {
        auth: authDuration,
        database: performance.now() - databaseStartedAt,
      }))
    }

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

    const { page, pageSize, offset } = boundedPagination(req.nextUrl.searchParams, {
      maxPageSize: QUESTION_MAX_PAGE_SIZE,
    })
    const runtime = req.nextUrl.searchParams.get("view") === "runtime"
    const authStartedAt = performance.now()
    if (runtime && !await requireAuthenticatedUser(req)) {
      return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
    }
    const authDuration = runtime ? performance.now() - authStartedAt : undefined
    const publicProjection = !runtime
    const databaseStartedAt = performance.now()
    const result = await getQuestionPage({
      pageSize,
      offset,
      moduleName: req.nextUrl.searchParams.get("module")?.trim() || undefined,
      discipline: req.nextUrl.searchParams.get("discipline")?.trim() || undefined,
      topic: req.nextUrl.searchParams.get("topic")?.trim() || undefined,
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
    const response = measuredJson({
      route: publicProjection
        ? "GET /api/questions"
        : "GET /api/questions?view=runtime",
      queryStartedAt: databaseStartedAt,
      rowCount: result.questions.length,
      payload,
    })
    return noStore(addServerTiming(response, {
      auth: authDuration,
      database: performance.now() - databaseStartedAt,
    }))
  } catch (err) {
    console.error("[questions GET]", err)
    return noStore(NextResponse.json({ error: "Server error" }, { status: 500 }))
  }
}

export async function POST(req: NextRequest) {
  const authStartedAt = performance.now()
  if (!await requireAuthenticatedUser(req)) {
    return noStore(NextResponse.json({ error: "Unauthorized" }, { status: 401 }))
  }
  try {
    const body = await req.json() as { questionIds?: unknown; gameOnly?: unknown }
    const maximum = body.gameOnly === true ? 100 : 500
    if (!Array.isArray(body.questionIds) || body.questionIds.length < 1 || body.questionIds.length > maximum
      || body.questionIds.some(id => typeof id !== "string" || !id.trim())) {
      return noStore(NextResponse.json({ error: `questionIds must contain 1 to ${maximum} valid IDs` }, { status: 400 }))
    }
    const ids = body.questionIds as string[]
    if (new Set(ids).size !== ids.length) {
      return noStore(NextResponse.json({ error: "questionIds must not contain duplicates" }, { status: 400 }))
    }
    const databaseStartedAt = performance.now()
    const questions = await getQuestionsByIds(ids, body.gameOnly === true)
    if (questions.length !== ids.length) {
      return noStore(NextResponse.json({ error: "One or more saved questions are unavailable" }, { status: 409 }))
    }
    const response = measuredJson({ route: "POST /api/questions?view=recover", queryStartedAt: databaseStartedAt,
      rowCount: questions.length, payload: { questions } })
    return noStore(addServerTiming(response, { auth: performance.now() - authStartedAt,
      database: performance.now() - databaseStartedAt }))
  } catch {
    return noStore(NextResponse.json({ error: "Invalid recovery request" }, { status: 400 }))
  }
}

export async function PUT(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_mcq_content")) return await adminAccessDenied(req)
  try {
    const { questions } = await req.json()
    if (!Array.isArray(questions)) return NextResponse.json({ error: "questions must be an array" }, { status: 400 })
    // This legacy replacement route already receives the complete next bank.
    // Do not download the complete current bank merely to discover which
    // configured backend should receive the overwrite.
    if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
      const { default: pool } = await import("@/lib/db")
      await pool.query(`INSERT INTO mednexus_questions (id, data, updated_at) VALUES (1, $1::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`, [JSON.stringify(questions)])
      return noStore(NextResponse.json({ success: true, count: questions.length }))
    }
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      const { getAdminDb } = await import("@/lib/firebase-admin")
      const { FieldValue } = await import("firebase-admin/firestore")
      const db = getAdminDb()
      if (!db) return NextResponse.json({ error: "No database configured" }, { status: 503 })
      const updatedAt = new Date().toISOString()
      const batch = db.batch()
      batch.set(db.collection("mednexus").doc("questions"), { data: questions, updatedAt: FieldValue.serverTimestamp() })
      batch.set(db.collection("mednexus").doc("questionCatalog"), buildQuestionCatalog(questions, updatedAt))
      await batch.commit()
      return noStore(NextResponse.json({ success: true, count: questions.length }))
    }
    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  } catch (err) {
    console.error("[questions PUT]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
