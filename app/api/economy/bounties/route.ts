import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { getTodaysBounties, TODAY_DATE } from "@/lib/economy"
import { applyNPCredits } from "@/lib/np-ledger"
import { getActiveSeason } from "@/lib/economy-seasons"
import { countEconomyQueries, economyJson, economyMetrics } from "@/lib/economy-api"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const uid = auth.uid
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 })

    const bounties = getTodaysBounties()
    const today = TODAY_DATE()
    const season = await getActiveSeason(pool)

    const { rows } = await pool.query(
      `SELECT bounty_id, progress, claimed
       FROM mednexus_bounty_progress
       WHERE season_id = $1 AND uid = $2 AND bounty_date = $3`,
      [season.id, uid, today]
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
  const metrics = economyMetrics()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { bountyId } = await req.json()
    const uid = auth.uid
    if (!bountyId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const bounties = getTodaysBounties()
    const today = TODAY_DATE()
    const bounty = bounties.find(b => b.id === bountyId)
    if (!bounty) return NextResponse.json({ error: "Bounty not active today" }, { status: 400 })

    const connectedClient = await pool.connect()
    const client = countEconomyQueries(connectedClient, metrics)
    try {
      await client.query("BEGIN")
      const season = await getActiveSeason(client, true)

      const { rows } = await client.query(
        `SELECT progress, claimed FROM mednexus_bounty_progress
         WHERE season_id = $1 AND uid = $2 AND bounty_id = $3 AND bounty_date = $4 FOR UPDATE`,
        [season.id, uid, bountyId, today]
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
         WHERE season_id = $1 AND uid = $2 AND bounty_id = $3 AND bounty_date = $4`,
        [season.id, uid, bountyId, today]
      )
      const credit = await applyNPCredits(client, uid, [{
        source: "bounty",
        sourceId: `${today}:${bounty.id}`,
        amount: bounty.reward,
        metadata: { bountyId: bounty.id },
      }])
      await client.query("COMMIT")
      const progressRows = await countEconomyQueries(pool, metrics).query(
        `SELECT bounty_id,progress,claimed FROM mednexus_bounty_progress
         WHERE season_id=$1 AND uid=$2 AND bounty_date=$3`, [season.id, uid, today])
      const progressMap = Object.fromEntries(progressRows.rows.map(item => [item.bounty_id, item]))
      return economyJson("economy.bounty-claim", {
        ok: true,
        newBalance: credit.newBalance,
        earned: credit.credited,
        breakdown: [
          ...(credit.credited - credit.rankBonus > 0 ? [{ label: "Bounty", amount: credit.credited - credit.rankBonus }] : []),
          ...(credit.suppressed > 0 ? [{ label: "Daily repeatable NP ceiling", amount: -credit.suppressed }] : []),
          ...credit.rankBreakdown,
        ],
        suppressed: credit.suppressed,
        dailyCeiling: credit.dailyCeiling,
        wallet: { balance: credit.newBalance, lifetimeEarned: credit.lifetimeEarned, rankPoints: credit.rankPoints },
        bounties: bounties.map(item => ({ ...item, progress: Number(progressMap[item.id]?.progress ?? 0), claimed: progressMap[item.id]?.claimed ?? false })),
      }, metrics)
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      connectedClient.release()
    }
  } catch (e) {
    console.error("bounties POST", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
