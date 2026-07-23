import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/admin-access"

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { questions } = await req.json()
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: "questions must be a non-empty array" },
        { status: 400 },
      )
    }

    const pool = await getPgPool()
    if (pool) {
      const result = await pool.query(
        `INSERT INTO mednexus_questions (id, data, updated_at)
         VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE
           SET data = COALESCE(mednexus_questions.data, '[]'::jsonb) || EXCLUDED.data,
               updated_at = NOW()
         RETURNING jsonb_array_length(data) AS total`,
        [JSON.stringify(questions)],
      )
      return NextResponse.json({
        success: true,
        appended: questions.length,
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
      const snap = await docRef.get()
      const existing: unknown[] = snap.exists ? (snap.data()!.data ?? []) : []
      const merged = [...existing, ...questions]
      await docRef.set({ data: merged, updatedAt: FieldValue.serverTimestamp() })
      return NextResponse.json({ success: true, appended: questions.length, total: merged.length })
    }

    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  } catch (err) {
    console.error("[questions/append POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
