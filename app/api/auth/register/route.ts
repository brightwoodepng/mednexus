import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"

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
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  return pool
}

export async function POST(req: NextRequest) {
  try {
    const { name, level, indexNumber, password } = await req.json()

    if (!name?.trim() || !indexNumber?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "Name, index number, and password are required" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    const { formatted, autoApprove } = formatIndexNumber(indexNumber)
    const status = autoApprove ? "approved" : "pending"
    const passwordHash = await bcrypt.hash(password, 10)
    const uid = crypto.randomUUID()

    const pool = await getPool()

    const existing = await pool.query(
      "SELECT uid FROM mednexus_registered_users WHERE index_number = $1",
      [formatted]
    )
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: "An account with this index number already exists" }, { status: 409 })
    }

    await pool.query(
      `INSERT INTO mednexus_registered_users (uid, name, level, index_number, password_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uid, name.trim(), level?.trim() ?? "", formatted, passwordHash, status]
    )

    await pool.query(
      `INSERT INTO mednexus_users (uid, name) VALUES ($1, $2) ON CONFLICT (uid) DO NOTHING`,
      [uid, name.trim()]
    )

    if (!autoApprove) {
      const notifId = `notif-reg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      await pool.query(
        `INSERT INTO mednexus_notifications (id, title, body, type, admin_only)
         VALUES ($1, $2, $3, 'alert', TRUE)`,
        [
          notifId,
          "New Registration Pending",
          `${name.trim()} (${formatted}) registered and is awaiting approval.`,
        ]
      )
    }

    return NextResponse.json({ uid, name: name.trim(), status, indexNumber: formatted })
  } catch (err) {
    console.error("[auth/register]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
