import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"
import {
  calculatePayout,
  getTodaysBounties,
  computeBountyProgress,
  computeRankUpBonus,
  CLINICAL_TIERS,
  RANK_UP_BONUS_NP,
  TODAY_DATE,
  type GameResult,
} from "@/lib/economy"

export async function POST(req: NextRequest) {
  try {
    await ensureSchema()
    const body = await req.json()
    const { uid, mode, score, correct, total, bestStreak, isNewHigh, survivedCount, lifelineUsed } = body

    if (!uid || !mode) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0
    const result: GameResult = {
      mode, score, correct, total, bestStreak, isNewHigh, survivedCount, accuracy,
      lifelineUsed: !!lifelineUsed,
    }

    const { total: earned, breakdown } = calculatePayout(result)

    const todayBounties = getTodaysBounties()
    const today = TODAY_DATE()

    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      // ── Credit base NP to wallet ───────────────────────────────────────────
      const { rows: walletRows } = await client.query(
        `INSERT INTO mednexus_wallet (uid, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (uid) DO UPDATE
           SET balance = mednexus_wallet.balance + $2, updated_at = NOW()
         RETURNING balance`,
        [uid, earned]
      )
      let newBalance = walletRows[0].balance

      // ── Clinical Rank-Up: increment rank_points and award tier bonus ───────
      // rank_points grow by the same amount as NP earned. Crossing a tier
      // boundary awards a one-time +1000 NP bonus per tier gained.
      const { rows: rpRows } = await client.query(
        `INSERT INTO mednexus_wallet (uid, rank_points)
           VALUES ($1, $2)
         ON CONFLICT (uid) DO UPDATE
           SET rank_points = mednexus_wallet.rank_points + $2
         RETURNING rank_points, (rank_points - $2) AS old_rank_points`,
        [uid, earned]
      )

      const rankUpBonus = computeRankUpBonus(
        Number(rpRows[0].old_rank_points),
        Number(rpRows[0].rank_points)
      )
      const rankUpBreakdown: { label: string; amount: number }[] = []

      if (rankUpBonus.tiersGained > 0) {
        await client.query(
          `UPDATE mednexus_wallet SET balance = balance + $1 WHERE uid = $2`,
          [rankUpBonus.bonusNP, uid]
        )
        newBalance += rankUpBonus.bonusNP

        // Record each tier gained individually for the UI breakdown
        for (const tierName of rankUpBonus.newTierNames) {
          rankUpBreakdown.push({ label: `🎓 Rank-Up: ${tierName}!`, amount: RANK_UP_BONUS_NP })
        }
      }

      // ── Bounty progress ────────────────────────────────────────────────────
      const bountyUpdates: { id: string; progress: number; target: number; claimed: boolean; newlyComplete: boolean }[] = []

      for (const bounty of todayBounties) {
        const delta = computeBountyProgress(bounty, result)
        if (delta <= 0) continue

        const { rows: existing } = await client.query(
          `SELECT progress, claimed FROM mednexus_bounty_progress
           WHERE uid = $1 AND bounty_id = $2 AND bounty_date = $3`,
          [uid, bounty.id, today]
        )
        const current = existing[0]
        if (current?.claimed) continue

        const oldProgress = current?.progress ?? 0
        const newProgress = Math.min(oldProgress + delta, bounty.target)

        await client.query(
          `INSERT INTO mednexus_bounty_progress (uid, bounty_id, bounty_date, progress, claimed)
           VALUES ($1, $2, $3, $4, FALSE)
           ON CONFLICT (uid, bounty_id, bounty_date) DO UPDATE
             SET progress = LEAST(mednexus_bounty_progress.progress + $4, $5)`,
          [uid, bounty.id, today, delta, bounty.target]
        )

        bountyUpdates.push({
          id: bounty.id, progress: newProgress, target: bounty.target, claimed: false,
          newlyComplete: oldProgress < bounty.target && newProgress >= bounty.target,
        })
      }

      await client.query("COMMIT")

      return NextResponse.json({
        earned,
        newBalance,
        breakdown: [...breakdown, ...rankUpBreakdown],
        bountyUpdates,
      })
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  } catch (e) {
    console.error("payout POST", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}


