import type { PoolClient, Pool } from "pg"

export const SEASON_OPENING_GRANT = 500
export const REGISTRATION_GRANT_RANK_POINTS = 0

type Queryable = Pick<Pool | PoolClient, "query">

export interface EconomySeason {
  id: string
  name: string
  economyVersion: string
  startsAt: string
  openingGrant: number
}

export async function getActiveSeason(db: Queryable, lock = false): Promise<EconomySeason> {
  const result = await db.query(
    `SELECT id, name, economy_version, starts_at, opening_grant
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
      SEASON_OPENING_GRANT,
      JSON.stringify({ economyVersion: season.economyVersion, seasonId: season.id, migrationId }),
    ],
  )
  if (grant.rowCount) {
    await db.query(
      `UPDATE mednexus_season_wallets
          SET balance = balance + $3, lifetime_earned = lifetime_earned + $3,
              rank_points = rank_points + $4, updated_at = NOW()
        WHERE season_id = $1 AND user_id = $2`,
      [season.id, userId, SEASON_OPENING_GRANT, REGISTRATION_GRANT_RANK_POINTS],
    )
  }
  return { granted: Boolean(grant.rowCount), season }
}
