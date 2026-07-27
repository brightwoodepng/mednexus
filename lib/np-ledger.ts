import type { PoolClient } from "pg"
import { computeRankUpBonus, RANK_UP_BONUS_NP, TODAY_DATE } from "@/lib/economy"

export interface NPCredit {
  source: string
  sourceId: string
  amount: number
  metadata?: Record<string, unknown>
  /** Rank-up rewards increase lifetime earnings, but must not recursively earn another rank. */
  countsTowardClinicalRank?: boolean
}

export interface NPCreditResult {
  credited: number
  newBalance: number
  lifetimeEarned: number
  rankPoints: number
  rankBonus: number
  rankBreakdown: { label: string; amount: number }[]
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

  for (const credit of credits) {
    const amount = Math.max(0, Math.floor(credit.amount))
    if (!amount) continue
    const result = await client.query(
      `INSERT INTO mednexus_np_transactions
         (id, user_id, source, source_id, amount, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (user_id, source, source_id) DO NOTHING
       RETURNING id`,
      [
        `np-${crypto.randomUUID()}`,
        userId,
        credit.source,
        credit.sourceId,
        amount,
        JSON.stringify(credit.metadata ?? {}),
      ],
    )
    if (result.rowCount) inserted.push({ ...credit, amount })
  }

  const balanceCredit = inserted.reduce((sum, credit) => sum + credit.amount, 0)
  const rankCredit = inserted
    .filter((credit) => credit.countsTowardClinicalRank !== false)
    .reduce((sum, credit) => sum + credit.amount, 0)

  const walletResult = await client.query(
    `INSERT INTO mednexus_wallet
       (uid, balance, rank_points, lifetime_earned, updated_at)
     VALUES ($1, $2, $3, $2, NOW())
     ON CONFLICT (uid) DO UPDATE
       SET balance = mednexus_wallet.balance + $2,
           rank_points = mednexus_wallet.rank_points + $3,
           lifetime_earned = mednexus_wallet.lifetime_earned + $2,
           updated_at = NOW()
     RETURNING balance, rank_points, lifetime_earned,
       rank_points - $3 AS old_rank_points`,
    [userId, balanceCredit, rankCredit],
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
         (id, user_id, source, source_id, amount, metadata)
       VALUES ($1, $2, 'rank_bonus', $3, $4, $5::jsonb)
       ON CONFLICT (user_id, source, source_id) DO NOTHING
       RETURNING amount`,
      [
        `np-${crypto.randomUUID()}`,
        userId,
        sourceId,
        RANK_UP_BONUS_NP,
        JSON.stringify({ tierName }),
      ],
    )
    if (!bonus.rowCount) continue
    rankBonus += RANK_UP_BONUS_NP
    rankBreakdown.push({ label: `Rank-Up: ${tierName}!`, amount: RANK_UP_BONUS_NP })
  }

  if (rankBonus) {
    const bonusWallet = await client.query(
      `UPDATE mednexus_wallet
       SET balance = balance + $1,
           lifetime_earned = lifetime_earned + $1,
           updated_at = NOW()
       WHERE uid = $2
       RETURNING balance, lifetime_earned`,
      [rankBonus, userId],
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
  }
}

export async function recordDailyActivity(
  client: PoolClient,
  userId: string,
  questionsAnswered: number,
  correctAnswers: number,
) {
  if (questionsAnswered <= 0) return
  await client.query(
    `INSERT INTO mednexus_daily_activity
       (user_id, activity_date, questions_answered, correct_answers)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, activity_date) DO UPDATE
       SET questions_answered = mednexus_daily_activity.questions_answered + EXCLUDED.questions_answered,
           correct_answers = mednexus_daily_activity.correct_answers + EXCLUDED.correct_answers`,
    [
      userId,
      TODAY_DATE(),
      Math.max(0, Math.floor(questionsAnswered)),
      Math.max(0, Math.floor(correctAnswers)),
    ],
  )
}

export async function completionBonusAvailable(client: PoolClient, userId: string) {
  // Serialize the per-user daily cap check inside the caller's transaction so
  // simultaneous game completions cannot both claim the fifth bonus.
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
  return Number(result.rows[0]?.count ?? 0) < 5
}

