// POST /api/economy/daily-login
// Called once per app open (by EconomyProvider) for registered users.
// Idempotent within the same UTC calendar day — safe to call on every mount.

import { NextRequest, NextResponse } from "next/server"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { processDailyLogin } from "@/lib/anti-farming"
import pool from "@/lib/db"
import { countEconomyQueries, economyJson, economyMetrics } from "@/lib/economy-api"

export async function POST(req: NextRequest) {
  const metrics = economyMetrics()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const uid = auth.uid

    // Guests never receive daily login NP
    if (!uid || typeof uid !== "string" || uid.startsWith("guest")) {
      return economyJson("economy.daily-login", { alreadyDone: true, earned: 0, newStreak: 0, longestStreak: 0, milestoneName: null, nextMilestone: null, breakdown: [], wallet: { balance: 0, lifetimeEarned: 0, rankPoints: 0 } }, metrics)
    }

    const result = await processDailyLogin(uid, metrics)
    const wallet = await countEconomyQueries(pool, metrics).query(`SELECT w.balance,w.lifetime_earned,w.rank_points
      FROM mednexus_season_wallets w JOIN mednexus_economy_seasons s ON s.id=w.season_id
      WHERE w.user_id=$1 AND s.status='active' ORDER BY s.starts_at DESC LIMIT 1`, [uid])
    const row = wallet.rows[0]
    return economyJson("economy.daily-login", { ...result, wallet: { balance: Number(row?.balance ?? 0), lifetimeEarned: Number(row?.lifetime_earned ?? 0), rankPoints: Number(row?.rank_points ?? 0) } }, metrics)
  } catch (err) {
    console.error("[economy/daily-login POST]", err)
    return economyJson("economy.daily-login", { error: "Server error" }, metrics, { status: 500 })
  }
}
