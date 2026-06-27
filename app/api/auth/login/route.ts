import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

function formatIndexNumber(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "")
  const match = cleaned.match(/^sm(sms|gem)(\d{2})(\d{4})$/)
  if (match) {
    const [, type, year, seq] = match
    return `sm/${type}/${year}/${seq}`
  }
  return raw.trim().toLowerCase()
}

async function getPool() {
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  return pool
}

export async function POST(req: NextRequest) {
  try {
    const { indexNumber, password } = await req.json()

    if (!indexNumber?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "Index number and password are required" }, { status: 400 })
    }

    const formatted = formatIndexNumber(indexNumber)
    const pool = await getPool()

    const result = await pool.query(
      `SELECT uid, name, level, index_number, password_hash, status, must_change_password, otp_hash
       FROM mednexus_registered_users WHERE index_number = $1`,
      [formatted]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Invalid index number or password" }, { status: 401 })
    }

    const user = result.rows[0]

    if (user.status === "pending") {
      return NextResponse.json({ error: "Your account is pending approval. Please contact the admin." }, { status: 403 })
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (passwordMatch) {
      return NextResponse.json({
        uid: user.uid,
        name: user.name,
        level: user.level,
        status: user.status,
        indexNumber: user.index_number,
        requiresPasswordUpdate: user.must_change_password,
      })
    }

    if (user.otp_hash) {
      const otpMatch = await bcrypt.compare(password, user.otp_hash)
      if (otpMatch) {
        await pool.query(
          `UPDATE mednexus_registered_users SET otp_hash = NULL, must_change_password = TRUE WHERE uid = $1`,
          [user.uid]
        )
        return NextResponse.json({
          uid: user.uid,
          name: user.name,
          level: user.level,
          status: user.status,
          indexNumber: user.index_number,
          requiresPasswordUpdate: true,
        })
      }
    }

    return NextResponse.json({ error: "Invalid index number or password" }, { status: 401 })
  } catch (err) {
    console.error("[auth/login]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
