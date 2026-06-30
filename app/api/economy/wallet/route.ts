import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"

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
