import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/session-auth"
import { verifyGuestToken } from "@/lib/guest-auth"
import type { TheoryQuestion } from "@/lib/types"

async function getPgPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    return pool
  } catch {
    return null
  }
}

/** Extract and verify the caller's uid from request headers.
 *  Accepts x-session-token (registered users) or x-guest-token (guests). */
function getVerifiedUid(req: NextRequest): string | null {
  const sessionToken = req.headers.get("x-session-token")
  if (sessionToken) {
    const payload = verifySessionToken(sessionToken)
    return payload?.uid ?? null
  }
  const guestToken = req.headers.get("x-guest-token")
  if (guestToken) {
    const payload = verifyGuestToken(guestToken)
    return payload?.uid ?? null
  }
  return null
}

/**
 * GET /api/theory/questions
 *
 * Returns theory questions from mednexus_theory_questions.
 *
 * Query parameters (all optional):
 *   module   – filter to an exact module name (case-insensitive)
 *   category – filter to an exact category name (case-insensitive)
 *
 * Response:
 *   { questions: TheoryQuestion[] }
 *
 * The questions are returned ordered by set_number ASC, then by the created_at
 * timestamp so revision sets are always presented in the intended sequence.
 *
 * Authentication: requires a valid x-session-token or x-guest-token header.
 * Returns 401 when no valid token is present.
 * Returns 503 when no database is configured (e.g. local dev without DATABASE_URL).
 */
export async function GET(req: NextRequest) {
  try {
    const uid = getVerifiedUid(req)
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const moduleFilter   = searchParams.get("module")?.trim()   ?? null
    const categoryFilter = searchParams.get("category")?.trim() ?? null

    const pool = await getPgPool()
    if (!pool) {
      return NextResponse.json(
        { error: "No database configured" },
        { status: 503 },
      )
    }

    // Build a parameterised query so module/category filters are applied at the
    // DB level rather than in JavaScript, keeping payload sizes manageable.
    const conditions: string[] = []
    const params: string[]     = []

    if (moduleFilter) {
      params.push(moduleFilter)
      conditions.push(`LOWER(module) = LOWER($${params.length})`)
    }
    if (categoryFilter) {
      params.push(categoryFilter)
      conditions.push(`LOWER(category) = LOWER($${params.length})`)
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : ""

    const result = await pool.query(
      `SELECT id, category, module, set_number, data
         FROM mednexus_theory_questions
         ${whereClause}
         ORDER BY set_number ASC, created_at ASC`,
      params,
    )

    // Merge the scalar columns back with the JSONB data payload so the client
    // always receives a complete, typed TheoryQuestion object.
    const questions: TheoryQuestion[] = result.rows.map((row) => ({
      id:            row.id,
      category:      row.category,
      module:        row.module,
      setNumber:     row.set_number,
      prompt:        row.data?.prompt        ?? "",
      modelAnswer:   row.data?.modelAnswer   ?? "",
      criticalFlags: row.data?.criticalFlags ?? [],
      pastPapers:    row.data?.pastPapers    ?? [],
      tags:          row.data?.tags          ?? [],
    }))

    return NextResponse.json({ questions })
  } catch (err) {
    console.error("[theory/questions GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
