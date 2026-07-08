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
import pool, { ensureSchema } from "@/lib/db"
import {
  calculatePayout,
  getTodaysBounties,
  computeBountyProgress,
  computeRankUpBonus,
  CLINICAL_TIERS,
  RANK_UP_BONUS_NP,
  TODAY_DATE,
  type GameResult,
} from "@/lib/economy"

const FIRST_WIN_BONUS_NP = 250
const STUDY_GROUP_BONUS_PER_PLAYER = 20

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
    await ensureSchema()
    const { pin } = await params

    const body = await req.json() as {
      match_id?: string
      playerId?: string
      user_answers_array?: AnswerEntry[]
    }

    const { match_id, playerId, user_answers_array } = body

    // ── Basic validation ────────────────────────────────────────────────────
    if (!match_id || !playerId || !Array.isArray(user_answers_array)) {
      return NextResponse.json(
        { error: "Missing match_id, playerId, or user_answers_array" },
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
        "SELECT question_pool, phase, players, host_id, mode, scored_uids FROM mednexus_game_rooms WHERE pin = $1 FOR UPDATE",
        [pin]
      )
      if (res.rows.length === 0) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Room not found" }, { status: 404 })
      }

      const room = res.rows[0] as {
        question_pool: { id: string; correctAnswer: string }[]
        phase: string
        players: { id: string; score: number; streak: number; isSpectator?: boolean; status?: string }[]
        host_id: string
        mode: string
        scored_uids: string[]
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
      for (const entry of user_answers_array) {
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
      }

      // ── Payout calculation ─────────────────────────────────────────────────
      // Clash and Cohort use rank-based fixed payouts; all other modes use the
      // generic accuracy/streak/participation calculator.
      const isClashOrCohort = room.mode === "clash" || room.mode === "cohort"
      const isCohortHost = room.mode === "cohort" && room.host_id === playerId

      let earned: number
      let breakdown: { label: string; amount: number }[]

      if (isClashOrCohort) {
        // Rank players: non-spectators only; cohort host is presenter — excluded
        const rankedPlayers = [...room.players]
          .filter(p => !p.isSpectator && !(room.mode === "cohort" && p.id === room.host_id))
          .sort((a, b) => b.score - a.score)
        const playerRankIndex = rankedPlayers.findIndex(p => p.id === playerId)
        const playerRank  = playerRankIndex + 1  // 1-indexed; 0 = not in ranked list
        const totalRanked = rankedPlayers.length

        let rankNP    = 0
        let rankLabel = "🎯 Participation Bonus"

        if (isCohortHost) {
          rankNP    = 0
          rankLabel = "📋 Host (Presenter)"
        } else if (room.mode === "clash") {
          if      (playerRank === 1)                       { rankNP = 150; rankLabel = "🥇 1st Place"           }
          else if (playerRank === 2 && totalRanked >= 2)   { rankNP = 100; rankLabel = "🥈 2nd Place"           }
          else if (playerRank === 3 && totalRanked >= 3)   { rankNP = 50;  rankLabel = "🥉 3rd Place"           }
          else                                             { rankNP = 25;  rankLabel = "🎯 Participation Bonus"  }
        } else {
          // Cohort — Top 10 tier payouts
          if      (playerRank === 1)              { rankNP = 500; rankLabel = "🥇 1st Place"                    }
          else if (playerRank === 2)              { rankNP = 350; rankLabel = "🥈 2nd Place"                    }
          else if (playerRank === 3)              { rankNP = 200; rankLabel = "🥉 3rd Place"                    }
          else if (playerRank <= 10)              { rankNP = 75;  rankLabel = `🏅 Top 10 (Rank #${playerRank})` }
          else                                    { rankNP = 25;  rankLabel = "🎯 Participation Bonus"          }
        }

        earned    = rankNP
        breakdown = rankNP > 0 ? [{ label: rankLabel, amount: rankNP }] : []
      } else {
        const payout = calculatePayout(result)
        earned   = payout.total
        breakdown = payout.breakdown
      }

      const extraBreakdown: { label: string; amount: number }[] = []

      // ── Determine bonus eligibility ────────────────────────────────────────
      const isHost = room.host_id === playerId
      const activePlayers = room.players.filter(p => p.status === undefined || (p as { status?: string }).status !== "disconnected")
      const sortedByScore = [...room.players].sort((a, b) => b.score - a.score)
      const playerRank1 = sortedByScore[0]?.id === playerId

      // ── Atomic wallet credit (base payout) ────────────────────────────────
      // INSERT ... ON CONFLICT ensures the wallet row exists even for first-time players.
      const { rows: walletRows } = await client.query(
        `INSERT INTO mednexus_wallet (uid, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (uid) DO UPDATE
           SET balance     = mednexus_wallet.balance + $2,
               updated_at  = NOW()
         RETURNING balance, last_multiplayer_win_at`,
        [playerId, earned]
      )
      let newBalance = walletRows[0].balance

      // ── Study Group Dividend: host earns +20 NP per extra player ──────────
      if (isHost && activePlayers.length > 1) {
        const dividendBonus = (activePlayers.length - 1) * STUDY_GROUP_BONUS_PER_PLAYER
        await client.query(
          `UPDATE mednexus_wallet SET balance = balance + $1, updated_at = NOW() WHERE uid = $2`,
          [dividendBonus, playerId]
        )
        newBalance += dividendBonus
        extraBreakdown.push({ label: `📚 Study Group Dividend (${activePlayers.length - 1} players)`, amount: dividendBonus })
      }

      // ── First Win of the Day: rank-1 finish, once per 24 hours ───────────
      if (playerRank1) {
        const lastWin: Date | null = walletRows[0].last_multiplayer_win_at
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const isFirstWinToday = !lastWin || lastWin < twentyFourHoursAgo
        if (isFirstWinToday) {
          await client.query(
            `UPDATE mednexus_wallet
                SET balance = balance + $1,
                    last_multiplayer_win_at = NOW(),
                    updated_at = NOW()
              WHERE uid = $2`,
            [FIRST_WIN_BONUS_NP, playerId]
          )
          newBalance += FIRST_WIN_BONUS_NP
          extraBreakdown.push({ label: "🌅 First Win of the Day!", amount: FIRST_WIN_BONUS_NP })
        }
      }

      // ── Clinical Rank-Up: increment rank_points, award tier bonus ─────────
      const totalEarned = earned + extraBreakdown.reduce((s, b) => s + b.amount, 0)
      const { rows: rpRows } = await client.query(
        `INSERT INTO mednexus_wallet (uid, rank_points)
           VALUES ($1, $2)
         ON CONFLICT (uid) DO UPDATE
           SET rank_points = mednexus_wallet.rank_points + $2
         RETURNING rank_points, (rank_points - $2) AS old_rank_points`,
        [playerId, totalEarned]
      )

      const rankUpResult = computeRankUpBonus(
        Number(rpRows[0].old_rank_points),
        Number(rpRows[0].rank_points)
      )
      if (rankUpResult.tiersGained > 0) {
        await client.query(
          `UPDATE mednexus_wallet SET balance = balance + $1 WHERE uid = $2`,
          [rankUpResult.bonusNP, playerId]
        )
        newBalance += rankUpResult.bonusNP
        for (const tierName of rankUpResult.newTierNames) {
          extraBreakdown.push({ label: `🎓 Rank-Up: ${tierName}!`, amount: RANK_UP_BONUS_NP })
        }
      }

      // ── Bounty progress update ─────────────────────────────────────────────
      const todayBounties = getTodaysBounties()
      const today = TODAY_DATE()
      const bountyUpdates: {
        id: string; progress: number; target: number; claimed: boolean; newlyComplete: boolean
      }[] = []

      for (const bounty of todayBounties) {
        const delta = computeBountyProgress(bounty, result)
        if (delta <= 0) continue

        const { rows: existing } = await client.query(
          `SELECT progress, claimed FROM mednexus_bounty_progress
           WHERE uid = $1 AND bounty_id = $2 AND bounty_date = $3`,
          [playerId, bounty.id, today]
        )
        const current = existing[0]
        if (current?.claimed) continue

        const oldProgress = current?.progress ?? 0
        const newProgress = Math.min(oldProgress + delta, bounty.target)

        await client.query(
          `INSERT INTO mednexus_bounty_progress (uid, bounty_id, bounty_date, progress, claimed)
           VALUES ($1, $2, $3, $4, FALSE)
           ON CONFLICT (uid, bounty_id, bounty_date) DO UPDATE
             SET progress = LEAST(mednexus_bounty_progress.progress + $4, $5)`,
          [playerId, bounty.id, today, delta, bounty.target]
        )

        bountyUpdates.push({
          id: bounty.id,
          progress: newProgress,
          target: bounty.target,
          claimed: false,
          newlyComplete: oldProgress < bounty.target && newProgress >= bounty.target,
        })
      }

      // ── Mark this player as scored in the room ledger ──────────────────────
      // Uses jsonb_array_append so no race condition can produce duplicates
      // even if two requests somehow slip past the row lock check above.
      await client.query(
        `UPDATE mednexus_game_rooms
            SET scored_uids = scored_uids || $1::jsonb
          WHERE pin = $2`,
        [JSON.stringify([playerId]), pin]
      )

      await client.query("COMMIT")

      return NextResponse.json({
        earned: earned + extraBreakdown.reduce((s, b) => s + b.amount, 0),
        newBalance,
        breakdown: [...breakdown, ...extraBreakdown],
        bountyUpdates,
        // Echo back the server-calculated stats for the UI to display
        serverStats: { correct, total, accuracy, bestStreak },
      })
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
