import { NextRequest, NextResponse } from "next/server"
import { ADMIN_PERMISSIONS, adminAccessDenied, type AdminPermission, requireAdminRequest } from "@/lib/admin-access"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"

const roles = ["STUDENT", "ADMIN", "SUPER_ADMIN"] as const
type ManagedRole = typeof roles[number]

async function getPool() {
  const { default: pool } = await import("@/lib/db")
  return pool
}

export async function GET(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_system")) return adminAccessDenied(req)

  try {
    const queryStartedAt = performance.now()
    const { page, pageSize, offset } = boundedPagination(req.nextUrl.searchParams)
    const search = (req.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 160)
    const pool = await getPool()
    const result = await pool.query(
      `SELECT u.uid, u.name, u.index_number, u.role,
              COALESCE(jsonb_object_agg(p.permission, p.granted)
                FILTER (WHERE p.permission IS NOT NULL), '{}'::jsonb) AS permission_overrides,
              COUNT(*) OVER()::int AS total_count
       FROM mednexus_registered_users u
       LEFT JOIN mednexus_user_permissions p ON p.user_id = u.uid
       WHERE ($3='' OR u.name ILIKE '%'||$3||'%' OR u.index_number ILIKE '%'||$3||'%')
       GROUP BY u.uid, u.name, u.index_number, u.role
       ORDER BY u.name ASC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset, search],
    )
    const payload = {
      permissions: ADMIN_PERMISSIONS,
      baselines: { STUDENT: [], ADMIN: ADMIN_PERMISSIONS.filter(permission => permission !== "manage_system"), SUPER_ADMIN: ADMIN_PERMISSIONS },
      users: result.rows.map(({ total_count: _total, ...user }) => user),
      pagination: { page, pageSize, total: Number(result.rows[0]?.total_count ?? 0) },
    }
    return measuredJson({ route: "GET /api/admin/roles", queryStartedAt, rowCount: result.rows.length, payload })
  } catch (error) {
    console.error("[admin/roles GET]", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdminRequest(req, "manage_system")
  if (!actor) return adminAccessDenied(req)

  try {
    const body = await req.json() as { uid?: unknown; role?: unknown; permissions?: unknown; confirmed?: unknown }
    if (typeof body.uid !== "string" || !body.uid) {
      return NextResponse.json({ error: "A user id is required" }, { status: 400 })
    }
    if (body.role !== undefined && (!roles.includes(body.role as ManagedRole))) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    if (body.permissions !== undefined && (typeof body.permissions !== "object" || body.permissions === null || Array.isArray(body.permissions))) {
      return NextResponse.json({ error: "permissions must be an object" }, { status: 400 })
    }
    if (body.role === undefined && body.permissions === undefined) return NextResponse.json({ error: "A role or permission change is required" }, { status: 400 })
    if (body.confirmed !== true) return NextResponse.json({ error: "Role and permission changes require confirmation" }, { status: 400 })

    const pool = await getPool()
    const target = await pool.query("SELECT role FROM mednexus_registered_users WHERE uid = $1", [body.uid])
    if (!target.rowCount) return NextResponse.json({ error: "User not found" }, { status: 404 })
    // A delegated system manager cannot create or modify the break-glass role.
    if (actor.role !== "SUPER_ADMIN" && (target.rows[0].role === "SUPER_ADMIN" || body.role === "SUPER_ADMIN")) {
      return NextResponse.json({ error: "Only a super administrator can change SUPER_ADMIN accounts" }, { status: 403 })
    }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      if (body.role !== undefined) {
        if (target.rows[0].role === "SUPER_ADMIN" && body.role !== "SUPER_ADMIN") {
          const remaining = await client.query("SELECT COUNT(*)::int AS count FROM mednexus_registered_users WHERE role = 'SUPER_ADMIN'")
          if (remaining.rows[0].count <= 1) throw new Error("Cannot demote the final remaining SUPER_ADMIN")
        }
        await client.query("UPDATE mednexus_registered_users SET role = $1 WHERE uid = $2", [body.role, body.uid])
        if (target.rows[0].role !== body.role) await client.query(
          `INSERT INTO mednexus_role_audit_log (actor_uid, target_uid, change_type, old_value, new_value)
           VALUES ($1, $2, 'ROLE_CHANGE', to_jsonb($3::text), to_jsonb($4::text))`,
          [actor.uid, body.uid, target.rows[0].role, body.role],
        )
      }
      for (const [permission, granted] of Object.entries((body.permissions ?? {}) as Record<string, unknown>)) {
        if (!ADMIN_PERMISSIONS.includes(permission as AdminPermission) || typeof granted !== "boolean") {
          throw new Error("Invalid permission update")
        }
        const previousPermission = await client.query(
          "SELECT granted FROM mednexus_user_permissions WHERE user_id = $1 AND permission = $2",
          [body.uid, permission],
        )
        await client.query(
          `INSERT INTO mednexus_user_permissions (user_id, permission, granted) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, permission) DO UPDATE SET granted = EXCLUDED.granted`,
          [body.uid, permission, granted],
        )
        await client.query(
          `INSERT INTO mednexus_role_audit_log (actor_uid, target_uid, change_type, old_value, new_value)
           VALUES ($1, $2, 'PERMISSION_CHANGE', jsonb_build_object($3::text, $4::boolean), jsonb_build_object($3::text, $5::boolean))`,
          [actor.uid, body.uid, permission, previousPermission.rows[0]?.granted ?? null, granted],
        )
      }
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      if (error instanceof Error && (error.message === "Invalid permission update" || error.message === "Cannot demote the final remaining SUPER_ADMIN")) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      throw error
    } finally {
      client.release()
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/roles PATCH]", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
