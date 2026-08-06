import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"

async function getPool() {
  const { default: pool } = await import("@/lib/db")
  return pool
}

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_users")
  if (!admin) {
    return await adminAccessDenied(req)
  }

  try {
    const queryStartedAt = performance.now()
    const { searchParams } = req.nextUrl
    const search = (searchParams.get("search") ?? "").slice(0, 200)
    const status = searchParams.get("status") ?? ""
    const sort = searchParams.get("sort") ?? "created_at"
    const order = searchParams.get("order") === "asc" ? "ASC" : "DESC"

    const allowed = ["created_at", "name", "status", "index_number", "last_login_date"]
    const sortCol = allowed.includes(sort) ? sort : "created_at"

    const pool = await getPool()
    const { page, pageSize, offset } = boundedPagination(searchParams)

    let query = `SELECT uid, name, level, index_number, status, must_change_password, created_at,last_login_date,
                        (SELECT COUNT(*)::int FROM mednexus_assessment_attempts a WHERE a.user_id=mednexus_registered_users.uid) AS assessment_attempts,
                        (SELECT COUNT(*)::int FROM mednexus_theory_attempts t WHERE t.user_id=mednexus_registered_users.uid) AS theory_attempts,
                        (SELECT jsonb_object_agg(s.status,s.count) FROM (SELECT status,COUNT(*)::int AS count FROM mednexus_registered_users GROUP BY status) s) AS global_counts,
                        COUNT(*) OVER()::int AS total_count
                 FROM mednexus_registered_users WHERE 1=1`
    const params: Array<string | number> = []

    if (search) {
      params.push(`%${search}%`)
      query += ` AND (name ILIKE $${params.length} OR index_number ILIKE $${params.length})`
    }
    if (["approved", "pending", "rejected", "suspended"].includes(status)) {
      params.push(status)
      query += ` AND status = $${params.length}`
    }

    params.push(pageSize, offset)
    query += ` ORDER BY ${sortCol} ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`

    const result = await pool.query(query, params)
    const totalCount = Number(result.rows[0]?.total_count ?? (page === 1 ? result.rows.length : 0))
    const counts = result.rows[0]?.global_counts ?? {}
    const users = result.rows.map(({ total_count: _totalCount, global_counts: _globalCounts, ...user }) => user)
    return measuredJson({
      route: "GET /api/admin/users",
      queryStartedAt,
      rowCount: users.length,
      payload: { users, total: totalCount, page, pageSize, counts, canDelete: admin.role === "SUPER_ADMIN" },
    })
  } catch (err) {
    console.error("[admin/users GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
