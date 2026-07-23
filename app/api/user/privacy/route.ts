import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"

// PATCH /api/user/privacy
// Body: { isPrivate: boolean }
// Toggles the is_private flag on the registered user's profile.
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { isPrivate } = await req.json()
    if (typeof isPrivate !== "boolean") {
      return NextResponse.json({ error: "isPrivate is required" }, { status: 400 })
    }

    const res = await pool.query(
      `UPDATE mednexus_registered_users
       SET is_private = $2
       WHERE uid = $1
       RETURNING uid, is_private`,
      [auth.uid, isPrivate]
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

// GET /api/user/privacy
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()

    const res = await pool.query(
      `SELECT uid, is_private FROM mednexus_registered_users WHERE uid = $1`,
      [auth.uid]
    )
    if (!res.rows[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ uid: res.rows[0].uid, isPrivate: res.rows[0].is_private })
  } catch (err) {
    console.error("[privacy GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
