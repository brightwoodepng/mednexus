import { NextRequest, NextResponse } from "next/server"
import { ADMIN_PERMISSIONS, adminAccessDenied, type AdminPermission, requireAdminRequest } from "@/lib/admin-access"

const roles = ["STUDENT", "ADMIN", "SUPER_ADMIN"] as const
type ManagedRole = typeof roles[number]

async function getPool() {
  const { default: pool } = await import("@/lib/db")
  return pool
}

export async function GET(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_system")) return adminAccessDenied(req)

  try {
    const pool = await getPool()
    const result = await pool.query(
      `SELECT u.uid, u.name, u.index_number, u.role,
              COALESCE(jsonb_object_agg(p.permission, p.granted)
                FILTER (WHERE p.permission IS NOT NULL), '{}'::jsonb) AS permission_overrides
       FROM mednexus_registered_users u
       LEFT JOIN mednexus_user_permissions p ON p.user_id = u.uid
       GROUP BY u.uid, u.name, u.index_number, u.role
       ORDER BY u.name ASC`,
    )
    return NextResponse.json({ permissions: ADMIN_PERMISSIONS, users: result.rows })
  } catch (error) {
    console.error("[admin/roles GET]", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const actor = await requireAdminRequest(req, "manage_system")
  if (!actor) return adminAccessDenied(req)

  try {
    const body = await req.json() as { uid?: unknown; role?: unknown; permissions?: unknown }
    if (typeof body.uid !== "string" || !body.uid) {
      return NextResponse.json({ error: "A user id is required" }, { status: 400 })
    }
    if (body.role !== undefined && (!roles.includes(body.role as ManagedRole))) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    if (body.permissions !== undefined && (typeof body.permissions !== "object" || body.permissions === null || Array.isArray(body.permissions))) {
      return NextResponse.json({ error: "permissions must be an object" }, { status: 400 })
    }

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
        await client.query("UPDATE mednexus_registered_users SET role = $1 WHERE uid = $2", [body.role, body.uid])
      }
      for (const [permission, granted] of Object.entries((body.permissions ?? {}) as Record<string, unknown>)) {
        if (!ADMIN_PERMISSIONS.includes(permission as AdminPermission) || typeof granted !== "boolean") {
          throw new Error("Invalid permission update")
        }
        await client.query(
          `INSERT INTO mednexus_user_permissions (user_id, permission, granted) VALUES ($1, $2, $3)
           ON CONFLICT (user_id, permission) DO UPDATE SET granted = EXCLUDED.granted`,
          [body.uid, permission, granted],
        )
      }
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      if (error instanceof Error && error.message === "Invalid permission update") {
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
