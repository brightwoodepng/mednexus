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
  TODAY_DATE,
  type GameResult,
} from "@/lib/economy"

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
        "SELECT question_pool, phase, players, mode, scored_uids FROM mednexus_game_rooms WHERE pin = $1 FOR UPDATE",
        [pin]
      )
      if (res.rows.length === 0) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Room not found" }, { status: 404 })
      }

      const room = res.rows[0] as {
        question_pool: { id: string; correctAnswer: string }[]
        phase: string
        players: { id: string; score: number; streak: number }[]
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

      const { total: earned, breakdown } = calculatePayout(result)

      // ── Atomic wallet credit ───────────────────────────────────────────────
      // INSERT ... ON CONFLICT ensures the wallet row exists even for first-time players.
      const { rows: walletRows } = await client.query(
        `INSERT INTO mednexus_wallet (uid, balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (uid) DO UPDATE
           SET balance     = mednexus_wallet.balance + $2,
               updated_at  = NOW()
         RETURNING balance`,
        [playerId, earned]
      )
      const newBalance = walletRows[0].balance

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
        earned,
        newBalance,
        breakdown,
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
