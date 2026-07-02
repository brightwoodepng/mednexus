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
    const sort = searchParams.get("sort") ?? "created_at"
    const order = searchParams.get("order") === "asc" ? "ASC" : "DESC"

    const allowed = ["created_at", "name", "class_level", "last_active"]
    const sortCol = allowed.includes(sort)
      ? sort === "last_active" ? "COALESCE(p.updated_at, g.created_at)" : `g.${sort}`
      : "g.created_at"

    const pool = await getPool()

    let query = `
      SELECT
        g.uid,
        g.name,
        g.class_level,
        g.role,
        g.created_at,
        g.expires_at,
        COALESCE(p.updated_at, g.created_at) AS last_active
      FROM mednexus_guest_users g
      LEFT JOIN mednexus_progress p ON p.uid = g.uid
      WHERE g.expires_at > NOW()
    `
    const params: (string | number)[] = []

    if (search) {
      params.push(`%${search}%`)
      query += ` AND g.name ILIKE $${params.length}`
    }

    query += ` ORDER BY ${sortCol} ${order}`

    const result = await pool.query(query, params)

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM mednexus_guest_users WHERE expires_at > NOW()`
    )
    const total = parseInt(countRes.rows[0].count, 10)

    return NextResponse.json({ guests: result.rows, total })
  } catch (err) {
    console.error("[admin/guests GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
