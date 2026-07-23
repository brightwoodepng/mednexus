import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { forbidden, requireAdminPermission, requireRegisteredUser, unauthorized } from "@/lib/request-auth"

// Admin-only: forcefully overwrite a wallet balance. Database provisioning is performed by db:migrate.
export async function PATCH(req: NextRequest) {
  try {
    if (!await requireAdminPermission(req, "manage_system")) {
      return await requireRegisteredUser(req) ? forbidden() : unauthorized()
    }
    const { uid, balance } = await req.json()
    if (!uid || typeof balance !== "number") {
      return NextResponse.json({ error: "uid and balance required" }, { status: 400 })
    }
    await pool.query(
      `INSERT INTO mednexus_wallet (uid, balance, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (uid) DO UPDATE
         SET balance    = EXCLUDED.balance,
             updated_at = NOW()`,
      [uid, balance]
    )
    return NextResponse.json({ ok: true, balance })
  } catch (e) {
    console.error("wallet PATCH", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const uid = auth.uid
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 })
    const { rows } = await pool.query(
      "SELECT balance FROM mednexus_wallet WHERE uid = $1",
      [uid]
    )
    return NextResponse.json({ balance: rows[0]?.balance ?? 0 })
  } catch (e) {
    console.error("wallet GET", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
