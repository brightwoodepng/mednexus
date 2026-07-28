/** Read-only production readiness report. This script never provisions or mutates accounts. */
import pool from "../lib/db"

const tables = [
  "mednexus_economy_seasons", "mednexus_season_wallets", "mednexus_economy_season_archives",
  "mednexus_economy_cutovers", "mednexus_wallet_adjustments",
]
const onboardingTables = ["mednexus_user_onboarding", "mednexus_onboarding_events"]
const seasonalTables = [
  "mednexus_np_transactions", "mednexus_daily_activity", "mednexus_bounty_progress",
  "mednexus_weekly_goal_progress", "mednexus_game_personal_bests", "mednexus_multiplayer_payouts",
  "mednexus_exam_sessions", "mednexus_user_question_progress", "mednexus_discipline_np_log",
]

async function main() {
  const objects = await pool.query(`
    SELECT requested.name, to_regclass('public.' || requested.name) IS NOT NULL AS exists
    FROM unnest($1::text[]) requested(name) ORDER BY requested.name`, [[...tables, ...onboardingTables]])
  const columns = await pool.query(`
    SELECT requested.name AS table_name, EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=requested.name AND column_name='season_id'
    ) AS season_id_exists FROM unnest($1::text[]) requested(name) ORDER BY requested.name`, [seasonalTables])
  const missingObjects = objects.rows.filter(row => !row.exists)
  const missingColumns = columns.rows.filter(row => !row.season_id_exists)
  const base = { tables: objects.rows, seasonIdColumns: columns.rows }
  if (missingObjects.length || missingColumns.length) {
    console.log(JSON.stringify({ ...base, schemaReady: false, missingObjects, missingColumns }, null, 2))
    process.exitCode = 2
    return
  }
  const readiness = await pool.query(`
    WITH active AS (SELECT id FROM mednexus_economy_seasons WHERE status='active'), approved AS (
      SELECT uid FROM mednexus_registered_users WHERE status='approved'
    ) SELECT
      (SELECT COUNT(*)::int FROM active) active_season_count,
      (SELECT MIN(id) FROM active) active_season_id,
      (SELECT COUNT(*)::int FROM approved) approved_users,
      (SELECT COUNT(*)::int FROM approved a CROSS JOIN active s LEFT JOIN mednexus_season_wallets w ON w.user_id=a.uid AND w.season_id=s.id WHERE w.user_id IS NULL) accounts_without_wallets,
      (SELECT COUNT(*)::int FROM mednexus_season_wallets w JOIN active s ON s.id=w.season_id WHERE w.balance<0 OR w.lifetime_earned<0 OR w.rank_points<0) invalid_wallets,
      (SELECT COUNT(*)::int FROM (SELECT a.uid FROM approved a CROSS JOIN active s LEFT JOIN mednexus_np_transactions t ON t.user_id=a.uid AND t.season_id=s.id AND t.source='season_opening_grant' GROUP BY a.uid HAVING COUNT(t.id)<>1) invalid_grants) users_with_invalid_grant_count,
      (SELECT COALESCE(SUM(balance),0)::bigint FROM mednexus_season_wallets w JOIN active s ON s.id=w.season_id) wallet_supply,
      (SELECT COUNT(*)::int FROM (SELECT user_id,source,source_id FROM mednexus_np_transactions GROUP BY 1,2,3 HAVING COUNT(*)>1) d) duplicate_ledger_records,
      (SELECT COUNT(*)::int FROM mednexus_np_transactions WHERE amount=0 AND source<>'season_opening_grant') inconsistent_ledger_records,
      EXISTS(SELECT 1 FROM mednexus_economy_cutovers WHERE migration_id='economy-season-1-cutover-v1') cutover_record_exists,
      (SELECT version FROM mednexus_schema_migrations ORDER BY applied_at DESC LIMIT 1) migration_version`)
  const nulls = await Promise.all(seasonalTables.map(async tableName => ({ table_name: tableName,
    null_count: Number((await pool.query(`SELECT count(*)::int AS count FROM ${tableName} WHERE season_id IS NULL`)).rows[0].count) })))
  const keys = await pool.query(`SELECT conrelid::regclass::text AS table_name, conname, contype,
    pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid::regclass::text = ANY($1::text[]) AND contype IN ('p','f') ORDER BY 1,2`, [seasonalTables])
  const constraints = await pool.query(`SELECT conrelid::regclass::text AS table_name, conname,
    pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE conrelid::regclass::text = ANY($1::text[]) AND contype='c' ORDER BY 1,2`, [onboardingTables])
  const privileges = await pool.query(`SELECT current_user AS account,
    has_schema_privilege(current_user,'public','CREATE') AS create_privilege,
    (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR bool_and(pg_get_userbyid(c.relowner)=current_user) AS alter_privilege,
    has_schema_privilege(current_user,'public','CREATE') AS create_index_privilege
    FROM unnest($1::text[]) t JOIN pg_class c ON c.oid=to_regclass(t)`, [tables])
  console.log(JSON.stringify({ ...base, schemaReady: true, seasonIdNulls: nulls, keys: keys.rows,
    onboardingConstraints: constraints.rows, privileges: privileges.rows[0], ...readiness.rows[0] }, null, 2))
}

main().catch(error => {
  console.error("Economy readiness audit failed", { code: error?.code ?? "UNKNOWN", table: error?.table, column: error?.column, constraint: error?.constraint, error })
  process.exitCode = 1
}).finally(() => pool.end())
