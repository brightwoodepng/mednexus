import type { PoolClient } from "pg"
import { TODAY_DATE } from "@/lib/economy"
import { XP_CONFIG, type XPSource } from "@/lib/xp-config"
import { applyNPCredits } from "@/lib/np-ledger"

export type XPCredit = {
  source: XPSource
  sourceId: string
  amount: number
  seasonId: string
  metadata?: Record<string, unknown>
  competitive?: boolean
}

export type XPCreditResult = {
  credited: number
  suppressed: number
  lifetimeXP: number
  breakdown: { label: string; amount: number }[]
  rankNPCredited: number
  rankNPBalance: number
  rankNPBreakdown: { label: string; amount: number }[]
}

export async function applyXPCredits(client: PoolClient, userId: string, credits: XPCredit[]): Promise<XPCreditResult> {
  const economyDate = TODAY_DATE()
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mednexus:xp:${userId}:${economyDate}`])
  const previousLifetimeResult = await client.query<{ total: string }>("SELECT COALESCE(SUM(amount),0)::text total FROM mednexus_xp_transactions WHERE user_id=$1", [userId])
  const previousLifetimeXP = Number(previousLifetimeResult.rows[0]?.total ?? 0)
  const daily = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount),0)::text total FROM mednexus_xp_transactions
     WHERE user_id=$1 AND competitive=TRUE AND created_at >= $2::date AND created_at < $2::date + INTERVAL '1 day'`,
    [userId, economyDate],
  )
  const dailyIncorrect = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount),0)::text total FROM mednexus_xp_transactions
     WHERE user_id=$1 AND metadata->>'category'='incorrect_attempt'
       AND created_at >= $2::date AND created_at < $2::date + INTERVAL '1 day'`,
    [userId, economyDate],
  )
  let competitiveToday = Number(daily.rows[0]?.total ?? 0)
  let incorrectToday = Number(dailyIncorrect.rows[0]?.total ?? 0)
  let credited = 0
  let suppressed = 0
  const breakdown: { label: string; amount: number }[] = []
  for (const credit of credits) {
    const requested = Math.max(0, Math.floor(credit.amount))
    if (!requested) continue
    const competitive = credit.competitive !== false
    const remaining = Math.max(0, XP_CONFIG.dailyCompetitiveCap - competitiveToday)
    const isIncorrectAttempt = credit.metadata?.category === "incorrect_attempt"
    const incorrectRemaining = isIncorrectAttempt ? Math.max(0, XP_CONFIG.dailyIncorrectCap - incorrectToday) : requested
    const amount = competitive ? Math.min(requested, remaining, incorrectRemaining) : Math.min(requested, incorrectRemaining)
    const result = await client.query(
      `INSERT INTO mednexus_xp_transactions(id,user_id,season_id,source,source_id,amount,competitive,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       ON CONFLICT(user_id,source,source_id) DO NOTHING RETURNING amount`,
      [`xp-${crypto.randomUUID()}`, userId, credit.seasonId, credit.source, credit.sourceId, amount, competitive,
        JSON.stringify({ ...credit.metadata, xpVersion: XP_CONFIG.version, economyDate, requestedAmount: requested, suppressedAmount: requested - amount })],
    )
    if (!result.rowCount) continue
    credited += amount
    suppressed += requested - amount
    if (competitive) competitiveToday += amount
    if (isIncorrectAttempt) incorrectToday += amount
    breakdown.push({ label: String(credit.metadata?.label ?? credit.source), amount })
  }
  const lifetime = await client.query<{ total: string }>("SELECT COALESCE(SUM(amount),0)::text total FROM mednexus_xp_transactions WHERE user_id=$1", [userId])
  const lifetimeXP = Number(lifetime.rows[0]?.total ?? 0)
  const crossedRanks = XP_CONFIG.clinicalRanks.filter(rank => rank.npReward > 0 && previousLifetimeXP < rank.minimumXP && lifetimeXP >= rank.minimumXP)
  const rankCredit = await applyNPCredits(client, userId, crossedRanks.map(rank => ({
    source: "xp_rank_reward",
    sourceId: rank.name,
    amount: rank.npReward,
    countsTowardClinicalRank: false,
    ceilingPolicy: "exempt",
    metadata: { rank: rank.name, minimumXP: rank.minimumXP, lifetimeXP, description: "Lifetime XP rank reward" },
  })))
  return {
    credited, suppressed, lifetimeXP, breakdown,
    rankNPCredited: rankCredit.credited,
    rankNPBalance: rankCredit.newBalance,
    rankNPBreakdown: crossedRanks.map(rank => ({ label: `Rank-Up: ${rank.name}`, amount: rank.npReward })),
  }
}

export function accuracyXP(accuracy: number, rewards: { accuracy70: number; accuracy85: number; accuracy95: number }) {
  return accuracy >= 95 ? rewards.accuracy95 : accuracy >= 85 ? rewards.accuracy85 : accuracy >= 70 ? rewards.accuracy70 : 0
}

export function repeatMultiplier(previousCorrectCount: number) {
  return XP_CONFIG.repeatMultipliers[previousCorrectCount] ?? 0
}

export function sessionXPCredits(input: {
  userId: string
  seasonId: string
  sessionId: string
  mode: string
  attempts: Array<{ isCorrect: boolean; currentStreak?: number }>
  rewardMultipliers?: number[]
  meaningfulCompletion: boolean
  firstDailyCompletion?: boolean
  accuracy: number
  isNewHigh?: boolean
}): XPCredit[] {
  const trial = input.mode === "trial" || input.mode === "tutor"
  const exam = input.mode === "exam"
  const correctReward = trial ? XP_CONFIG.trial.correct : exam ? XP_CONFIG.exam.correct : XP_CONFIG.solo.correct
  const incorrectReward = trial ? XP_CONFIG.trial.incorrect : exam ? XP_CONFIG.exam.incorrect : XP_CONFIG.solo.incorrect
  let correctXP = 0
  let incorrectXP = 0
  input.attempts.forEach((attempt, index) => {
    const multiplier = input.rewardMultipliers?.[index] ?? 1
    if (!attempt.isCorrect) { incorrectXP += incorrectReward; return }
    correctXP += Math.floor(correctReward * multiplier)
    if (trial) {
      const streak = attempt.currentStreak ?? 0
      const bonus = streak >= 10 ? XP_CONFIG.trial.streak10 : streak >= 5 ? XP_CONFIG.trial.streak5 : 0
      correctXP += Math.floor(bonus * multiplier)
    }
  })
  const credits: XPCredit[] = [
    { source: "question", sourceId: `${input.sessionId}:correct`, amount: correctXP, seasonId: input.seasonId, metadata: { mode: input.mode, label: "Correct-answer XP" } },
    { source: "question", sourceId: `${input.sessionId}:incorrect`, amount: incorrectXP, seasonId: input.seasonId, metadata: { mode: input.mode, category: "incorrect_attempt", label: "Attempt XP" } },
  ]
  if (trial) {
    if (input.attempts.length >= 10) credits.push({ source: "completion", sourceId: `${input.sessionId}:completion-10`, amount: XP_CONFIG.trial.completion10, seasonId: input.seasonId, metadata: { mode: input.mode, label: "10-question completion" } })
    if (input.attempts.length >= 25) credits.push({ source: "completion", sourceId: `${input.sessionId}:completion-25`, amount: XP_CONFIG.trial.completion25, seasonId: input.seasonId, metadata: { mode: input.mode, label: "25-question completion" } })
  } else if (input.meaningfulCompletion) {
    const completion = exam ? XP_CONFIG.exam.completion : XP_CONFIG.solo.completion
    const accuracyRewards = exam ? XP_CONFIG.exam : XP_CONFIG.solo
    credits.push({ source: "completion", sourceId: `${input.sessionId}:completion`, amount: completion, seasonId: input.seasonId, metadata: { mode: input.mode, label: "Valid completion" } })
    const accuracyAmount = accuracyXP(input.accuracy, accuracyRewards)
    if (accuracyAmount) credits.push({ source: "accuracy", sourceId: `${input.sessionId}:accuracy`, amount: accuracyAmount, seasonId: input.seasonId, metadata: { mode: input.mode, accuracy: input.accuracy, label: "Accuracy bonus" } })
  }
  if (!trial && !exam && input.firstDailyCompletion) credits.push({ source: "first_daily_completion", sourceId: `${TODAY_DATE()}:${input.userId}:solo`, amount: XP_CONFIG.solo.firstDailyCompletion, seasonId: input.seasonId, metadata: { mode: input.mode, label: "First solo completion" } })
  if (!trial && !exam && input.isNewHigh) credits.push({ source: "personal_best", sourceId: `${input.sessionId}:personal-best`, amount: XP_CONFIG.solo.personalBest, seasonId: input.seasonId, metadata: { mode: input.mode, label: "Personal best" } })
  return credits
}
