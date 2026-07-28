import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { forbidden, requireAdminPermission, requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { getActiveSeason, provisionActiveSeasonWallet } from "@/lib/economy-seasons"

// Admin-only, additive and fully audited. Direct balance overwrites are forbidden.
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireRegisteredUser(req)
    if (!actor) return unauthorized()
    if (!await requireAdminPermission(req, "manage_system")) return forbidden()
    const { uid, amount, reason } = await req.json()
    if (typeof uid !== "string" || !uid || !Number.isSafeInteger(amount) || amount === 0
      || Math.abs(amount) > 1_000_000_000 || typeof reason !== "string" || reason.trim().length < 8) {
      return NextResponse.json({ error: "uid, a non-zero integer amount, and a reason of at least 8 characters are required" }, { status: 400 })
    }
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const season = await getActiveSeason(client, true)
      const wallet = await client.query(
        "SELECT balance FROM mednexus_season_wallets WHERE season_id=$1 AND user_id=$2 FOR UPDATE", [season.id, uid])
      if (!wallet.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Active-season wallet not found" }, { status: 404 }) }
      const before = Number(wallet.rows[0].balance)
      const after = before + amount
      if (after < 0) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Adjustment would make balance negative" }, { status: 409 }) }
      const id = crypto.randomUUID()
      await client.query(`UPDATE mednexus_season_wallets SET balance=$3,
        lifetime_earned=lifetime_earned + GREATEST($4, 0), updated_at=NOW() WHERE season_id=$1 AND user_id=$2`,
        [season.id, uid, after, amount])
      await client.query(`INSERT INTO mednexus_np_transactions
        (id,user_id,season_id,source,source_id,amount,metadata) VALUES ($1,$2,$3,'admin_adjustment',$1,$4,$5::jsonb)`,
        [`adjustment-${id}`, uid, season.id, amount, JSON.stringify({ reason: reason.trim(), actingAdministrator: actor.uid, beforeBalance: before, afterBalance: after, seasonId: season.id, economyVersion: season.economyVersion })])
      await client.query(`INSERT INTO mednexus_wallet_adjustments
        (id,season_id,target_user_id,acting_administrator,reason,amount,before_balance,after_balance) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, season.id, uid, actor.uid, reason.trim(), amount, before, after])
      await client.query("COMMIT")
      return NextResponse.json({ ok: true, seasonId: season.id, beforeBalance: before, balance: after, adjustmentId: id })
    } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  } catch (error) { console.error("wallet PATCH", error); return NextResponse.json({ error: "Server error" }, { status: 500 }) }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const uid = auth.uid
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 })
    const client = await pool.connect()
    let season
    let rows
    try {
      await client.query("BEGIN")
      ;({ season } = await provisionActiveSeasonWallet(client, uid, "wallet-read-fallback-v1"))
      ;({ rows } = await client.query(
        "SELECT balance, lifetime_earned, rank_points FROM mednexus_season_wallets WHERE user_id = $1 AND season_id = $2",
        [uid, season.id],
      ))
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
    return NextResponse.json({
      balance: Number(rows[0]?.balance ?? 0),
      lifetimeEarned: Number(rows[0]?.lifetime_earned ?? 0),
      rankPoints: Number(rows[0]?.rank_points ?? 0),
      season,
    })
  } catch (e) {
    console.error("wallet GET", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
