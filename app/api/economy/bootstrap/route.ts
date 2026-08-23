import { NextRequest } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { getTodaysBounties, TODAY_DATE, economyWeekId } from "@/lib/economy"
import { provisionActiveSeasonWallet } from "@/lib/economy-seasons"
import { weeklyGoalView, type WeeklyGoalProgress } from "@/lib/weekly-goals"
import { countEconomyQueries, economyJson, economyMetrics } from "@/lib/economy-api"

export async function GET(req: NextRequest) {
  const metrics = economyMetrics()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const client = await pool.connect()
    let season
    try {
      const db = countEconomyQueries(client, metrics)
      await db.query("BEGIN")
      ;({ season } = await provisionActiveSeasonWallet(db, auth.uid, "economy-bootstrap-v1"))
      await db.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }

    const db = countEconomyQueries(pool, metrics)
    const today = TODAY_DATE()
    const weekId = economyWeekId()
    const [walletResult, xpResult, bountyResult, weeklyResult, inventoryResult, cosmeticsResult] = await Promise.all([
      db.query("SELECT balance, lifetime_earned, rank_points FROM mednexus_season_wallets WHERE user_id=$1 AND season_id=$2", [auth.uid, season.id]),
      db.query("SELECT COALESCE(SUM(amount),0)::int lifetime_xp FROM mednexus_xp_transactions WHERE user_id=$1", [auth.uid]),
      db.query("SELECT bounty_id, progress, claimed FROM mednexus_bounty_progress WHERE season_id=$1 AND uid=$2 AND bounty_date=$3", [season.id, auth.uid, today]),
      db.query(`SELECT eligible_answered,eligible_correct,qualifying_exams,distinct_exam_dates,credited_goal_ids
        FROM mednexus_weekly_goal_progress WHERE season_id=$1 AND uid=$2 AND week_id=$3`, [season.id, auth.uid, weekId]),
      db.query("SELECT item_id, quantity FROM mednexus_user_inventory WHERE uid=$1", [auth.uid]),
      db.query("SELECT equipped_title,equipped_frame,equipped_highlight,equipped_avatar FROM mednexus_user_cosmetics WHERE uid=$1", [auth.uid]),
    ])
    const wallet = walletResult.rows[0]
    const bountyProgress = Object.fromEntries(bountyResult.rows.map(row => [row.bounty_id, row]))
    const weekly = weeklyResult.rows[0]
    const progress: WeeklyGoalProgress = {
      weekId,
      eligibleAnswered: Number(weekly?.eligible_answered ?? 0),
      eligibleCorrect: Number(weekly?.eligible_correct ?? 0),
      qualifyingExams: Number(weekly?.qualifying_exams ?? 0),
      distinctExamDates: weekly?.distinct_exam_dates ?? [],
      creditedGoalIds: weekly?.credited_goal_ids ?? [],
    }
    const cosmetics = cosmeticsResult.rows[0] ?? {}
    return economyJson("economy.bootstrap", {
      wallet: { balance: Number(wallet?.balance ?? 0), lifetimeEarned: Number(wallet?.lifetime_earned ?? 0), rankPoints: Number(wallet?.rank_points ?? 0), lifetimeXP: Number(xpResult.rows[0]?.lifetime_xp ?? 0) },
      bounties: getTodaysBounties().map(bounty => ({ ...bounty, progress: Number(bountyProgress[bounty.id]?.progress ?? 0), claimed: bountyProgress[bounty.id]?.claimed ?? false })),
      weeklyGoals: weeklyGoalView(progress),
      inventory: Object.fromEntries(inventoryResult.rows.map(row => [row.item_id, Number(row.quantity)])),
      equippedCosmetics: { title: cosmetics.equipped_title ?? null, frame: cosmetics.equipped_frame ?? null, highlight: cosmetics.equipped_highlight ?? null, avatar: cosmetics.equipped_avatar ?? null },
      season,
    }, metrics)
  } catch (error) {
    console.error("economy bootstrap", error)
    return economyJson("economy.bootstrap", { error: "Server error" }, metrics, { status: 500 })
  }
}
