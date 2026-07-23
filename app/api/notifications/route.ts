import { NextRequest, NextResponse } from "next/server"
import { requireAdminRequest } from "@/lib/admin-access"
import { authenticateRequest } from "@/lib/request-auth"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool } = await import("@/lib/db")
    return pool
  } catch {
    return null
  }
}

function isValidType(type: unknown): type is "info" | "update" | "alert" {
  return type === "info" || type === "update" || type === "alert"
}

function adminUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

// GET /api/notifications — broadcasts plus the authenticated user's read state.
export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req.headers)
    if (!auth) return adminUnauthorized()

    const pool = await getPool()
    if (!pool) return NextResponse.json({ notifications: [] })

    const isAdmin = await requireAdminRequest(req, "manage_broadcasts")
    const res = await pool.query(
      `SELECT n.id, n.title, n.body, n.type, n.admin_only, n.created_at,
              COALESCE(s.is_read, FALSE) AS is_read
         FROM mednexus_notifications n
         LEFT JOIN mednexus_notification_states s
           ON s.notification_id = n.id AND s.user_id = $1
        WHERE ($2 OR n.admin_only = FALSE)
        ORDER BY n.created_at DESC
        LIMIT 100`,
      [auth.uid, isAdmin],
    )

    return NextResponse.json({
      notifications: res.rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        type: r.type,
        adminOnly: r.admin_only,
        isRead: r.is_read,
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error("[notifications GET]", err)
    return NextResponse.json({ notifications: [] })
  }
}

// POST /api/notifications — verified admins create broadcasts.
export async function POST(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_broadcasts")) return adminUnauthorized()

  try {
    const { title, body, type = "info", adminOnly = false } = await req.json()
    if (typeof title !== "string" || typeof body !== "string" || !title.trim() || !body.trim()) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 })
    }
    if (!isValidType(type)) return NextResponse.json({ error: "invalid type" }, { status: 400 })
    if (typeof adminOnly !== "boolean") return NextResponse.json({ error: "adminOnly must be a boolean" }, { status: 400 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await pool.query(
      "INSERT INTO mednexus_notifications (id, title, body, type, admin_only) VALUES ($1, $2, $3, $4, $5)",
      [id, title.trim(), body.trim(), type, adminOnly],
    )
    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error("[notifications POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH /api/notifications — update the caller's read state, or edit a broadcast as an admin.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id } = body
    if (typeof id !== "string" || !id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    // Read-state requests are intentionally separate from broadcast content.
    if (typeof body.isRead === "boolean") {
      const auth = authenticateRequest(req.headers)
      if (!auth) return adminUnauthorized()
      const pool = await getPool()
      if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

      const result = await pool.query(
        `INSERT INTO mednexus_notification_states (notification_id, user_id, is_read, updated_at)
         SELECT id, $2, $3, NOW() FROM mednexus_notifications WHERE id = $1
         ON CONFLICT (notification_id, user_id)
         DO UPDATE SET is_read = EXCLUDED.is_read, updated_at = NOW()
         RETURNING notification_id`,
        [id, auth.uid, body.isRead],
      )
      if (result.rowCount === 0) return NextResponse.json({ error: "Notification not found" }, { status: 404 })
      return NextResponse.json({ success: true, isRead: body.isRead })
    }

    // Broadcast edits can only be made with a verified admin token.
    if (!await requireAdminRequest(req, "manage_broadcasts")) return adminUnauthorized()
    const updates: string[] = []
    const values: unknown[] = []
    if (typeof body.title === "string") {
      if (!body.title.trim()) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 })
      values.push(body.title.trim()); updates.push(`title = $${values.length}`)
    }
    if (typeof body.body === "string") {
      if (!body.body.trim()) return NextResponse.json({ error: "body cannot be empty" }, { status: 400 })
      values.push(body.body.trim()); updates.push(`body = $${values.length}`)
    }
    if (body.type !== undefined) {
      if (!isValidType(body.type)) return NextResponse.json({ error: "invalid type" }, { status: 400 })
      values.push(body.type); updates.push(`type = $${values.length}`)
    }
    if (body.adminOnly !== undefined) {
      if (typeof body.adminOnly !== "boolean") return NextResponse.json({ error: "adminOnly must be a boolean" }, { status: 400 })
      values.push(body.adminOnly); updates.push(`admin_only = $${values.length}`)
    }
    if (!updates.length) return NextResponse.json({ error: "No broadcast fields supplied" }, { status: 400 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })
    values.push(id)
    const result = await pool.query(
      `UPDATE mednexus_notifications SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING id`,
      values,
    )
    if (result.rowCount === 0) return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[notifications PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/notifications — verified admins permanently remove broadcasts.
export async function DELETE(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_broadcasts")) return adminUnauthorized()

  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })
    await pool.query("DELETE FROM mednexus_notifications WHERE id = $1", [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[notifications DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
