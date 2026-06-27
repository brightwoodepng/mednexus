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

// POST /api/auth/login — { indexNumber, password }
export async function POST(req: NextRequest) {
  try {
    const { indexNumber, password } = await req.json()

    if (!indexNumber || !password) {
      return NextResponse.json({ error: "Index number and password are required" }, { status: 400 })
    }

    const pool = await getPool()
    if (!pool) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
    }

    const result = await pool.query(
      "SELECT uid, name, level, password_hash FROM mednexus_users WHERE index_number = $1",
      [indexNumber.trim()]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Invalid index number or password" }, { status: 401 })
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: "Invalid index number or password" }, { status: 401 })
    }

    return NextResponse.json({
      uid: user.uid,
      name: user.name,
      level: user.level ?? "",
    })
  } catch (err) {
    console.error("[auth/login POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
