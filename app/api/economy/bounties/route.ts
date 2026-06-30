import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"
import { getTodaysBounties, TODAY_DATE, STORE_ITEMS } from "@/lib/economy"

export async function GET(req: NextRequest) {
  try {
    await ensureSchema()
    const uid = req.nextUrl.searchParams.get("uid")
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 })

    const bounties = getTodaysBounties()
    const today = TODAY_DATE()

    const { rows } = await pool.query(
      `SELECT bounty_id, progress, claimed
       FROM mednexus_bounty_progress
       WHERE uid = $1 AND bounty_date = $2`,
      [uid, today]
    )
    const progressMap = Object.fromEntries(rows.map(r => [r.bounty_id, { progress: r.progress, claimed: r.claimed }]))

    const result = bounties.map(b => ({
      ...b,
      progress: progressMap[b.id]?.progress ?? 0,
      claimed: progressMap[b.id]?.claimed ?? false,
    }))

    return NextResponse.json({ bounties: result, date: today })
  } catch (e) {
    console.error("bounties GET", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema()
    const { uid, bountyId } = await req.json()
    if (!uid || !bountyId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const bounties = getTodaysBounties()
    const today = TODAY_DATE()
    const bounty = bounties.find(b => b.id === bountyId)
    if (!bounty) return NextResponse.json({ error: "Bounty not active today" }, { status: 400 })

    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      const { rows } = await client.query(
        `SELECT progress, claimed FROM mednexus_bounty_progress
         WHERE uid = $1 AND bounty_id = $2 AND bounty_date = $3 FOR UPDATE`,
        [uid, bountyId, today]
      )
      const row = rows[0]
      if (!row || row.claimed) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Already claimed or no progress" }, { status: 400 })
      }
      if (row.progress < bounty.target) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Bounty not yet complete" }, { status: 400 })
      }

      await client.query(
        `UPDATE mednexus_bounty_progress SET claimed = TRUE
         WHERE uid = $1 AND bounty_id = $2 AND bounty_date = $3`,
        [uid, bountyId, today]
      )
      const { rows: walletRows } = await client.query(
        `INSERT INTO mednexus_wallet (uid, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (uid) DO UPDATE
           SET balance = mednexus_wallet.balance + $2, updated_at = NOW()
         RETURNING balance`,
        [uid, bounty.reward]
      )
      await client.query("COMMIT")
      return NextResponse.json({ ok: true, newBalance: walletRows[0].balance, earned: bounty.reward })
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  } catch (e) {
    console.error("bounties POST", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
