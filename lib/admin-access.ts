import "server-only"

import { cookies } from "next/headers"
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

export async function requireAdminRequest(req: Request, permission?: AdminPermission) {
  // Cookie is primary for browser routes; header keeps authenticated API clients working.
  const token = (await cookies()).get("mednexus_session")?.value ?? req.headers.get("x-session-token")
  return getVerifiedAdmin(token, permission)
}
