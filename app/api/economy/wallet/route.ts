import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"

// Dev-only: directly set a wallet balance (used by the cheat button)
export async function PATCH(req: NextRequest) {
  try {
    await ensureSchema()
    const { uid, balance } = await req.json()
    if (!uid || typeof balance !== "number") {
      return NextResponse.json({ error: "uid and balance required" }, { status: 400 })
    }
    await pool.query(
      `INSERT INTO mednexus_wallet (uid, balance)
       VALUES ($1, $2)
       ON CONFLICT (uid) DO UPDATE SET balance = $2`,
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
    await ensureSchema()
    const uid = req.nextUrl.searchParams.get("uid")
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
