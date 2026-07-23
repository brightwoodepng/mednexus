import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/admin-access"

async function getPool() {
  const { default: pool } = await import("@/lib/db")
  return pool
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  if (!await requireAdminRequest(req, "manage_users")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { uid } = await params
  if (!uid) return NextResponse.json({ error: "Missing uid" }, { status: 400 })

  const pool = await getPool()

  try {
    await pool.query(`DELETE FROM mednexus_guest_users WHERE uid = $1`, [uid])
    await pool.query(`DELETE FROM mednexus_users WHERE uid = $1`, [uid])
    await pool.query(`DELETE FROM mednexus_progress WHERE uid = $1`, [uid])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/guests DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
