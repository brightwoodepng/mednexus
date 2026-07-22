import "server-only"

import { verifyGuestToken } from "@/lib/guest-auth"
import { verifySessionToken } from "@/lib/session-auth"

/** The only identity an economy request may use. Keep this server-only. */
export type RequestAuth = { uid: string; role: string; isGuest: boolean }

export function authenticateRequest(headers: Headers): RequestAuth | null {
  const session = headers.get("x-session-token")
  if (session) {
    const payload = verifySessionToken(session)
    return payload ? { uid: payload.uid, role: payload.role, isGuest: false } : null
  }
  const guest = headers.get("x-guest-token")
  if (guest) {
    const payload = verifyGuestToken(guest)
    return payload ? { uid: payload.uid, role: payload.role, isGuest: true } : null
  }
  return null
}

export function authError() {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}

export function identityMismatch(supplied: unknown, auth: RequestAuth) {
  return typeof supplied === "string" && supplied !== auth.uid
}
