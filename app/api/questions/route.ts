import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"
import { verifyAdminToken } from "@/lib/admin-auth"

// GET /api/questions — public, returns current question bank
export async function GET() {
  try {
    await ensureSchema()
    const res = await pool.query("SELECT data, updated_at FROM mednexus_questions WHERE id = 1")
    if (res.rows.length === 0) {
      // No custom questions saved yet — return empty so client uses static DB
      return NextResponse.json({ questions: null, updatedAt: null })
    }
    return NextResponse.json({
      questions: res.rows[0].data,
      updatedAt: res.rows[0].updated_at,
    })
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
    await ensureSchema()
    const { questions } = await req.json()
    if (!Array.isArray(questions)) {
      return NextResponse.json({ error: "questions must be an array" }, { status: 400 })
    }

    await pool.query(
      `INSERT INTO mednexus_questions (id, data, updated_at)
       VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(questions)],
    )

    return NextResponse.json({ success: true, count: questions.length })
  } catch (err) {
    console.error("[questions PUT]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
