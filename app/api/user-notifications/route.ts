import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/session-auth"
import { verifyGuestToken } from "@/lib/guest-auth"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool } = await import("@/lib/db")
    return pool
  } catch {
    return null
  }
}

/** Extract uid from x-session-token or x-guest-token headers. */
function getUid(req: NextRequest): string | null {
  const sessionToken = req.headers.get("x-session-token")
  if (sessionToken) return verifySessionToken(sessionToken)?.uid ?? null
  const guestToken = req.headers.get("x-guest-token")
  if (guestToken) return verifyGuestToken(guestToken)?.uid ?? null
  return null
}

// GET /api/user-notifications
// Returns personal notifications for the authenticated user, newest first.
export async function GET(req: NextRequest) {
  try {
    const uid = getUid(req)
    if (!uid) return NextResponse.json({ notifications: [] })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ notifications: [] })

    const res = await pool.query(
      `SELECT id, user_id, type, message, is_read, created_at
       FROM mednexus_user_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [uid],
    )

    return NextResponse.json({
      notifications: res.rows.map((r) => ({
        id: r.id,
        type: r.type,
        message: r.message,
        isRead: r.is_read,
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error("[user-notifications GET]", err)
    return NextResponse.json({ notifications: [] })
  }
}

// PATCH /api/user-notifications — mark a single notification as read
// Body: { id: string }
export async function PATCH(req: NextRequest) {
  try {
    const uid = getUid(req)
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    // Scope by user_id so users can only mark their own notifications
    await pool.query(
      "UPDATE mednexus_user_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
      [id, uid],
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[user-notifications PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/user-notifications — permanently remove a notification
// Body: { id: string }
export async function DELETE(req: NextRequest) {
  try {
    const uid = getUid(req)
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    await pool.query(
      "DELETE FROM mednexus_user_notifications WHERE id = $1 AND user_id = $2",
      [id, uid],
    )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[user-notifications DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
