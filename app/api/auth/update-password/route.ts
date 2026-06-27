import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

async function getPool() {
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  return pool
}

export async function PATCH(req: NextRequest) {
  try {
    const { uid, newPassword } = await req.json()

    if (!uid || !newPassword?.trim()) {
      return NextResponse.json({ error: "Missing uid or password" }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const pool = await getPool()
    const hash = await bcrypt.hash(newPassword, 10)

    const result = await pool.query(
      `UPDATE mednexus_registered_users
       SET password_hash = $1, must_change_password = FALSE, otp_hash = NULL
       WHERE uid = $2`,
      [hash, uid]
    )

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[auth/update-password]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
