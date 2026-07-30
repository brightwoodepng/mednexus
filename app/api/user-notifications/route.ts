import { NextRequest, NextResponse } from "next/server"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try { const { default: pool } = await import("@/lib/db"); return pool } catch { return null }
}

// Personal notifications are registered-user data; guests never receive them.
export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const pool = await getPool(); if (!pool) return NextResponse.json({ notifications: [] })
    const { page, pageSize, offset } = boundedPagination(req.nextUrl.searchParams)
    const res = await pool.query(
      `SELECT id, type, message, is_read, created_at, COUNT(*) OVER()::int AS total_count
       FROM mednexus_user_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [auth.uid, pageSize, offset],
    )
    const payload = {
      notifications: res.rows.map(r => ({ id:r.id, type:r.type, message:r.message, isRead:r.is_read, createdAt:r.created_at })),
      pagination: { page, pageSize, total: Number(res.rows[0]?.total_count ?? 0) },
    }
    return measuredJson({
      route: "GET /api/user-notifications",
      queryStartedAt,
      rowCount: res.rows.length,
      payload,
    })
  } catch (err) { console.error("[user-notifications GET]", err); return NextResponse.json({ error: "Server error" }, { status: 500 }) }
}
async function mutate(req: NextRequest, remove: boolean) {
  const auth = await requireRegisteredUser(req); if (!auth) return unauthorized()
  const body = await req.json()
  const pool = await getPool(); if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })
  if (!remove && body.markAllRead === true) {
    const result = await pool.query(
      "UPDATE mednexus_user_notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
      [auth.uid],
    )
    return NextResponse.json({ success: true, updated: result.rowCount ?? 0 })
  }
  const { id } = body; if (typeof id !== "string" || !id) return NextResponse.json({ error: "id is required" }, { status: 400 })
  const result = await pool.query(remove ? "DELETE FROM mednexus_user_notifications WHERE id = $1 AND user_id = $2 RETURNING id" : "UPDATE mednexus_user_notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id", [id, auth.uid])
  if (!result.rowCount) return NextResponse.json({ error: "Notification not found" }, { status: 404 })
  return NextResponse.json({ success: true })
}
export async function PATCH(req: NextRequest) { try { return await mutate(req, false) } catch (err) { console.error("[user-notifications PATCH]", err); return NextResponse.json({ error: "Server error" }, { status: 500 }) } }
export async function DELETE(req: NextRequest) { try { return await mutate(req, true) } catch (err) { console.error("[user-notifications DELETE]", err); return NextResponse.json({ error: "Server error" }, { status: 500 }) } }
