import type { PoolClient } from "pg"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { analyzeStoreEconomy } from "@/lib/economy-analysis"

/** Aggregate, privacy-conscious economy telemetry for rate reviews. */
export async function buildEconomyReport(client: PoolClient, days = 30) {
  const boundedDays = Math.min(365, Math.max(1, Math.floor(days)))
  const params = [boundedDays]
  const [created, spent, earnings, capUsers, supply, questions, sessions, bounties] = await Promise.all([
    client.query(`SELECT source, SUM(amount)::bigint AS amount, COUNT(*)::int AS transactions
      FROM mednexus_np_transactions WHERE amount > 0 AND created_at >= NOW() - $1 * INTERVAL '1 day'
      GROUP BY source ORDER BY amount DESC`, params),
    client.query(`SELECT COALESCE(metadata->>'storeCategory', 'uncategorized') AS category,
      SUM(-amount)::bigint AS amount, COUNT(*)::int AS purchases
      FROM mednexus_np_transactions WHERE source = 'store_purchase' AND amount < 0
      AND created_at >= NOW() - $1 * INTERVAL '1 day' GROUP BY 1 ORDER BY amount DESC`, params),
    client.query(`WITH daily AS (
        SELECT user_id, (created_at AT TIME ZONE '${ECONOMY_CONFIG.timezone}')::date AS day, SUM(amount) AS earned
        FROM mednexus_np_transactions WHERE amount > 0 AND metadata->>'ceilingPolicy' = 'repeatable_mcq'
        AND created_at >= NOW() - $1 * INTERVAL '1 day' GROUP BY 1, 2)
      SELECT COALESCE(AVG(earned), 0)::numeric(12,2) AS average,
        COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY earned), 0)::numeric(12,2) AS p50,
        COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY earned), 0)::numeric(12,2) AS p90,
        COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY earned), 0)::numeric(12,2) AS p95,
        COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY earned), 0)::numeric(12,2) AS p99 FROM daily`, params),
    client.query(`WITH daily AS (
        SELECT user_id, (created_at AT TIME ZONE '${ECONOMY_CONFIG.timezone}')::date AS day,
          SUM(amount) FILTER (WHERE metadata->>'ceilingPolicy'='repeatable_mcq') AS global_np,
          SUM(amount) FILTER (WHERE source IN ('question_reward','game_completion','game_achievement')) AS solo_np,
          SUM(amount) FILTER (WHERE source IN ('game_completion','multiplayer_question','multiplayer_reward','first_multiplayer_win')) AS multiplayer_np,
          SUM(amount) FILTER (WHERE source IN ('group_study_question','group_study_completion','group_study_accuracy')) AS group_study_np
        FROM mednexus_np_transactions WHERE created_at >= NOW() - $1 * INTERVAL '1 day' GROUP BY 1,2)
      SELECT COUNT(DISTINCT user_id) FILTER (WHERE global_np >= ${ECONOMY_CONFIG.repeatableDailyCeiling})::int AS global,
        COUNT(DISTINCT user_id) FILTER (WHERE solo_np >= ${ECONOMY_CONFIG.gameRewards.solo.dailyCap})::int AS solo,
        COUNT(DISTINCT user_id) FILTER (WHERE multiplayer_np >= ${ECONOMY_CONFIG.gameRewards.multiplayer.dailyCap})::int AS multiplayer,
        COUNT(DISTINCT user_id) FILTER (WHERE group_study_np >= ${ECONOMY_CONFIG.gameRewards.groupStudy.dailyCap})::int AS group_study FROM daily`, params),
    client.query(`SELECT COALESCE(SUM(balance), 0)::bigint AS outstanding, COUNT(*)::int AS wallets FROM mednexus_wallet`),
    client.query(`SELECT question_id AS "questionId", reward_scope AS "rewardScope", SUM(correct_count)::bigint AS attempts,
        COUNT(*)::int AS users FROM mednexus_user_question_progress
      GROUP BY question_id,reward_scope HAVING SUM(correct_count) > 1 ORDER BY attempts DESC LIMIT 20`),
    client.query(`SELECT id AS "sessionId", mode, user_id AS "userId", jsonb_array_length(question_ids)::int AS questions
      FROM mednexus_exam_sessions WHERE submitted_at >= NOW() - $1 * INTERVAL '1 day'
      ORDER BY jsonb_array_length(question_ids) DESC, submitted_at DESC LIMIT 20`, params),
    client.query(`SELECT bounty_id AS "bountyId", COUNT(*)::int AS started,
      COUNT(*) FILTER (WHERE claimed)::int AS completed,
      ROUND(100.0 * COUNT(*) FILTER (WHERE claimed) / NULLIF(COUNT(*), 0), 2) AS "completionRate"
      FROM mednexus_bounty_progress WHERE bounty_date::date >= CURRENT_DATE - $1 GROUP BY bounty_id ORDER BY started DESC`, params),
  ])
  return {
    periodDays: boundedDays,
    generatedAt: new Date().toISOString(),
    economyVersion: ECONOMY_CONFIG.economyVersion,
    policy: { repeatableDailyCeiling: ECONOMY_CONFIG.repeatableDailyCeiling, rankUpBonusesCount: false },
    npCreatedPerSource: created.rows,
    npSpentPerStoreCategory: spent.rows,
    dailyRepeatableEarnings: earnings.rows[0],
    usersHittingCaps: capUsers.rows[0],
    outstandingWalletSupply: supply.rows[0],
    topRepeatedQuestions: questions.rows,
    topSessions: sessions.rows,
    bountyCompletionRates: bounties.rows,
    storePurchaseTimes: analyzeStoreEconomy(ECONOMY_CONFIG.store).map(item => ({
      itemId: item.id,
      price: item.price,
      casualDays: item.casualDays,
      activeDays: item.activeDays,
      flags: item.flags,
    })),
    guidance: "Observe at least one complete reporting period before revising versioned rates; use these aggregates rather than anecdotal reports alone.",
  }
}
