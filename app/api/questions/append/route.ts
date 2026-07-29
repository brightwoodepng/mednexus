import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"

export const maxDuration = 120

async function getPgPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool } = await import("@/lib/db")
    return pool
  } catch {
    return null
  }
}

async function getFirestore() {
  try {
    const { getAdminDb } = await import("@/lib/firebase-admin")
    return getAdminDb()
  } catch {
    return null
  }
}

// POST /api/questions/append — admin only, appends new questions to the bank
// without transmitting the full existing bank back to the server. This keeps
// bulk imports (e.g. "Make All Live" after a PDF/Word import) fast: the
// client only sends the newly-approved questions, and Postgres merges them
// into the existing JSONB array server-side via `data || $1::jsonb`.
export async function POST(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_mcq_content")) {
    return await adminAccessDenied(req)
  }

  try {
    const { questions } = await req.json()
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "questions must be a non-empty array" },
        { status: 400 },
      )
    }
    if (questions.some((question) => !question || typeof question.id !== "string" || !question.id.trim())) {
      return NextResponse.json(
        { error: "Every question must have a stable ID before it can be saved." },
        { status: 400 },
      )
    }

    const pool = await getPgPool()
    if (pool) {
      // Filter by stable ID inside the same atomic upsert. A retry after a
      // response timeout therefore cannot append the same question twice,
      // and the full existing bank never has to travel through the server.
      const result = await pool.query(
        `INSERT INTO mednexus_questions AS target (id, data, updated_at)
         VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE
           SET data = COALESCE(target.data, '[]'::jsonb) || COALESCE(
                 (
                   SELECT jsonb_agg(incoming_question.value)
                   FROM jsonb_array_elements(EXCLUDED.data) AS incoming_question(value)
                   WHERE NOT EXISTS (
                     SELECT 1
                     FROM jsonb_array_elements(COALESCE(target.data, '[]'::jsonb)) AS existing_question(value)
                     WHERE existing_question.value->>'id' = incoming_question.value->>'id'
                   )
                 ),
                 '[]'::jsonb
               ),
               updated_at = NOW()
         RETURNING jsonb_array_length(data) AS total`,
        [JSON.stringify(questions)],
      )
      return NextResponse.json({
        success: true,
        accepted: questions.length,
        total: result.rows[0]?.total ?? null,
      })
    }

    // Firestore fallback — no atomic array-append operator for large blobs,
    // so fall back to a full read-modify-write (still cheaper than sending
    // the whole bank from the client).
    const db = await getFirestore()
    if (db) {
      const { FieldValue } = await import("firebase-admin/firestore")
      const docRef = db.collection("mednexus").doc("questions")
      const result = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(docRef)
        const existing: Array<{ id?: string }> = snap.exists ? (snap.data()!.data ?? []) : []
        const existingIds = new Set(existing.map((question) => question.id).filter(Boolean))
        const additions = questions.filter((question) => !existingIds.has(question.id))
        const merged = [...existing, ...additions]
        transaction.set(docRef, { data: merged, updatedAt: FieldValue.serverTimestamp() })
        return { additions, merged }
      })
      return NextResponse.json({
        success: true,
        appended: result.additions.length,
        skipped: questions.length - result.additions.length,
        total: result.merged.length,
      })
    }

    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  } catch (err) {
    console.error("[questions/append POST]", err)
    return NextResponse.json({
      error: "The server could not save this question chunk. The unsaved questions remain as drafts.",
    }, { status: 500 })
  }
}
