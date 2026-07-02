// ============================================================================
// POST /api/auth/guest — Create a persistent guest user session
// ============================================================================
// Body:    { name: string, classLevel: string }
// Returns: { uid, name, classLevel, role, sessionToken, expiresAt, createdAt }
//
// No password is required.  A unique UUID is generated for the guest and a
// signed session token (valid 7 days) is returned.  The token is the guest's
// only credential — store it on the client (localStorage / cookie) and send
// it as the x-guest-token header on subsequent requests.
// ============================================================================

import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createGuestToken } from "@/lib/guest-auth"
import { isValidLevel } from "@/lib/levels"

async function getPool() {
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  return pool
}

export async function POST(req: NextRequest) {
  try {
    // ── Parse & validate request body ────────────────────────────────────────
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 })
    }

    const { name, classLevel } = body as Record<string, unknown>

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }
    if (typeof classLevel !== "string" || !classLevel.trim()) {
      return NextResponse.json({ error: "classLevel is required" }, { status: 400 })
    }
    if (!isValidLevel(classLevel.trim())) {
      return NextResponse.json(
        {
          error: "Invalid classLevel",
          validLevels: [
            "Level 100", "Level 200", "Level 300", "Level 400",
            "Level 500", "Level 600", "GEM 250", "GEM 300",
          ],
        },
        { status: 422 },
      )
    }

    const cleanName = name.trim()
    const cleanLevel = classLevel.trim()

    // ── Generate identity ────────────────────────────────────────────────────
    const uid = `guest_${crypto.randomUUID()}`

    // ── Create session token ─────────────────────────────────────────────────
    // TTL: 7 days (168 hours).  The expiry is embedded inside the token so
    // the server can verify it statelessly without a DB lookup.
    const TTL_HOURS = 24 * 7
    const sessionToken = createGuestToken(uid, TTL_HOURS)

    // ── Compute expires_at ───────────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + TTL_HOURS * 3600 * 1000).toISOString()

    // ── Store token hash for optional future revocation ──────────────────────
    // We only store a SHA-256 hash — the raw token is never persisted.
    const tokenHash = crypto.createHash("sha256").update(sessionToken).digest("hex")

    // ── Persist to database ──────────────────────────────────────────────────
    const pool = await getPool()
    const { rows } = await pool.query<{
      uid: string
      name: string
      class_level: string
      role: string
      created_at: string
      expires_at: string
    }>(
      `INSERT INTO mednexus_guest_users
         (uid, name, class_level, role, token_hash, created_at, expires_at)
       VALUES ($1, $2, $3, 'GUEST', $4, NOW(), $5::timestamptz)
       RETURNING uid, name, class_level, role, created_at, expires_at`,
      [uid, cleanName, cleanLevel, tokenHash, expiresAt],
    )

    const guest = rows[0]

    // ── Return session data ───────────────────────────────────────────────────
    return NextResponse.json(
      {
        uid: guest.uid,
        name: guest.name,
        classLevel: guest.class_level,
        role: guest.role,          // "GUEST"
        sessionToken,              // raw token — send as x-guest-token header
        expiresAt: guest.expires_at,
        createdAt: guest.created_at,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error("[auth/guest]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
