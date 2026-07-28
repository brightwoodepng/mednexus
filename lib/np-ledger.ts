import type { PoolClient } from "pg"
import { computeRankUpBonus, RANK_UP_BONUS_NP, TODAY_DATE } from "@/lib/economy"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { getActiveSeason } from "@/lib/economy-seasons"

export interface NPCredit {
  source: string
  sourceId: string
  amount: number
  metadata?: Record<string, unknown>
  /** Rank-up rewards increase lifetime earnings, but must not recursively earn another rank. */
  countsTowardClinicalRank?: boolean
  /** Repeatable MCQ rewards share the global daily ceiling. Exceptional grants must opt out. */
  ceilingPolicy?: "repeatable_mcq" | "exempt"
}

export interface NPCreditResult {
  credited: number
  newBalance: number
  lifetimeEarned: number
  rankPoints: number
  rankBonus: number
  rankBreakdown: { label: string; amount: number }[]
  suppressed: number
  dailyCeiling: number
  dailyRepeatableCredited: number
}

const REPEATABLE_MCQ_SOURCES = new Set([
  "trial_tutor_question", "trial_tutor_streak", "trial_tutor_completion",
  "exam_reward", "question_reward", "game_completion", "game_achievement",
  "multiplayer_reward", "first_multiplayer_win", "bounty", "weekly_goal",
])

function isRepeatable(credit: NPCredit) {
  return credit.ceilingPolicy === "repeatable_mcq"
    || (credit.ceilingPolicy !== "exempt" && REPEATABLE_MCQ_SOURCES.has(credit.source))
}

/**
 * Applies one or more positive NP credits exactly once.
 *
 * The caller owns the transaction. A unique source/sourceId pair is the
 * idempotency boundary, so retries can safely call this helper again.
 */
