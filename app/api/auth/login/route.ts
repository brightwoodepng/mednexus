import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { createSessionToken } from "@/lib/session-auth"

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
      `SELECT uid, name, level, class_level, role, index_number,
              password_hash, status, must_change_password, otp_hash
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

    if (user.status === "rejected") {
      return NextResponse.json({ error: "Your account has been rejected. Please contact the admin for more information." }, { status: 403 })
    }

    // Resolve classLevel: prefer the canonical class_level column; fall back to
    // the legacy level column for rows not yet migrated.
    const classLevel: string = user.class_level || user.level || ""
    const role: string = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? user.role : "STUDENT"

    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    const loginResponse = (requiresPasswordUpdate: boolean) => {
      const sessionToken = createSessionToken(user.uid, role)
      const response = NextResponse.json({ uid: user.uid, name: user.name, classLevel, role, level: classLevel, status: user.status, indexNumber: user.index_number, requiresPasswordUpdate, sessionToken })
      response.cookies.set("mednexus_session", sessionToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 })
      return response
    }

    if (passwordMatch) return loginResponse(Boolean(user.must_change_password))

    if (user.otp_hash && await bcrypt.compare(password, user.otp_hash)) {
      await pool.query(`UPDATE mednexus_registered_users SET otp_hash = NULL, must_change_password = TRUE WHERE uid = $1`, [user.uid])
      return loginResponse(true)
    }

    return NextResponse.json({ error: "Invalid index number or password" }, { status: 401 })
  } catch (err) {
    console.error("[auth/login]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
