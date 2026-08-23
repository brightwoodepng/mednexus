import type { PoolClient, Pool } from "pg"

export const SEASON_OPENING_GRANT = 500
export const REGISTRATION_GRANT_RANK_POINTS = 0

type Queryable = Pick<Pool | PoolClient, "query">

export class EconomySeasonSchemaError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(`Economy Seasons schema is incomplete: ${missing.join(", ")}`)
    this.name = "EconomySeasonSchemaError"
    this.missing = missing
  }
}

/** Read-only feature preflight. Admin requests must not run the application's
 * full migration bundle: an unrelated schema change should never make Economy
 * Seasons report a false database-connection failure. */
export async function assertEconomySeasonSchema(db: Queryable) {
  const result = await db.query<Record<string, boolean>>(`
    SELECT
      to_regclass('public.mednexus_economy_seasons') IS NOT NULL AS seasons,
      to_regclass('public.mednexus_season_wallets') IS NOT NULL AS wallets,
      to_regclass('public.mednexus_economy_season_archives') IS NOT NULL AS archives,
      to_regclass('public.mednexus_economy_cutovers') IS NOT NULL AS cutovers,
      to_regclass('public.mednexus_registered_users') IS NOT NULL AS users,
      to_regclass('public.mednexus_np_transactions') IS NOT NULL AS transactions,
      to_regclass('public.mednexus_xp_transactions') IS NOT NULL AS xp_transactions,
      to_regclass('public.mednexus_daily_activity') IS NOT NULL AS daily_activity,
      to_regclass('public.mednexus_bounty_progress') IS NOT NULL AS bounty_progress,
      to_regclass('public.mednexus_weekly_goal_progress') IS NOT NULL AS weekly_goals,
      to_regclass('public.mednexus_game_personal_bests') IS NOT NULL AS personal_bests
  `)
  const missing = Object.entries(result.rows[0] ?? {})
    .filter(([, ready]) => !ready)
    .map(([name]) => name)
  if (missing.length > 0) throw new EconomySeasonSchemaError(missing)
}

export interface EconomySeason {
  id: string
  name: string
  economyVersion: string
  startsAt: string
  openingGrant: number
  minimumEligibleQuestions: number
  monthlyRewards: number[]
  seasonalRewards: number[]
}

export async function getActiveSeason(db: Queryable, lock = false): Promise<EconomySeason> {
  const result = await db.query(
    `SELECT id, name, economy_version, starts_at, opening_grant,minimum_eligible_questions,monthly_rewards,seasonal_rewards
       FROM mednexus_economy_seasons WHERE status = 'active'
       ORDER BY starts_at DESC LIMIT 1${lock ? " FOR SHARE" : ""}`,
  )
  if (!result.rows[0]) throw new Error("No active economy season is configured")
  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    economyVersion: result.rows[0].economy_version,
    startsAt: new Date(result.rows[0].starts_at).toISOString(),
    openingGrant: Number(result.rows[0].opening_grant),
    minimumEligibleQuestions: Number(result.rows[0].minimum_eligible_questions ?? 300),
    monthlyRewards: result.rows[0].monthly_rewards ?? [],
    seasonalRewards: result.rows[0].seasonal_rewards ?? [],
  }
}

/** Idempotently provisions the single starting grant for an approved member. */
export async function provisionActiveSeasonWallet(db: PoolClient, userId: string, migrationId: string) {
  const season = await getActiveSeason(db, true)
  const approved = await db.query(
    "SELECT 1 FROM mednexus_registered_users WHERE uid = $1 AND status = 'approved'",
    [userId],
  )
  if (!approved.rowCount) return { granted: false, season }

  await db.query(
    `INSERT INTO mednexus_season_wallets
       (season_id, user_id, balance, lifetime_earned, rank_points)
     VALUES ($1, $2, 0, 0, 0) ON CONFLICT (season_id, user_id) DO NOTHING`,
    [season.id, userId],
  )
  const grant = await db.query(
    `INSERT INTO mednexus_np_transactions
       (id, user_id, season_id, source, source_id, amount, metadata)
     VALUES ($1, $2, $3, 'season_opening_grant', $4, $5, $6::jsonb)
     ON CONFLICT (user_id, source, source_id) DO NOTHING RETURNING id`,
    [
      `season-grant-${season.id}-${userId}`,
      userId,
      season.id,
      `${season.id}:${userId}`,
      season.openingGrant,
      JSON.stringify({ economyVersion: season.economyVersion, seasonId: season.id, migrationId }),
    ],
  )
  if (grant.rowCount) {
    await db.query(
      `UPDATE mednexus_season_wallets
          SET balance = balance + $3, lifetime_earned = lifetime_earned + $3,
              rank_points = rank_points + $4, updated_at = NOW()
        WHERE season_id = $1 AND user_id = $2`,
      [season.id, userId, season.openingGrant, REGISTRATION_GRANT_RANK_POINTS],
    )
  }
  return { granted: Boolean(grant.rowCount), season }
}
