// ============================================================================
// MedNexus — Registered User Session Token Utilities
// ============================================================================
// Stateless HMAC-SHA256 tokens for registered users.  The same signing
// pattern as lib/guest-auth.ts — payload is base64url(JSON) and the
// signature is an HMAC-SHA256 over that data, appended after a dot.
//
// Tokens are returned to the client at login and sent back on each request
// as the x-session-token header.
// ============================================================================

import crypto from "crypto"

let warnedAboutDevSecret = false

function getSessionSecret() {
  const s = process.env.SESSION_SECRET
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[session-auth] SESSION_SECRET is not set. " +
          "Set this environment variable before deploying.",
      )
    }
    if (!warnedAboutDevSecret) {
      warnedAboutDevSecret = true
      console.warn(
        "[session-auth] SESSION_SECRET is not set. " +
          "Using insecure dev fallback — do NOT deploy without setting it.",
      )
    }
    return "mednexus-dev-session-secret-insecure"
  }
  return s
}

export interface SessionPayload {
  uid: string
  role: string
  /** Unix epoch seconds — token invalid after this. */
  exp: number
}

/**
 * Creates a signed session token for a registered user.
 * Default TTL: 30 days.
 */
export function createSessionToken(uid: string, role: string, ttlHours = 24 * 30): string {
  const payload: SessionPayload = {
    uid,
    role,
    exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
  }
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = crypto.createHmac("sha256", getSessionSecret()).update(data).digest("base64url")
  return `${data}.${sig}`
}

/**
 * Verifies a session token and returns its payload.
 * Returns null when the token is missing, malformed, tampered, or expired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  const secret = getSessionSecret()
  try {
    if (!token) return null
    const dot = token.lastIndexOf(".")
    if (dot === -1) return null
    const data = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url")
    const sigBuf = Buffer.from(sig)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null
    const payload: SessionPayload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"))
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    if (!payload.uid) return null
    return payload
  } catch {
    return null
  }
}