export async function applyNPCredits(
  client: PoolClient,
  userId: string,
  credits: NPCredit[],
): Promise<NPCreditResult> {
  const inserted: NPCredit[] = []
  const season = await getActiveSeason(client, true)
  const economyDate = TODAY_DATE()
  // Serialize all credits for this user/date, including calls made more than once
  // in a payout transaction. Rank bonuses are deliberately exempt: they are rare,
  // one-time progression awards rather than repeatable MCQ earnings.
  const hasRepeatableCredit = credits.some(isRepeatable)
  let dailyRepeatableCredited = 0
  if (hasRepeatableCredit) {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mednexus:repeatable-np:${userId}:${economyDate}`])
    const daily = await client.query(
      `SELECT COALESCE(SUM(amount), 0)::int AS total
         FROM mednexus_np_transactions
        WHERE user_id = $1 AND season_id = $3 AND metadata->>'ceilingPolicy' = 'repeatable_mcq'
          AND created_at >= $2::date AND created_at < $2::date + INTERVAL '1 day'`,
      [userId, economyDate, season.id],
    )
    dailyRepeatableCredited = Number(daily.rows[0]?.total ?? 0)
  }
  let suppressed = 0

  for (const credit of credits) {
    const requestedAmount = Math.max(0, Math.floor(credit.amount))
    if (!requestedAmount) continue
    const repeatable = isRepeatable(credit)
    const remaining = Math.max(0, ECONOMY_CONFIG.repeatableDailyCeiling - dailyRepeatableCredited)
    const amount = repeatable ? Math.min(requestedAmount, remaining) : requestedAmount
    const suppressedAmount = requestedAmount - amount
    const result = await client.query(
      `INSERT INTO mednexus_np_transactions
         (id, user_id, season_id, source, source_id, amount, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (user_id, source, source_id) DO NOTHING
       RETURNING id`,
      [
        `np-${crypto.randomUUID()}`,
        userId,
        season.id,
        credit.source,
        credit.sourceId,
        amount,
        JSON.stringify({
          ...credit.metadata,
          economyVersion: season.economyVersion,
          seasonId: season.id,
          economyDate,
          ceilingPolicy: repeatable ? "repeatable_mcq" : "exempt",
          requestedAmount,
          suppressedAmount,
          dailyCeiling: repeatable ? ECONOMY_CONFIG.repeatableDailyCeiling : undefined,
        }),
      ],
    )
    if (result.rowCount) {
      inserted.push({ ...credit, amount })
      if (repeatable) dailyRepeatableCredited += amount
      suppressed += suppressedAmount
    }
  }

  const balanceCredit = inserted.reduce((sum, credit) => sum + credit.amount, 0)
  const rankCredit = inserted
    .filter((credit) => credit.countsTowardClinicalRank !== false)
    .reduce((sum, credit) => sum + credit.amount, 0)

  const walletResult = await client.query(
    `INSERT INTO mednexus_season_wallets
       (user_id, season_id, balance, rank_points, lifetime_earned, updated_at)
     VALUES ($1, $4, $2, $3, $2, NOW())
     ON CONFLICT (season_id, user_id) DO UPDATE
       SET balance = mednexus_season_wallets.balance + $2,
           rank_points = mednexus_season_wallets.rank_points + $3,
           lifetime_earned = mednexus_season_wallets.lifetime_earned + $2,
           updated_at = NOW()
     RETURNING balance, rank_points, lifetime_earned,
       rank_points - $3 AS old_rank_points`,
    [userId, balanceCredit, rankCredit, season.id],
  )

  let newBalance = Number(walletResult.rows[0]?.balance ?? 0)
  let lifetimeEarned = Number(walletResult.rows[0]?.lifetime_earned ?? 0)
  const rankPoints = Number(walletResult.rows[0]?.rank_points ?? 0)
  const oldRankPoints = Number(walletResult.rows[0]?.old_rank_points ?? rankPoints)
  const rank = computeRankUpBonus(oldRankPoints, rankPoints)
  let rankBonus = 0
  const rankBreakdown: { label: string; amount: number }[] = []

  for (const tierName of rank.newTierNames) {
    const sourceId = `${oldRankPoints}-${rankPoints}-${tierName}`
    const bonus = await client.query(
      `INSERT INTO mednexus_np_transactions
         (id, user_id, season_id, source, source_id, amount, metadata)
       VALUES ($1, $2, $6, 'rank_bonus', $3, $4, $5::jsonb)
       ON CONFLICT (user_id, source, source_id) DO NOTHING
       RETURNING amount`,
      [
        `np-${crypto.randomUUID()}`,
        userId,
        sourceId,
        RANK_UP_BONUS_NP,
        JSON.stringify({
          tierName,
          rewardCategory: "rank_bonus",
          economyVersion: ECONOMY_CONFIG.economyVersion,
          economyDate,
          ceilingPolicy: "exempt",
          requestedAmount: RANK_UP_BONUS_NP,
          suppressedAmount: 0,
          seasonId: season.id,
        }),
        season.id,
      ],
    )
    if (!bonus.rowCount) continue
    rankBonus += RANK_UP_BONUS_NP
    rankBreakdown.push({ label: `Rank-Up: ${tierName}!`, amount: RANK_UP_BONUS_NP })
  }

  if (rankBonus) {
    const bonusWallet = await client.query(
      `UPDATE mednexus_season_wallets
       SET balance = balance + $1,
           lifetime_earned = lifetime_earned + $1,
           updated_at = NOW()
       WHERE user_id = $2 AND season_id = $3
       RETURNING balance, lifetime_earned`,
      [rankBonus, userId, season.id],
    )
    newBalance = Number(bonusWallet.rows[0]?.balance ?? newBalance)
    lifetimeEarned = Number(bonusWallet.rows[0]?.lifetime_earned ?? lifetimeEarned)
  }

  return {
    credited: balanceCredit + rankBonus,
    newBalance,
    lifetimeEarned,
    rankPoints,
    rankBonus,
    rankBreakdown,
    suppressed,
    dailyCeiling: ECONOMY_CONFIG.repeatableDailyCeiling,
    dailyRepeatableCredited,
  }
}

export async function recordDailyActivity(
  client: PoolClient,
  userId: string,
  questionsAnswered: number,
  correctAnswers: number,
) {
  if (questionsAnswered <= 0) return
  const season = await getActiveSeason(client)
  await client.query(
    `INSERT INTO mednexus_daily_activity
       (user_id, season_id, activity_date, questions_answered, correct_answers)
     VALUES ($1, $5, $2, $3, $4)
     ON CONFLICT (season_id, user_id, activity_date) DO UPDATE
       SET questions_answered = mednexus_daily_activity.questions_answered + EXCLUDED.questions_answered,
           correct_answers = mednexus_daily_activity.correct_answers + EXCLUDED.correct_answers`,
    [
      userId,
      TODAY_DATE(),
      Math.max(0, Math.floor(questionsAnswered)),
      Math.max(0, Math.floor(correctAnswers)),
      season.id,
    ],
  )
}

export async function completionBonusAvailable(client: PoolClient, userId: string) {
  // Serialize the first-completion check inside the caller's transaction.
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext($1))",
    [`mednexus:game-completion:${userId}`],
  )
  const result = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM mednexus_np_transactions
     WHERE user_id = $1
       AND source = 'game_completion'
       AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
    [userId],
  )
  return Number(result.rows[0]?.count ?? 0) === 0
}

export async function dailyRewardRemaining(
  client: PoolClient,
  userId: string,
  family: "solo" | "multiplayer",
) {
  const sources = family === "solo"
    ? ["question_reward", "game_completion", "game_achievement"]
    : ["game_completion", "multiplayer_reward", "first_multiplayer_win"]
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mednexus:${family}-cap:${userId}:${TODAY_DATE()}`])
  const result = await client.query(
    `SELECT COALESCE(SUM(amount), 0)::int AS total FROM mednexus_np_transactions
     WHERE user_id = $1 AND source = ANY($2::text[])
       AND CASE WHEN source = 'game_completion'
         THEN COALESCE((metadata->>'multiplayer')::boolean, FALSE) = $4
         ELSE TRUE END
       AND created_at >= $3::date AND created_at < $3::date + INTERVAL '1 day'`,
    [userId, sources, TODAY_DATE(), family === "multiplayer"],
  )
  const cap = family === "solo" ? ECONOMY_CONFIG.gameRewards.solo.dailyCap : ECONOMY_CONFIG.gameRewards.multiplayer.dailyCap
  return Math.max(0, cap - Number(result.rows[0]?.total ?? 0))
}
