/**
 * POST /api/game-rooms/[pin]/score
 *
 * Secure match-scoring RPC. The client sends ONLY the raw facts —
 * { match_id, playerId, user_answers_array } — and the server:
 *
 *  1. Loads the authoritative question_pool from the DB (never trusts the client).
 *  2. Calculates accuracy + NP payout entirely server-side.
 *  3. Writes the updated wallet balance atomically inside a transaction.
 *  4. Guards against double-submission via the scored_uids ledger column.
 *
 * The client cannot inflate its score because it never sends a score —
 * only its answer choices, which are checked against the stored correctAnswer.
 */

import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized, identityMismatch } from "@/lib/request-auth"
import {
  getTodaysBounties,
  computeBountyProgress,
  mergeBountyProgress,
  TODAY_DATE,
  type GameResult,
} from "@/lib/economy"
import {
  applyNPCredits,
  dailyRewardRemaining,
  recordDailyActivity,
  type NPCredit,
} from "@/lib/np-ledger"
import { ECONOMY_CONFIG, isEarningModeEnabled } from "@/lib/economy-config"
import { recordWeeklyGoalActivity } from "@/lib/weekly-goals"

interface AnswerEntry {
  /** Index into the room's question_pool */
  qi: number
  /** The player's chosen option id, e.g. "A" | "B" | "C" | "D" */
  answer: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { pin } = await params

    const body = await req.json() as {
      match_id?: string
      playerId?: string
      user_answers_array?: AnswerEntry[]
    }

    const { match_id, user_answers_array } = body
    const playerId = auth.uid

    // ── Basic validation ────────────────────────────────────────────────────
    if (identityMismatch(body.playerId, auth)) return NextResponse.json({ error: "Authenticated identity mismatch" }, { status: 403 })
    if (!match_id || !Array.isArray(user_answers_array)) {
      return NextResponse.json(
        { error: "Missing match_id or user_answers_array" },
        { status: 400 }
      )
    }

