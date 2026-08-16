import "server-only"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { verifyGuestToken } from "@/lib/guest-auth"
import { verifySessionToken } from "@/lib/session-auth"

export type AdminPermission = "manage_mcq_content" | "manage_theory_content" | "manage_assessments" | "manage_users" | "manage_broadcasts" | "manage_system"
export type ServerRole = "STUDENT" | "ADMIN" | "SUPER_ADMIN" | "GUEST"
export type RequestAuth = { uid: string; role: ServerRole; permissions: ReadonlySet<AdminPermission>; isGuest: boolean }

export const ADMIN_PERMISSIONS: readonly AdminPermission[] = ["manage_mcq_content", "manage_theory_content", "manage_assessments", "manage_users", "manage_broadcasts", "manage_system"]
const ADMIN_BASELINE = new Set<AdminPermission>(["manage_mcq_content", "manage_theory_content", "manage_assessments", "manage_users", "manage_broadcasts"])
const requestAuthCache = new Map<string, { expiresAt: number; value: RequestAuth | null }>()

function cacheRequestAuth(key: string, cacheMs: number | undefined, value: RequestAuth | null) {
  if (!cacheMs) return
  if (requestAuthCache.size >= 5_000) {
    const now = Date.now()
    for (const [candidate, entry] of requestAuthCache) {
      if (entry.expiresAt <= now) requestAuthCache.delete(candidate)
    }
    if (requestAuthCache.size >= 5_000) requestAuthCache.delete(requestAuthCache.keys().next().value!)
  }
  requestAuthCache.set(key, { expiresAt: Date.now() + cacheMs, value })
}

export const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })
export const forbidden = () => NextResponse.json({ error: "Forbidden" }, { status: 403 })
/** @deprecated Use unauthorized. */
export const authError = unauthorized

async function registeredToken(req: Request) {
  // The HttpOnly secure cookie is the browser credential. The header is retained
  // only for non-browser API clients during migration; it is never an identity field.
  return req.headers.get("cookie")?.match(/(?:^|;\s*)mednexus_session=([^;]+)/)?.[1]
    ?? (await cookies()).get("mednexus_session")?.value
    ?? req.headers.get("x-session-token")
}

/** Resolves a signed session to a currently approved database account. */
export async function getRequestAuth(req: Request, options: { allowGuest?: boolean; cacheMs?: number } = {}): Promise<RequestAuth | null> {
  // An explicit guest credential represents the account currently selected in
  // the client. Prefer it over a stale registered cookie/token that may still
  // exist after the user switches to Guest mode on the same browser.
  const explicitGuest = options.allowGuest ? verifyGuestToken(req.headers.get("x-guest-token") ?? "") : null
  if (explicitGuest) {
    const cacheKey = `guest:${explicitGuest.uid}`
    const cached = options.cacheMs ? requestAuthCache.get(cacheKey) : undefined
    if (cached && cached.expiresAt > Date.now()) return cached.value
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query("SELECT uid FROM mednexus_guest_users WHERE uid = $1 AND expires_at > NOW()", [explicitGuest.uid])
    const value = result.rows.length
      ? { uid: explicitGuest.uid, role: "GUEST" as const, permissions: new Set<AdminPermission>(), isGuest: true }
      : null
    cacheRequestAuth(cacheKey, options.cacheMs, value)
    return value
  }
  const session = verifySessionToken((await registeredToken(req)) ?? "")
  if (session) {
    const cacheKey = `registered:${session.uid}`
    const cached = options.cacheMs ? requestAuthCache.get(cacheKey) : undefined
    if (cached && cached.expiresAt > Date.now()) return cached.value
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query(
      `SELECT u.role, p.permission, p.granted FROM mednexus_registered_users u
       LEFT JOIN mednexus_user_permissions p ON p.user_id = u.uid
       WHERE u.uid = $1 AND u.status = 'approved'`, [session.uid],
    )
    if (!result.rows.length) {
      cacheRequestAuth(cacheKey, options.cacheMs, null)
      return null
    }
    const role: ServerRole = result.rows[0].role === "SUPER_ADMIN" ? "SUPER_ADMIN" : result.rows[0].role === "ADMIN" ? "ADMIN" : "STUDENT"
    const overrides = new Map<AdminPermission, boolean>()
    for (const row of result.rows) if (ADMIN_PERMISSIONS.includes(row.permission as AdminPermission)) overrides.set(row.permission, row.granted !== false)
    const permissions = new Set<AdminPermission>()
    for (const permission of ADMIN_PERMISSIONS) if (role === "SUPER_ADMIN" || (overrides.get(permission) ?? (role === "ADMIN" && ADMIN_BASELINE.has(permission)))) permissions.add(permission)
    const value = { uid: session.uid, role, permissions, isGuest: false } satisfies RequestAuth
    cacheRequestAuth(cacheKey, options.cacheMs, value)
    return value
  }
  if (!options.allowGuest) return null
  return null
}

export async function requireRegisteredUser(req: Request) {
  const auth = await getRequestAuth(req)
  return auth && !auth.isGuest ? auth : null
}
export async function requireAuthenticatedUser(req: Request, options: { cacheMs?: number } = {}) {
  return getRequestAuth(req, { allowGuest: true, cacheMs: options.cacheMs })
}
export async function requireAdminPermission(req: Request, permission: AdminPermission) {
  const auth = await requireRegisteredUser(req)
  return auth?.permissions.has(permission) ? auth : null
}
export async function requireSuperAdmin(req: Request) {
  const auth = await requireRegisteredUser(req)
  return auth?.role === "SUPER_ADMIN" ? auth : null
}

/** Browser-provided identity fields are forbidden when they conflict; routes should not use them at all. */
export function identityMismatch(supplied: unknown, auth: Pick<RequestAuth, "uid">) { return typeof supplied === "string" && supplied !== auth.uid }

/**
 * Compatibility adapter for older routes. New protected routes must use one of
 * the async require* helpers above so account status and permissions are read
 * from the database.
 */
export function authenticateRequest(headers: Headers): RequestAuth | null {
  const session = verifySessionToken(headers.get("x-session-token") ?? "")
  if (session) return { uid: session.uid, role: "STUDENT", permissions: new Set(), isGuest: false }
  const guest = verifyGuestToken(headers.get("x-guest-token") ?? "")
  return guest ? { uid: guest.uid, role: "GUEST", permissions: new Set(), isGuest: true } : null
}
