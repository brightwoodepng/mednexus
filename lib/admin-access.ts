import "server-only"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { verifySessionToken, type SessionPayload } from "@/lib/session-auth"

export type AdminRole = "STUDENT" | "ADMIN" | "SUPER_ADMIN"
export type AdminPermission = "manage_mcq_content" | "manage_theory_content" | "manage_assessments" | "manage_users" | "manage_broadcasts" | "manage_system"

export const ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  "manage_mcq_content", "manage_theory_content", "manage_assessments",
  "manage_users", "manage_broadcasts", "manage_system",
]

// This is deliberately an explicit, small baseline. Per-user rows override it,
// so a system administrator can remove an individual ADMIN capability without
// changing the user's role. SUPER_ADMIN is intentionally not overridable.
const ADMIN_BASELINE = new Set<AdminPermission>([
  "manage_mcq_content", "manage_theory_content", "manage_assessments",
  "manage_users", "manage_broadcasts",
])

async function currentAccess(payload: SessionPayload): Promise<{ role: AdminRole; permissions: Map<AdminPermission, boolean> } | null> {
  const { default: pool } = await import("@/lib/db")
  // Role and individual permission overrides are read together after the token
  // has been verified. Never trust role or permissions supplied by a client.
  const result = await pool.query(
    `SELECT u.role, u.status, p.permission, p.granted
     FROM mednexus_registered_users u
     LEFT JOIN mednexus_user_permissions p ON p.user_id = u.uid
     WHERE u.uid = $1`,
    [payload.uid],
  )
  const user = result.rows[0]
  if (!user || user.status !== "approved") return null
  const role: AdminRole = user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? user.role : "STUDENT"
  const permissionOverrides = new Map<AdminPermission, boolean>()
  for (const row of result.rows) {
    if (ADMIN_PERMISSIONS.includes(row.permission as AdminPermission)) {
      permissionOverrides.set(row.permission as AdminPermission, row.granted !== false)
    }
  }
  return { role, permissions: permissionOverrides }
}

export async function getVerifiedAdmin(token: string | null | undefined, permission?: AdminPermission) {
  const payload = verifySessionToken(token ?? "")
  if (!payload) return null
  const access = await currentAccess(payload)
  if (!access) return null
  const allowed = !permission || access.role === "SUPER_ADMIN"
    || (access.permissions.get(permission) ?? (access.role === "ADMIN" && ADMIN_BASELINE.has(permission)))
  if (!allowed) return null
  return { uid: payload.uid, role: access.role }
}

export async function getVerifiedAdminFromCookie(permission?: AdminPermission) {
  const token = (await cookies()).get("mednexus_session")?.value
  return getVerifiedAdmin(token, permission)
}

async function requestSessionToken(req: Request) {
  // Cookie is primary for browser routes; header keeps authenticated API clients working.
  return (await cookies()).get("mednexus_session")?.value ?? req.headers.get("x-session-token")
}

export async function requireAdminRequest(req: Request, permission?: AdminPermission) {
  return getVerifiedAdmin(await requestSessionToken(req), permission)
}

/**
 * Use after requireAdminRequest denies a privileged request. A valid session
 * without the requested permission is forbidden; absent or invalid sessions
 * must authenticate first.
 */
export async function adminAccessDenied(req: Request) {
  const session = verifySessionToken((await requestSessionToken(req)) ?? "")
  return NextResponse.json(
    { error: session ? "Forbidden" : "Unauthorized" },
    { status: session ? 403 : 401 },
  )
}