    // match_id must equal the room PIN — binding client payload to this room
    if (match_id !== pin) {
      return NextResponse.json(
        { error: "match_id does not match room PIN" },
        { status: 400 }
      )
    }

    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      // ── Load authoritative room state (with row lock) ──────────────────────
      const res = await client.query(
        "SELECT question_pool, phase, players, host_id, mode, scored_uids, answer_history FROM mednexus_game_rooms WHERE pin = $1 FOR UPDATE",
        [pin]
      )
      if (res.rows.length === 0) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Room not found" }, { status: 404 })
      }

      const room = res.rows[0] as {
        question_pool: { id: string; correctAnswer: string; discipline?: string }[]
        phase: string
        players: { id: string; score: number; streak: number; isSpectator?: boolean; status?: string }[]
        host_id: string
        mode: string
        scored_uids: string[]
        answer_history: Record<string, AnswerEntry[]>
      }
      if (!isEarningModeEnabled("mcq_multiplayer_game")
        || !(ECONOMY_CONFIG.modeIds.multiplayerGames as readonly string[]).includes(room.mode)) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Rewards are disabled for this mode" }, { status: 422 })
      }

      const storedPayout = await client.query(
        "SELECT payout FROM mednexus_multiplayer_payouts WHERE room_pin = $1 AND user_id = $2",
        [pin, playerId],
      )
      if (storedPayout.rows[0]?.payout) {
        await client.query("COMMIT")
        return NextResponse.json(storedPayout.rows[0].payout)
      }

      // ── Verify room is finished (only score completed games) ───────────────
      if (room.phase !== "done") {
        await client.query("ROLLBACK")
        return NextResponse.json(
          { error: "Room is not yet finished" },
          { status: 409 }
        )
      }

      // ── Verify playerId is a legitimate room participant ───────────────────
      // Prevents an outsider who knows a finished PIN from minting credits for
      // arbitrary UIDs. Only players who actually joined the room may score.
      const isParticipant = room.players.some(p => p.id === playerId)
      if (!isParticipant) {
        await client.query("ROLLBACK")
        return NextResponse.json(
          { error: "Player is not a participant in this room" },
          { status: 403 }
        )
      }

      // ── Deduplication guard ────────────────────────────────────────────────
      // scored_uids is the server-side ledger of already-paid players.
      // A player can only receive a payout once per match.
      const alreadyScored: string[] = room.scored_uids ?? []
      if (alreadyScored.includes(playerId)) {
        await client.query("ROLLBACK")
        return NextResponse.json(
          { error: "Score already submitted for this player" },
          { status: 409 }
        )
      }

      // ── Server-side answer verification ───────────────────────────────────
      // The question_pool stored in the DB is the source of truth.
      // We check each submitted answer against the stored correctAnswer.
      //
      // Deduplication by qi: only the FIRST answer for each question index is
      // kept. This closes the scoring-inflation vector where a client could
      // repeat the same correct question index to inflate correct/total/streak.
      const seen = new Set<number>()
      const deduped: AnswerEntry[] = []
      // Rewards require server-recorded answer history; the request body is
      // transport compatibility only and is never a payout source of truth.
      const authoritativeAnswers = room.answer_history?.[playerId] ?? []
      for (const entry of authoritativeAnswers) {
        if (typeof entry.qi !== "number" || typeof entry.answer !== "string") continue
        if (seen.has(entry.qi)) continue
        seen.add(entry.qi)
        deduped.push(entry)
      }

      const pool_questions = room.question_pool
      let correct = 0
      let total = 0
      let bestStreak = 0
      let currentStreak = 0

      for (const entry of deduped) {
        const q = pool_questions[entry.qi]
        if (!q) continue // skip out-of-range indices silently
        total++
        if (entry.answer === q.correctAnswer) {
          correct++
          currentStreak++
          bestStreak = Math.max(bestStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      }

      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0

      // ── Find the player's in-game score (used for isNewHigh context) ───────
      const playerRow = room.players.find(p => p.id === playerId)
      const inGameScore = playerRow?.score ?? 0

      const result: GameResult = {
        mode: room.mode as GameResult["mode"],
        score: inGameScore,
        correct,
        total,
        bestStreak,
        // isNewHigh is a hint — the payout route will verify against the DB
        isNewHigh: false,
        survivedCount: correct,
        accuracy,
        disciplines: [...new Set(deduped.map(answer => pool_questions[answer.qi]?.discipline).filter((value): value is string => Boolean(value)))],
      }

      // The host is a presenter only in Cohort Review. In every competitive
      // mode the host answers questions and must be ranked/rewarded like the
      // other players.
      const eligiblePlayers = room.players
        .filter(p => !(room.mode === "cohort" && p.id === room.host_id)
          && !p.isSpectator
          && p.status !== "disconnected")
      const memberSet = eligiblePlayers.map(p => p.id).sort().join(":")
      const playerRank = [...eligiblePlayers].sort((a, b) => b.score - a.score)
        .findIndex(p => p.id === playerId) + 1
      const meaningfulParticipants = eligiblePlayers.filter((player) => {
        const validQuestions = new Set((room.answer_history?.[player.id] ?? [])
          .map(entry => entry.qi)
          .filter(qi => Number.isInteger(qi) && room.question_pool[qi]))
        return validQuestions.size >= ECONOMY_CONFIG.gameRewards.multiplayer.minimumAnswers
      })
      const meaningfulMatch = room.question_pool.length >= ECONOMY_CONFIG.gameRewards.multiplayer.minimumAnswers
        && meaningfulParticipants.length >= ECONOMY_CONFIG.gameRewards.multiplayer.minimumPlayers
        && playerRank > 0
        && total >= ECONOMY_CONFIG.gameRewards.multiplayer.minimumAnswers
      if (!meaningfulMatch) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Match does not meet the reward eligibility policy" }, { status: 422 })
      }
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`multiplayer-members:${memberSet}:${TODAY_DATE()}`])
      const priorMemberMatch = await client.query(
        `SELECT 1 FROM mednexus_np_transactions
         WHERE source = ANY(ARRAY['game_completion', 'multiplayer_reward']) AND metadata->>'memberSet' = $1
           AND source_id NOT LIKE $2
           AND created_at >= $3::date AND created_at < $3::date + INTERVAL '1 day'
         LIMIT 1`,
        [memberSet, `${pin}:%`, TODAY_DATE()],
      )
      if (priorMemberMatch.rowCount) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "This member set has already earned from a match today" }, { status: 422 })
      }

      const completionNP = ECONOMY_CONFIG.gameRewards.multiplayer.participation
      const achievementNP = ECONOMY_CONFIG.gameRewards.multiplayer.placeBonuses[playerRank - 1] ?? 0
      const achievementBreakdown = achievementNP > 0
        ? [{ label: `${playerRank === 1 ? "🥇" : playerRank === 2 ? "🥈" : "🥉"} Place Bonus`, amount: achievementNP }]
        : []
      const extraBreakdown: { label: string; amount: number }[] = []

      const playerRank1 = playerRank === 1
      const credits: NPCredit[] = []
      if (completionNP > 0) {
        credits.push({
          source: "game_completion",
          sourceId: `${pin}:${playerId}`,
          amount: completionNP,
          metadata: { mode: room.mode, multiplayer: true, memberSet, economyDate: TODAY_DATE(), rewardCategory: "multiplayer_participation" },
        })
      }
      if (achievementNP > 0) {
        credits.push({
          source: "multiplayer_reward",
          sourceId: `${pin}:${playerId}`,
          amount: achievementNP,
          metadata: { mode: room.mode, score: inGameScore, accuracy, bestStreak, memberSet, economyDate: TODAY_DATE(), rewardCategory: "multiplayer_placement" },
        })
      }

      if (playerRank1) {
        const firstWin = await client.query(
          `SELECT 1 FROM mednexus_np_transactions WHERE user_id = $1
             AND source = 'first_multiplayer_win' AND source_id = $2 LIMIT 1`,
          [playerId, `${TODAY_DATE()}:${playerId}`],
        )
        if (!firstWin.rowCount) {
          credits.push({
            source: "first_multiplayer_win",
            sourceId: `${TODAY_DATE()}:${playerId}`,
            amount: ECONOMY_CONFIG.gameRewards.multiplayer.firstDailyWin,
            metadata: { roomPin: pin, mode: room.mode, rewardCategory: "first_multiplayer_win" },
          })
          extraBreakdown.push({ label: "🌅 First Win of the Day!", amount: ECONOMY_CONFIG.gameRewards.multiplayer.firstDailyWin })
        }
      }

      let remaining = await dailyRewardRemaining(client, playerId, "multiplayer")
      for (const entry of credits) {
        entry.amount = Math.min(entry.amount, remaining)
        remaining -= entry.amount
      }
      const credit = await applyNPCredits(client, playerId, credits)
      await recordDailyActivity(client, playerId, total, correct)
      const weekly = await recordWeeklyGoalActivity(client, playerId, { answered: total, correct })

      const todayBounties = getTodaysBounties()
      const today = TODAY_DATE()
      const bountyUpdates: {
        id: string; progress: number; target: number; claimed: boolean; newlyComplete: boolean; reward: number
      }[] = []
      const bountyCredits: NPCredit[] = []

      for (const bounty of todayBounties) {
        const delta = computeBountyProgress(bounty, result)
        if (delta <= 0) continue

        const { rows: existing } = await client.query(
          `SELECT progress, claimed FROM mednexus_bounty_progress
           WHERE uid = $1 AND bounty_id = $2 AND bounty_date = $3
           FOR UPDATE`,
          [playerId, bounty.id, today]
        )
        const current = existing[0]
        if (current?.claimed) continue

        const oldProgress = Number(current?.progress ?? 0)
        const newProgress = mergeBountyProgress(bounty, oldProgress, delta)

        const newlyComplete = oldProgress < bounty.target && newProgress >= bounty.target
        await client.query(
          `INSERT INTO mednexus_bounty_progress (uid, bounty_id, bounty_date, progress, claimed)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (uid, bounty_id, bounty_date) DO UPDATE
             SET progress = EXCLUDED.progress, claimed = EXCLUDED.claimed`,
          [playerId, bounty.id, today, newProgress, newlyComplete]
        )
        if (newlyComplete) bountyCredits.push({
          source: "bounty", sourceId: `${today}:${bounty.id}`, amount: bounty.reward,
          metadata: { bountyId: bounty.id, automatic: true },
        })

        bountyUpdates.push({
          id: bounty.id,
          progress: newProgress,
          target: bounty.target,
          claimed: newlyComplete,
          newlyComplete,
          reward: newlyComplete ? bounty.reward : 0,
        })
      }
      const bountyCredit = await applyNPCredits(client, playerId, bountyCredits)

      const payload = {
        earned: credit.credited + bountyCredit.credited + weekly.credited.credited,
        newBalance: bountyCredit.credited > 0 ? bountyCredit.newBalance : weekly.credited.newBalance,
        breakdown: [
          ...(completionNP > 0 ? [{ label: "Participation", amount: completionNP }] : []),
          ...achievementBreakdown,
          ...extraBreakdown,
          ...bountyUpdates.filter(item => item.newlyComplete).map(item => ({ label: `Bounty: ${todayBounties.find(b => b.id === item.id)?.label ?? item.id}`, amount: item.reward })),
          ...credit.rankBreakdown,
          ...weekly.newlyCompleted.map(id => ({ label: `Weekly goal: ${id}`, amount: ECONOMY_CONFIG.weeklyGoals.find(goal => goal.id === id)?.reward ?? 0 })),
          ...weekly.credited.rankBreakdown,
          ...bountyCredit.rankBreakdown,
        ],
        bountyUpdates,
        serverStats: { correct, total, accuracy, bestStreak },
      }

      await client.query(
        `INSERT INTO mednexus_multiplayer_payouts (room_pin, user_id, payout)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (room_pin, user_id) DO NOTHING`,
        [pin, playerId, JSON.stringify(payload)],
      )
      await client.query(
        `UPDATE mednexus_game_rooms
            SET scored_uids = scored_uids || $1::jsonb
          WHERE pin = $2`,
        [JSON.stringify([playerId]), pin]
      )

      await client.query("COMMIT")
      return NextResponse.json(payload)
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  } catch (e) {
    console.error("[game-rooms/score POST]", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
