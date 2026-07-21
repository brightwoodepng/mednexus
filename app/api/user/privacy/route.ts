import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"

// PATCH /api/user/privacy
// Body: { uid: string, isPrivate: boolean }
// Toggles the is_private flag on the registered user's profile.
export async function PATCH(req: NextRequest) {
  try {
    await ensureSchema()
    const { uid, isPrivate } = await req.json()
    if (!uid || typeof isPrivate !== "boolean") {
      return NextResponse.json({ error: "uid and isPrivate are required" }, { status: 400 })
    }

    const res = await pool.query(
      `UPDATE mednexus_registered_users
       SET is_private = $2
       WHERE uid = $1
       RETURNING uid, is_private`,
      [uid, isPrivate]
    )
    if (!res.rows[0]) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    return NextResponse.json({ uid: res.rows[0].uid, isPrivate: res.rows[0].is_private })
  } catch (err) {
    console.error("[privacy PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// GET /api/user/privacy?uid=...
export async function GET(req: NextRequest) {
  try {
    await ensureSchema()
    const uid = req.nextUrl.searchParams.get("uid")
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 })

    const res = await pool.query(
      `SELECT uid, is_private FROM mednexus_registered_users WHERE uid = $1`,
      [uid]
    )
    if (!res.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ uid: res.rows[0].uid, isPrivate: res.rows[0].is_private })
  } catch (err) {
    console.error("[privacy GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
