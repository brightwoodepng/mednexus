import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { isValidLevel } from "@/lib/levels"
import { defaultPlatformSettings, getPlatformSettings } from "@/lib/platform-settings"
import { provisionActiveSeasonWallet } from "@/lib/economy-seasons"

function formatIndexNumber(raw: string): { formatted: string; autoApprove: boolean } {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "")
  const match = cleaned.match(/^sm(sms|gem)(\d{2})(\d{4})$/)
  if (match) {
    const [, type, year, seq] = match
    return { formatted: `sm/${type}/${year}/${seq}`, autoApprove: true }
  }
  return { formatted: raw.trim().toLowerCase(), autoApprove: false }
}

async function getPool() {
  // Database migrations are a deployment concern. Registration must not run
  // the application-wide schema initializer: one unrelated legacy DDL failure
  // would otherwise prevent an otherwise valid learner from creating an account.
  const { default: pool } = await import("@/lib/db")
  return pool
}

export async function POST(req: NextRequest) {
  try {
    // Accept both `classLevel` (new canonical name) and `level` (legacy) so
    // existing clients don't break while new clients migrate.
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 })
    }

    const { name, classLevel, level, indexNumber, password } = body as Record<string, unknown>

    if (typeof name !== "string" || typeof indexNumber !== "string" || typeof password !== "string" || !name.trim() || !indexNumber.trim() || !password.trim()) {
      return NextResponse.json(
        { error: "Name, index number, and password are required" },
        { status: 400 },
      )
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      )
    }

    // Resolve classLevel: prefer new field, fall back to legacy field.
    const suppliedLevel = classLevel ?? level ?? ""
    if (typeof suppliedLevel !== "string") {
      return NextResponse.json({ error: "classLevel must be a string" }, { status: 400 })
    }
    const resolvedLevel = suppliedLevel.trim()

    // Validate against the master level list when a value is supplied.
    // We allow empty string for legacy clients that don't send a level.
    if (resolvedLevel && !isValidLevel(resolvedLevel)) {
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

    const { formatted, autoApprove: verifiedIndex } = formatIndexNumber(indexNumber)
    const passwordHash = await bcrypt.hash(password, 10)
    const uid = crypto.randomUUID()

    const pool = await getPool()
    const settings = await getPlatformSettings(pool).catch(() => defaultPlatformSettings())
    if (!settings.registrationEnabled) {
      return NextResponse.json({ error: "New account registration is currently closed." }, { status: 403 })
    }
    const autoApprove = settings.registrationApprovalMode === "verified_index" && verifiedIndex
    const status = autoApprove ? "approved" : "pending"

    // Duplicate-index check (outside the transaction — cheap read before we acquire a client).
    const existing = await pool.query(
      "SELECT uid FROM mednexus_registered_users WHERE index_number = $1",
      [formatted],
    )
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "An account with this index number already exists" },
        { status: 409 },
      )
    }

    // All writes run inside a single transaction so the user row, legacy users
    // row, 500 NP wallet grant, and optional notification are atomic.
    // If any step fails the entire registration is rolled back — no orphaned
    // user rows that can't re-register and no missing wallet grants.
    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      // Write both `level` (legacy column) and `class_level` (new canonical column)
      // so older queries and new queries both see correct data.
      await client.query(
        `INSERT INTO mednexus_registered_users
           (uid, name, level, class_level, role, index_number, password_hash, status)
         VALUES ($1, $2, $3, $3, 'STUDENT', $4, $5, $6)`,
        [uid, name.trim(), resolvedLevel, formatted, passwordHash, status],
      )

      await client.query(
        `INSERT INTO mednexus_users (uid, name) VALUES ($1, $2) ON CONFLICT (uid) DO NOTHING`,
        [uid, name.trim()],
      )

      // Pending accounts receive no currency. Approval provisions exactly one
      // deterministic opening grant in the currently active season.
      if (autoApprove) await provisionActiveSeasonWallet(client, uid, "registration-v2")

      if (!autoApprove) {
        const notifId = `notif-reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        await client.query(
          `INSERT INTO mednexus_notifications (id, title, body, type, admin_only)
           VALUES ($1, $2, $3, 'alert', TRUE)`,
          [
            notifId,
            "New Registration Pending",
            `${name.trim()} (${formatted}) registered and is awaiting approval.`,
          ],
        )
      }

      await client.query("COMMIT")
    } catch (txErr) {
      await client.query("ROLLBACK")
      throw txErr
    } finally {
      client.release()
    }

    return NextResponse.json({
      uid,
      name: name.trim(),
      classLevel: resolvedLevel,
      role: "STUDENT",
      // Keep legacy `level` field for backward compatibility
      level: resolvedLevel,
      status,
      indexNumber: formatted,
    })
  } catch (err: unknown) {
    // The preflight duplicate check gives a friendly response in the common
    // case. Keep the same response if a simultaneous registration wins the
    // unique-index race before this request inserts its row.
    if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
      return NextResponse.json(
        { error: "An account with this index number already exists" },
        { status: 409 },
      )
    }
    console.error("[auth/register]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
