import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"

async function getPool() {
  const { default: pool } = await import("@/lib/db")
  return pool
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const admin = await requireAdminRequest(req, "manage_users")
  if (!admin) {
    return await adminAccessDenied(req)
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
      await auditAdmin(pool, admin.uid, "approve", "user", uid)
      return NextResponse.json({ success: true })
    }

    if (action === "reject") {
      await pool.query(
        `UPDATE mednexus_registered_users SET status = 'rejected' WHERE uid = $1`,
        [uid]
      )
      await auditAdmin(pool, admin.uid, "reject", "user", uid)
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
      await auditAdmin(pool, admin.uid, "reset_password", "user", uid)
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
      await auditAdmin(pool, admin.uid, "edit_level", "user", uid, { level: level.trim() })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error("[admin/users PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const actor = await requireAdminRequest(req, "manage_users")
  if (!actor) {
    return await adminAccessDenied(req)
  }

  const { uid } = await params
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 })
  if (req.nextUrl.searchParams.get("confirm") !== "true") return NextResponse.json({ error: "Confirmation required." }, { status: 400 })

  const pool = await getPool()

  try {
    const target = await pool.query("SELECT role FROM mednexus_registered_users WHERE uid = $1", [uid])
    if (!target.rowCount) return NextResponse.json({ error: "User not found" }, { status: 404 })
    if (target.rows[0].role === "SUPER_ADMIN") {
      if (actor.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Only a super administrator can delete a SUPER_ADMIN account" }, { status: 403 })
      const superAdmins = await pool.query("SELECT COUNT(*)::int AS count FROM mednexus_registered_users WHERE role = 'SUPER_ADMIN'")
      if (superAdmins.rows[0].count <= 1) return NextResponse.json({ error: "Cannot delete the final remaining SUPER_ADMIN" }, { status: 409 })
    }
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await auditAdmin(client, actor.uid, "delete", "user", uid)
      await client.query(`DELETE FROM mednexus_registered_users WHERE uid = $1`, [uid])
      await client.query(`DELETE FROM mednexus_users WHERE uid = $1`, [uid])
      await client.query(`DELETE FROM mednexus_progress WHERE uid = $1`, [uid])
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally { client.release() }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/users DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
