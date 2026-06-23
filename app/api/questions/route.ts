import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken } from "@/lib/admin-auth"

// Lazy-load DB drivers so missing env vars don't crash the module
async function getPgPool() {
  if (!process.env.DATABASE_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
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

// GET /api/questions — public, returns current question bank
export async function GET() {
  try {
    // Try PostgreSQL first
    const pool = await getPgPool()
    if (pool) {
      const res = await pool.query(
        "SELECT data, updated_at FROM mednexus_questions WHERE id = 1",
      )
      if (res.rows.length === 0) {
        return NextResponse.json({ questions: null, updatedAt: null })
      }
      return NextResponse.json({
        questions: res.rows[0].data,
        updatedAt: res.rows[0].updated_at,
      })
    }

    // Fall back to Firestore
    const db = await getFirestore()
    if (db) {
      const snap = await db.collection("mednexus").doc("questions").get()
      if (!snap.exists) {
        return NextResponse.json({ questions: null, updatedAt: null })
      }
      const data = snap.data()!
      return NextResponse.json({
        questions: data.data ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      })
    }

    return NextResponse.json({ questions: null, updatedAt: null })
  } catch (err) {
    console.error("[questions GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PUT /api/questions — admin only, saves question bank
export async function PUT(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? ""
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { questions } = await req.json()
    if (!Array.isArray(questions)) {
      return NextResponse.json(
        { error: "questions must be an array" },
        { status: 400 },
      )
    }

    // Try PostgreSQL first
    const pool = await getPgPool()
    if (pool) {
      await pool.query(
        `INSERT INTO mednexus_questions (id, data, updated_at)
         VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [JSON.stringify(questions)],
      )
      return NextResponse.json({ success: true, count: questions.length })
    }

    // Fall back to Firestore
    const db = await getFirestore()
    if (db) {
      const { FieldValue } = await import("firebase-admin/firestore")
      await db.collection("mednexus").doc("questions").set({
        data: questions,
        updatedAt: FieldValue.serverTimestamp(),
      })
      return NextResponse.json({ success: true, count: questions.length })
    }

    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  } catch (err) {
    console.error("[questions PUT]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
