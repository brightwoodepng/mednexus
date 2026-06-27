import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

async function getPool() {
  if (!process.env.DATABASE_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    return pool
  } catch {
    return null
  }
}

// POST /api/auth/register — { name, level, indexNumber, password }
export async function POST(req: NextRequest) {
  try {
    const { name, level, indexNumber, password } = await req.json()

    if (!name || !level || !indexNumber || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 })
    }
    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be at least 4 characters" }, { status: 400 })
    }

    const pool = await getPool()
    if (!pool) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }

    // Check if index number already exists
    const existing = await pool.query(
      "SELECT uid FROM mednexus_users WHERE index_number = $1",
      [indexNumber.trim()]
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "Index number already registered" }, { status: 409 })
    }

    const uid = crypto.randomUUID()
    const passwordHash = await bcrypt.hash(password, 10)

    await pool.query(
      `INSERT INTO mednexus_users (uid, name, level, index_number, password_hash, user_type)
       VALUES ($1, $2, $3, $4, $5, 'registered')`,
      [uid, name.trim(), level.trim(), indexNumber.trim(), passwordHash]
    )

    // Initialise empty progress record
    await pool.query(
      `INSERT INTO mednexus_progress (uid, data, updated_at)
       VALUES ($1, '{}'::jsonb, NOW())
       ON CONFLICT (uid) DO NOTHING`,
      [uid]
    )

    return NextResponse.json({ uid, name: name.trim(), level: level.trim() })
  } catch (err) {
    console.error("[auth/register POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
