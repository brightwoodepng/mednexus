import { NextRequest, NextResponse } from "next/server"
import { verifyGuestToken } from "@/lib/guest-auth"
import { verifySessionToken } from "@/lib/session-auth"
import { verifyAdminToken } from "@/lib/admin-auth"

/** Trusted request identity. Never derive identity or privileges from request data. */
export interface TheoryCaller { uid: string; kind: "session" | "guest" }

export function getTheoryCaller(request: NextRequest): TheoryCaller | null {
  const session = request.headers.get("x-session-token")
  if (session) {
    const payload = verifySessionToken(session)
    if (payload?.uid) return { uid: payload.uid, kind: "session" }
  }
  const guest = request.headers.get("x-guest-token")
  if (guest) {
    const payload = verifyGuestToken(guest)
    if (payload?.uid) return { uid: payload.uid, kind: "guest" }
  }
  return null
}

export function requireTheoryCaller(request: NextRequest): TheoryCaller | NextResponse {
  return getTheoryCaller(request) ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

/** Admin access is exclusively established by the existing signed admin token. */
export function requireTheoryAdmin(request: NextRequest): NextResponse | null {
  return verifyAdminToken(request.headers.get("x-admin-token") ?? "")
    ? null
    : NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
