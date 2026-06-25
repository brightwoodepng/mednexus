import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken } from "@/lib/admin-auth"

async function getPool() {
  if (!process.env.DATABASE_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    return pool
  } catch {
    return null
  }
}

// GET /api/notifications — public, returns all notifications sorted newest first
export async function GET() {
  try {
    const pool = await getPool()
    if (!pool) return NextResponse.json({ notifications: [] })
    const res = await pool.query(
      "SELECT id, title, body, type, created_at FROM mednexus_notifications ORDER BY created_at DESC LIMIT 100"
    )
    return NextResponse.json({
      notifications: res.rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        type: r.type,
        createdAt: r.created_at,
      })),
    })
  } catch (err) {
    console.error("[notifications GET]", err)
    return NextResponse.json({ notifications: [] })
  }
}

// POST /api/notifications — admin only, creates a broadcast message
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? ""
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { title, body, type = "info" } = await req.json()
    if (!title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 })
    }
    if (!["info", "update", "alert"].includes(type)) {
      return NextResponse.json({ error: "invalid type" }, { status: 400 })
    }

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await pool.query(
      "INSERT INTO mednexus_notifications (id, title, body, type) VALUES ($1, $2, $3, $4)",
      [id, title.trim(), body.trim(), type]
    )
    return NextResponse.json({ success: true, id })
  } catch (err) {
    console.error("[notifications POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/notifications — admin only, deletes a notification by id
export async function DELETE(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? ""
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
