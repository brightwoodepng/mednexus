import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    await ensureSchema()
    const uid = req.nextUrl.searchParams.get("uid")
    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 })

    const [userRes, progressRes] = await Promise.all([
      pool.query("SELECT name FROM mednexus_users WHERE uid = $1", [uid]),
      pool.query("SELECT data FROM mednexus_progress WHERE uid = $1", [uid]),
    ])

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({
      uid,
      name: userRes.rows[0].name,
      progress: progressRes.rows[0]?.data ?? {},
    })
  } catch (err) {
    console.error("[sync GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema()
    const body = await req.json()
    const { uid, name, progress } = body

    if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 })

    await pool.query(
      `INSERT INTO mednexus_users (uid, name)
       VALUES ($1, $2)
       ON CONFLICT (uid) DO UPDATE SET name = EXCLUDED.name`,
      [uid, name ?? "Clinician"],
    )

    if (progress !== undefined) {
      await pool.query(
        `INSERT INTO mednexus_progress (uid, data, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (uid) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [uid, JSON.stringify(progress)],
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[sync POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
