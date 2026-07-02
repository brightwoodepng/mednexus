import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken } from "@/lib/admin-auth"

async function getPool() {
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  return pool
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const token = req.headers.get("x-admin-token") ?? ""
  if (!verifyAdminToken(token)) {
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
