import "server-only"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { verifySessionToken, type SessionPayload } from "@/lib/session-auth"

export type AdminRole = "STUDENT" | "ADMIN" | "SUPER_ADMIN"
export type AdminPermission = "manage_mcq_content" | "manage_theory_content" | "manage_assessments" | "manage_users" | "manage_broadcasts" | "manage_system"

const permissions: Record<AdminPermission, AdminRole[]> = {
  manage_mcq_content: ["ADMIN", "SUPER_ADMIN"], manage_theory_content: ["ADMIN", "SUPER_ADMIN"],
  manage_assessments: ["ADMIN", "SUPER_ADMIN"], manage_users: ["ADMIN", "SUPER_ADMIN"],
  manage_broadcasts: ["ADMIN", "SUPER_ADMIN"], manage_system: ["SUPER_ADMIN"],
}

async function currentRole(payload: SessionPayload): Promise<AdminRole | null> {
  const { default: pool } = await import("@/lib/db")
  const result = await pool.query("SELECT role, status FROM mednexus_registered_users WHERE uid = $1", [payload.uid])
  const user = result.rows[0]
  if (!user || user.status !== "approved") return null
  return user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? user.role : "STUDENT"
}

export async function getVerifiedAdmin(token: string | null | undefined, permission?: AdminPermission) {
  const payload = verifySessionToken(token ?? "")
  if (!payload) return null
  const role = await currentRole(payload)
  if (!role || (permission && !permissions[permission].includes(role))) return null
  return { uid: payload.uid, role }
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
