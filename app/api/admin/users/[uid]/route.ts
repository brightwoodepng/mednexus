import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { verifyAdminToken } from "@/lib/admin-auth"

async function getPool() {
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  return pool
}

function requireAdmin(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? ""
  return verifyAdminToken(token)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { uid } = await params
  const body = await req.json()
  const { action } = body

  if (!uid || !action) {
    return NextResponse.json({ error: "Missing uid or action" }, { status: 400 })
  }

  const pool = await getPool()

  try {
    if (action === "approve") {
      await pool.query(
        `UPDATE mednexus_registered_users SET status = 'approved' WHERE uid = $1`,
        [uid]
      )
      return NextResponse.json({ success: true })
    }

    if (action === "reject") {
      await pool.query(
        `UPDATE mednexus_registered_users SET status = 'rejected' WHERE uid = $1`,
        [uid]
      )
      return NextResponse.json({ success: true })
    }

    if (action === "reset-password") {
      const digits = "0123456789"
      let otp = ""
      for (let i = 0; i < 6; i++) otp += digits[Math.floor(Math.random() * 10)]
      const otpHash = await bcrypt.hash(otp, 10)
      await pool.query(
        `UPDATE mednexus_registered_users
         SET otp_hash = $1, must_change_password = TRUE WHERE uid = $2`,
        [otpHash, uid]
      )
      return NextResponse.json({ success: true, otp })
    }

    if (action === "edit-level") {
      const { level } = body as { level?: string }
      if (!level || typeof level !== "string" || !level.trim()) {
        return NextResponse.json({ error: "level is required" }, { status: 400 })
      }
      await pool.query(
        `UPDATE mednexus_registered_users SET level = $1, class_level = $1 WHERE uid = $2`,
        [level.trim(), uid]
      )
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error("[admin/users PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { uid } = await params
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 })

  const pool = await getPool()

  try {
    await pool.query(`DELETE FROM mednexus_registered_users WHERE uid = $1`, [uid])
    await pool.query(`DELETE FROM mednexus_users WHERE uid = $1`, [uid])
    await pool.query(`DELETE FROM mednexus_progress WHERE uid = $1`, [uid])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/users DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
