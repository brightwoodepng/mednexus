import pool, { ensureSchema } from "../lib/db"
import { provisionActiveSeasonWallet, SEASON_OPENING_GRANT } from "../lib/economy-seasons"

const MIGRATION_ID = "economy-season-1-cutover-v1"
const CONFIRMATION = "ACTIVATE MEDNEXUS SEASON 1"
const args = new Set(process.argv.slice(2))
const dryRun = args.has("--dry-run")

async function main() {
  await ensureSchema()
  if (!process.env.ECONOMY_BACKUP_REFERENCE) throw new Error("ECONOMY_BACKUP_REFERENCE is required (retain a restorable database backup)")
  if (!dryRun && process.env.ECONOMY_CUTOVER_CONFIRM !== CONFIRMATION) {
    throw new Error(`Set ECONOMY_CUTOVER_CONFIRM="${CONFIRMATION}" to commit; use --dry-run to inspect safely`)
  }
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:economy-cutover'))")
    const repeated = await client.query("SELECT * FROM mednexus_economy_cutovers WHERE migration_id=$1", [MIGRATION_ID])
    if (repeated.rowCount) {
      console.log(JSON.stringify({ dryRun, repeatRun: true, migration: repeated.rows[0] }, null, 2))
      await client.query("ROLLBACK")
      return
    }
    const report = await client.query(`SELECT
      (SELECT COUNT(*)::int FROM mednexus_registered_users WHERE status='approved') approved_users,
      (SELECT COALESCE(SUM(balance),0)::bigint FROM mednexus_wallet) existing_wallet_supply,
      (SELECT COALESCE(SUM(quantity),0)::bigint FROM mednexus_user_inventory) inventory_holdings,
      (SELECT COUNT(*)::int FROM mednexus_registered_users r LEFT JOIN mednexus_wallet w ON w.uid=r.uid WHERE r.status='approved' AND w.uid IS NULL) accounts_without_wallets,
      (SELECT COUNT(*)::int FROM (SELECT user_id,source,source_id FROM mednexus_np_transactions GROUP BY 1,2,3 HAVING COUNT(*)>1) d) duplicate_ledger_records,
      (SELECT COUNT(*)::int FROM mednexus_np_transactions WHERE amount=0 AND source <> 'season_opening_grant') inconsistent_ledger_records`)
    const before = report.rows[0]
    const expected = Number(before.approved_users) * SEASON_OPENING_GRANT
    console.log(JSON.stringify({ migrationId: MIGRATION_ID, dryRun, backup: process.env.ECONOMY_BACKUP_REFERENCE, ...before, expected_new_wallet_supply: expected }, null, 2))
    if (dryRun) { await client.query("ROLLBACK"); console.log("Dry run rolled back."); return }

    await client.query("UPDATE mednexus_system_settings SET maintenance_enabled=TRUE, maintenance_message=$1", ["Economy season activation is in progress."])
    await client.query("UPDATE mednexus_economy_seasons SET status='closed', ends_at=NOW() WHERE id='legacy'")
    await client.query(`INSERT INTO mednexus_economy_season_archives
      (season_id,user_id,closing_balance,lifetime_np,rank_points,login_streak,longest_streak,mcq_activity,
       game_personal_bests,bounty_progress,weekly_goal_progress,inventory_value,closing_leaderboard_position,migration_id)
      SELECT 'legacy',r.uid,COALESCE(w.balance,0),COALESCE(w.lifetime_earned,0),COALESCE(w.rank_points,0),
       r.login_streak,r.longest_streak,COALESCE(p.data,'{}'),
       COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM mednexus_game_personal_bests g WHERE g.user_id=r.uid),'[]'),
       COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM mednexus_bounty_progress b WHERE b.uid=r.uid),'[]'),
       COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM mednexus_weekly_goal_progress q WHERE q.uid=r.uid),'[]'),
       COALESCE((SELECT SUM(i.quantity) FROM mednexus_user_inventory i WHERE i.uid=r.uid),0),
       ROW_NUMBER() OVER (ORDER BY COALESCE(w.lifetime_earned,0) DESC,r.uid),$1
      FROM mednexus_registered_users r LEFT JOIN mednexus_wallet w ON w.uid=r.uid LEFT JOIN mednexus_progress p ON p.uid=r.uid
      WHERE r.status='approved' ON CONFLICT (season_id,user_id) DO NOTHING`, [MIGRATION_ID])
    await client.query("UPDATE mednexus_registered_users SET login_streak=0,longest_streak=0,last_login_date=NULL WHERE status='approved'")
    const users = await client.query("SELECT uid FROM mednexus_registered_users WHERE status='approved' ORDER BY uid")
    for (const user of users.rows) await provisionActiveSeasonWallet(client, user.uid, MIGRATION_ID)
    await client.query(`INSERT INTO mednexus_user_notifications(id,user_id,type,message)
      SELECT 'season-1-started-'||uid,uid,'economy',$1 FROM mednexus_registered_users WHERE status='approved' ON CONFLICT DO NOTHING`,
      ["Season 1 has started. You received 500 NP. Your purchased supplies and cosmetics remain available."])
    const total = await client.query("SELECT COALESCE(SUM(balance),0)::bigint total FROM mednexus_season_wallets WHERE season_id='season-1'")
    if (Number(total.rows[0].total) !== expected) throw new Error(`Aggregate verification failed: expected ${expected}, got ${total.rows[0].total}`)
    await client.query(`INSERT INTO mednexus_economy_cutovers(migration_id,from_season_id,to_season_id,affected_users,before_total,after_total,executed_by)
      VALUES($1,'legacy','season-1',$2,$3,$4,$5)`, [MIGRATION_ID, users.rowCount, before.existing_wallet_supply, total.rows[0].total, process.env.ECONOMY_CUTOVER_ACTOR ?? "deployment"])
    await client.query("UPDATE mednexus_system_settings SET maintenance_enabled=FALSE")
    await client.query("COMMIT")
    console.log(JSON.stringify({ committed: true, affectedUsers: users.rowCount, beforeTotal: before.existing_wallet_supply, afterTotal: total.rows[0].total }, null, 2))
  } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release(); await pool.end() }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
