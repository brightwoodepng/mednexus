import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"

async function getPool() {
  const { default: pool } = await import("@/lib/db")
  return pool
}

export async function GET(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_users")) {
    return await adminAccessDenied(req)
  }

  try {
    const queryStartedAt = performance.now()
    const { searchParams } = req.nextUrl
    const search = (searchParams.get("search") ?? "").slice(0, 200)
    const sort = searchParams.get("sort") ?? "created_at"
    const order = searchParams.get("order") === "asc" ? "ASC" : "DESC"

    const allowed = ["created_at", "name", "class_level", "last_active"]
    const sortCol = allowed.includes(sort)
      ? sort === "last_active" ? "COALESCE(p.updated_at, g.created_at)" : `g.${sort}`
      : "g.created_at"

    const pool = await getPool()
    const { page, pageSize, offset } = boundedPagination(searchParams)

    let query = `
      SELECT
        g.uid,
        g.name,
        g.class_level,
        g.role,
        g.created_at,
        g.expires_at,
        COALESCE(p.updated_at, g.created_at) AS last_active,
        COUNT(*) OVER()::int AS total_count
      FROM mednexus_guest_users g
      LEFT JOIN mednexus_progress p ON p.uid = g.uid
      WHERE g.expires_at > NOW()
    `
    const params: (string | number)[] = []

    if (search) {
      params.push(`%${search}%`)
      query += ` AND g.name ILIKE $${params.length}`
    }

    params.push(pageSize, offset)
    query += ` ORDER BY ${sortCol} ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`

    const result = await pool.query(query, params)
    const total = Number(result.rows[0]?.total_count ?? 0)
    const guests = result.rows.map(({ total_count: _totalCount, ...guest }) => guest)
    return measuredJson({
      route: "GET /api/admin/guests",
      queryStartedAt,
      rowCount: guests.length,
      payload: { guests, total, page, pageSize },
    })
  } catch (err) {
    console.error("[admin/guests GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
