import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { authenticateRequest, authError, identityMismatch } from "@/lib/request-auth"
import { verifyAdminToken } from "@/lib/admin-auth"

// Admin-only: forcefully overwrite a wallet balance. Database provisioning is performed by db:migrate.
export async function PATCH(req: NextRequest) {
  try {
    if (!verifyAdminToken(req.headers.get("x-admin-token") ?? "")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
    const auth = authenticateRequest(req.headers)
    if (!auth) return authError()
    const requestedUid = req.nextUrl.searchParams.get("uid")
    if (requestedUid && identityMismatch(requestedUid, auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
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
