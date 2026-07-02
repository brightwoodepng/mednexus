// ============================================================================
// MedNexus — Guest Session Token Utilities
// ============================================================================
// Stateless HMAC-SHA256 tokens for guest users.  The token encodes a small
// JSON payload (uid + role + expiry) and appends an HMAC signature, following
// the same pattern used by lib/admin-auth.ts for admin tokens.
//
// Tokens are returned to the client at guest creation and sent back on each
// request as a Bearer token or x-guest-token header.  The server verifies
// the HMAC and checks the expiry — no database lookup needed.
// ============================================================================

import crypto from "crypto"

// Require SESSION_SECRET in production.  In development we use a fixed
// fallback so the app boots without pre-configuring secrets, but tokens
// minted with the fallback are trivially forgeable — never use in prod.
const SECRET = (() => {
  const s = process.env.SESSION_SECRET
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      // Hard failure: a missing secret in production means any attacker can
      // forge guest tokens.  Crashing early surfaces the misconfiguration.
      throw new Error(
        "[guest-auth] SESSION_SECRET is not set. " +
          "Set this environment variable before deploying.",
      )
    }
    // Development fallback — intentionally weak, prints a clear warning.
    console.warn(
      "[guest-auth] SESSION_SECRET is not set. " +
        "Using insecure dev fallback — do NOT deploy without setting it.",
    )
    return "mednexus-dev-session-secret-insecure"
  }
  return s
})()

/** Default TTL for a guest session: 7 days. */
const DEFAULT_TTL_HOURS = 24 * 7

// ── Token payload ─────────────────────────────────────────────────────────────

interface GuestTokenPayload {
  uid: string
  role: "GUEST"
  /** Unix epoch seconds — token is invalid after this timestamp. */
  exp: number
}

// ── Token creation ────────────────────────────────────────────────────────────

/**
 * Creates a signed guest session token.
 *
 * Format: `<base64url(payload)>.<base64url(hmac)>`
 *
 * @param uid       The guest user's UUID.
 * @param ttlHours  How long the token is valid (default: 7 days).
 * @returns         A compact, URL-safe token string.
 */
export function createGuestToken(uid: string, ttlHours = DEFAULT_TTL_HOURS): string {
  const payload: GuestTokenPayload = {
    uid,
    role: "GUEST",
    exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
  }

  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("base64url")
  return `${data}.${sig}`
}

// ── Token verification ────────────────────────────────────────────────────────

/**
 * Verifies a guest token and returns its payload.
 *
 * Returns `null` when:
 * - The token is malformed or missing.
 * - The HMAC signature does not match (tampered).
 * - The token has expired.
 */
export function verifyGuestToken(token: string): GuestTokenPayload | null {
  try {
    if (!token) return null

    const dot = token.lastIndexOf(".")
    if (dot === -1) return null

    const data = token.slice(0, dot)
    const sig = token.slice(dot + 1)

    // Constant-time HMAC comparison to prevent timing attacks
    const expected = crypto.createHmac("sha256", SECRET).update(data).digest("base64url")
    const sigBuf = Buffer.from(sig)
    const expBuf = Buffer.from(expected)
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null
    }

    const payload: GuestTokenPayload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"))

    // Check expiry
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    // Sanity-check shape
    if (payload.role !== "GUEST" || !payload.uid) return null

    return payload
  } catch {
    return null
  }
}
