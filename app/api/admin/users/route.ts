import { NextRequest, NextResponse } from "next/server"
import { verifyAdminToken } from "@/lib/admin-auth"

async function getPool() {
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  return pool
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? ""
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = req.nextUrl
    const search = searchParams.get("search") ?? ""
    const status = searchParams.get("status") ?? ""
    const sort = searchParams.get("sort") ?? "created_at"
    const order = searchParams.get("order") === "asc" ? "ASC" : "DESC"

    const allowed = ["created_at", "name", "status"]
    const sortCol = allowed.includes(sort) ? sort : "created_at"

    const pool = await getPool()

    let query = `SELECT uid, name, level, index_number, status, must_change_password, created_at
                 FROM mednexus_registered_users WHERE 1=1`
    const params: string[] = []

    if (search) {
      params.push(`%${search}%`)
      query += ` AND (name ILIKE $${params.length} OR index_number ILIKE $${params.length})`
    }
    if (status === "approved" || status === "pending") {
      params.push(status)
      query += ` AND status = $${params.length}`
    }

    query += ` ORDER BY ${sortCol} ${order}`

    const result = await pool.query(query, params)

    const total = await pool.query("SELECT COUNT(*) FROM mednexus_registered_users")
    const totalCount = parseInt(total.rows[0].count, 10)

    return NextResponse.json({ users: result.rows, total: totalCount })
  } catch (err) {
    console.error("[admin/users GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
