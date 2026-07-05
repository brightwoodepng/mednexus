import { NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"

type RoomPhase = "lobby" | "wager" | "question" | "reveal" | "done"

interface RoomPlayer {
  id: string; name: string; score: number; streak: number
  answer: string | null; answeredAt: number | null; isHost: boolean
  status?: "active" | "disconnected"
  // Client-measured time (ms) between question render and answer submission.
  // Used server-side to award a speed bonus — never trusted for correctness.
  reactionTimeMs?: number | null
  // Wager Wars fields
  balance?: number; wagerAmount?: number | null; isSpectator?: boolean
}

interface SlimQuestion {
  id: string; subject: string; module: string | null
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string
}

interface RawRoom {
  pin: string; mode: "clash" | "cohort" | "wager"; host_id: string; host_name: string
  question_pool: SlimQuestion[]; current_qi: number; phase: RoomPhase
  players: RoomPlayer[]; version: number; created_at: Date
  scored_uids: string[]; phase_started_at: Date
}

// ── Self-driven match pacing ────────────────────────────────────────────────
// This app has no push/realtime infra (no Supabase, no websockets) — clients
// poll GET every 1.5s. Rather than requiring the host to click through every
// step, we treat each GET/PATCH as a "tick": if enough time has elapsed since
// the last phase change (or every active player has already answered), the
// server advances the match itself. This removes the host as a bottleneck
// while staying entirely inside the existing Postgres + polling architecture.
const QUESTION_TIME_LIMIT_MS = 20_000
const REVEAL_DURATION_MS = 3_000

function activePlayers(players: RoomPlayer[]): RoomPlayer[] {
  return players.filter(p => p.status !== "disconnected" && !p.isSpectator)
}

function allActiveAnswered(players: RoomPlayer[]): boolean {
  const active = activePlayers(players)
  return active.length > 0 && active.every(p => p.answer !== null)
}

/**
 * Advances a room's phase automatically when conditions are met, entirely
 * server-side. Safe to call opportunistically from GET or after a PATCH —
 * the UPDATE's WHERE clause double-checks the phase so concurrent calls
 * can't double-advance the same room.
 */
async function autoTick(pin: string): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const res = await client.query("SELECT * FROM mednexus_game_rooms WHERE pin = $1 FOR UPDATE", [pin])
    if (res.rows.length === 0) { await client.query("ROLLBACK"); return }

    const row = res.rows[0] as RawRoom
    // Wager mode already has its own manual/auto-advance flow (place_wager →
    // question, answer → reveal). We only self-drive the "no host bottleneck"
    // pacing for clash/cohort, so wager behavior is left untouched.
    if (row.mode === "wager") { await client.query("ROLLBACK"); return }

    const elapsedMs = Date.now() - new Date(row.phase_started_at).getTime()

    if (row.phase === "question") {
      const shouldReveal = allActiveAnswered(row.players) || elapsedMs >= QUESTION_TIME_LIMIT_MS
      if (shouldReveal) {
        await client.query(
          "UPDATE mednexus_game_rooms SET phase = 'reveal', phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $1 AND phase = 'question'",
          [pin]
        )
      }
    } else if (row.phase === "reveal") {
      if (elapsedMs >= REVEAL_DURATION_MS) {
        const nextQi = row.current_qi + 1
        if (nextQi >= row.question_pool.length) {
          await client.query(
            "UPDATE mednexus_game_rooms SET phase = 'done', phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $1 AND phase = 'reveal'",
            [pin]
          )
        } else {
          const resetPlayers = row.players.map(p => ({ ...p, answer: null, answeredAt: null, reactionTimeMs: null }))
          await client.query(
            "UPDATE mednexus_game_rooms SET phase = 'question', current_qi = $1, players = $2, phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $3 AND phase = 'reveal'",
            [nextQi, JSON.stringify(resetPlayers), pin]
          )
        }
      }
    }

    await client.query("COMMIT")
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("[game-rooms autoTick]", err)
  } finally {
    client.release()
  }
}

function buildResponse(row: RawRoom, myId?: string) {
  const isRevealedPhase = row.phase === "reveal" || row.phase === "done"
  const isWagerPhase = row.phase === "wager"

  const safePool = row.question_pool.map((q) => ({
    ...q,
    // Hide options during wager phase (show vignette only)
    options: isWagerPhase ? [] : q.options,
    // Hide correct answer until reveal
    correctAnswer: isRevealedPhase ? q.correctAnswer : undefined,
  }))

  const sorted = [...row.players].sort((a, b) => b.score - a.score)
  const leaderboard = sorted.slice(0, 5)
  const ranks: Record<string, number> = {}
  sorted.forEach((p, i) => { ranks[p.id] = i + 1 })

  return {
    pin: row.pin,
    mode: row.mode,
    hostId: row.host_id,
    hostName: row.host_name,
    questionPool: safePool,
    currentQi: row.current_qi,
    phase: row.phase,
    players: row.players,
    version: row.version ?? 0,
    createdAt: row.created_at?.toISOString?.() ?? "",
    leaderboard,
    ranks,
    myRank: myId ? (ranks[myId] ?? null) : null,
  }
}

// GET /api/game-rooms/[pin] — poll room state
export async function GET(
  req: Request,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    await ensureSchema()
    const { pin } = await params
    const myId = new URL(req.url).searchParams.get("playerId") ?? undefined

    // Every poll is a pacing "tick" — self-drives reveal/next-question
    // transitions without any host click, using elapsed phase_started_at time
    // or "all active players answered" as the trigger.
    await autoTick(pin)

    const res = await pool.query("SELECT * FROM mednexus_game_rooms WHERE pin = $1", [pin])
    if (res.rows.length === 0) return NextResponse.json({ error: "Room not found" }, { status: 404 })

    return NextResponse.json(buildResponse(res.rows[0] as RawRoom, myId))
  } catch (err) {
    console.error("[game-rooms GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH /api/game-rooms/[pin] — perform actions
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ pin: string }> }
) {
  const client = await pool.connect()
  try {
    await ensureSchema()
    const { pin } = await params
    const body = await req.json() as {
      action: "join" | "start" | "answer" | "advance" | "finish" | "place_wager" | "disconnect"
      playerId?: string
      playerName?: string
      answer?: string
      // Full display text of the selected option (e.g. "Erythropoietin"). Used
      // as the primary validation signal — text-based matching is immune to
      // index-ordering bugs that occur when options are shuffled client-side.
      answerText?: string
      wagerAmount?: number
      requesterId?: string
      // Client-measured ms between question render and answer submission (speed bonus input)
      reactionTimeMs?: number
    }

    await client.query("BEGIN")
    const res = await client.query("SELECT * FROM mednexus_game_rooms WHERE pin = $1 FOR UPDATE", [pin])
    if (res.rows.length === 0) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "Room not found" }, { status: 404 })
    }

    const row = res.rows[0] as RawRoom
    let players = [...row.players]

    // ── Host-only action guard ────────────────────────────────────────────────
    const HOST_ACTIONS = ["start", "advance", "finish"]
    if (HOST_ACTIONS.includes(body.action)) {
      if (!body.requesterId || body.requesterId !== row.host_id) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Forbidden: host-only action" }, { status: 403 })
      }
    }

    switch (body.action) {
      case "join": {
        if (!body.playerId || !body.playerName) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Missing playerId or playerName" }, { status: 400 })
        }
        // Idempotent rejoin
        if (players.find(p => p.id === body.playerId)) break

        if (row.phase !== "lobby") {
          // Allow late join in cohort only
          if (row.mode !== "cohort") {
            await client.query("ROLLBACK")
            return NextResponse.json({ error: "Game already started" }, { status: 409 })
          }
        }

        // Clash: max 5 players; Wager: max 8
        if (row.mode === "clash" && players.length >= 5) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Room is full (max 5 players)" }, { status: 409 })
        }
        if (row.mode === "wager" && players.length >= 8) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Room is full (max 8 players)" }, { status: 409 })
        }

        const newPlayer: RoomPlayer = {
          id: body.playerId, name: body.playerName,
          score: 0, streak: 0, answer: null, answeredAt: null, isHost: false,
          ...(row.mode === "wager" ? { balance: 1000, wagerAmount: null, isSpectator: false } : {}),
        }
        players.push(newPlayer)

        await client.query(
          "UPDATE mednexus_game_rooms SET players = $1, version = COALESCE(version, 0) + 1 WHERE pin = $2",
          [JSON.stringify(players), pin]
        )
        break
      }

      case "start": {
        if (row.phase !== "lobby") {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Already started" }, { status: 409 })
        }
        const startPhase: RoomPhase = row.mode === "wager" ? "wager" : "question"
        players = players.map(p => ({
          ...p,
          answer: null, answeredAt: null,
          ...(row.mode === "wager" ? { balance: 1000, wagerAmount: null, isSpectator: false } : {}),
        }))
        await client.query(
          "UPDATE mednexus_game_rooms SET phase = $1, current_qi = 0, players = $2, phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $3",
          [startPhase, JSON.stringify(players), pin]
        )
        break
      }

      case "place_wager": {
        if (!body.playerId || body.wagerAmount === undefined) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Missing playerId or wagerAmount" }, { status: 400 })
        }
        if (row.phase !== "wager") {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Not in wager phase" }, { status: 409 })
        }
        if (row.mode !== "wager") {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Not a wager room" }, { status: 400 })
        }

        players = players.map(p => {
          if (p.id !== body.playerId) return p
          if (p.wagerAmount !== null) return p // already wagered
          if (p.isSpectator) return p
          const balance = p.balance ?? 1000
          const clampedWager = Math.max(10, Math.min(Math.floor(body.wagerAmount!), balance))
          return { ...p, wagerAmount: clampedWager }
        })

        await client.query(
          "UPDATE mednexus_game_rooms SET players = $1, version = COALESCE(version, 0) + 1 WHERE pin = $2",
          [JSON.stringify(players), pin]
        )

        // Auto-advance to question phase when all active players have wagered
        const activePlayers = players.filter(p => !p.isSpectator)
        if (activePlayers.length > 0 && activePlayers.every(p => p.wagerAmount !== null)) {
          await client.query(
            "UPDATE mednexus_game_rooms SET phase = 'question', version = COALESCE(version, 0) + 1 WHERE pin = $1",
            [pin]
          )
        }
        break
      }

      case "answer": {
        if (!body.playerId || !body.answer) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Missing playerId or answer" }, { status: 400 })
        }
        // Require requesterId and enforce it matches playerId — no optional bypass.
        if (!body.requesterId || body.requesterId !== body.playerId) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        if (row.phase !== "question") break

        const q = row.question_pool[row.current_qi]
        if (!q) break
        // Reject answers that don't map to a known option in this question.
        // This prevents spoofed option IDs from being accepted.
        const selectedOption = q.options.find(o => o.id === body.answer)
        if (!selectedOption) break
        // Validate by option ID (authoritative, stored in DB) rather than by
        // position/index so correctness is stable regardless of render order.
        // answerText is accepted for logging/analytics but never trusted for
        // scoring — correctness is always derived from the option ID match.
        const correct = body.answer === q.correctAnswer
        const now = Date.now()

        // Clamp reactionTimeMs to a sane range — never trust it blindly, it's
        // only used to compute a bonus, never to determine correctness.
        const rawReaction = body.reactionTimeMs
        const reactionTimeMs = (typeof rawReaction === "number" && Number.isFinite(rawReaction) && rawReaction >= 0)
          ? Math.min(rawReaction, QUESTION_TIME_LIMIT_MS)
          : null
        // Speed bonus: up to +50 points for an instant answer, decaying to 0
        // by the time the question's time limit is reached.
        const speedBonus = (correct && reactionTimeMs !== null)
          ? Math.round(50 * (1 - reactionTimeMs / QUESTION_TIME_LIMIT_MS))
          : 0

        players = players.map(p => {
          if (p.id !== body.playerId) return p
          if (p.answer !== null) return p // already answered

          if (row.mode === "wager") {
            const wagerAmt = p.wagerAmount ?? 0
            const currentBal = p.balance ?? 1000
            const newBalance = correct ? currentBal + wagerAmt : Math.max(0, currentBal - wagerAmt)
            const becameSpectator = newBalance <= 0
            return {
              ...p,
              answer: body.answer!, answeredAt: now, reactionTimeMs,
              score: newBalance, balance: newBalance,
              isSpectator: becameSpectator || !!p.isSpectator,
            }
          }

          // Normal modes
          const newStreak = correct ? p.streak + 1 : 0
          const newScore = correct ? p.score + 100 + Math.max(0, p.streak * 10) + speedBonus : p.score
          return { ...p, answer: body.answer!, answeredAt: now, reactionTimeMs, score: newScore, streak: newStreak }
        })

        await client.query(
          "UPDATE mednexus_game_rooms SET players = $1, version = COALESCE(version, 0) + 1 WHERE pin = $2",
          [JSON.stringify(players), pin]
        )

        // Wager mode: auto-advance to reveal when all active players answered
        if (row.mode === "wager") {
          const activePlayersW = players.filter(p => !p.isSpectator)
          const allDone = activePlayersW.length === 0 || activePlayersW.every(p => p.answer !== null)
          if (allDone) {
            await client.query(
              "UPDATE mednexus_game_rooms SET phase = 'reveal', phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $1",
              [pin]
            )
          }
        } else if (allActiveAnswered(players)) {
          // Clash/cohort: the moment the LAST connected player answers, reveal
          // immediately rather than waiting for the next 1.5s poll tick.
          await client.query(
            "UPDATE mednexus_game_rooms SET phase = 'reveal', phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $1 AND phase = 'question'",
            [pin]
          )
        }
        break
      }

      case "advance": {
        if (row.mode === "wager") {
          // Wager mode: reveal → next wager or done
          if (row.phase === "reveal") {
            const nextQi = row.current_qi + 1
            if (nextQi >= row.question_pool.length) {
              await client.query(
                "UPDATE mednexus_game_rooms SET phase = 'done', phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $1",
                [pin]
              )
            } else {
              // Check if any players remain active
              const anyActive = players.some(p => !p.isSpectator)
              if (!anyActive) {
                await client.query(
                  "UPDATE mednexus_game_rooms SET phase = 'done', phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $1",
                  [pin]
                )
              } else {
                // Reset answer + wagerAmount for all players, go to wager phase
                players = players.map(p => ({ ...p, answer: null, answeredAt: null, wagerAmount: null }))
                await client.query(
                  "UPDATE mednexus_game_rooms SET phase = 'wager', current_qi = $1, players = $2, phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $3",
                  [nextQi, JSON.stringify(players), pin]
                )
              }
            }
          }
          break
        }

        // Normal modes — manual host override, still supported alongside the
        // automatic self-driven advancement in autoTick().
        if (row.phase === "question") {
          await client.query(
            "UPDATE mednexus_game_rooms SET phase = 'reveal', phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $1",
            [pin]
          )
        } else if (row.phase === "reveal") {
          const nextQi = row.current_qi + 1
          if (nextQi >= row.question_pool.length) {
            await client.query(
              "UPDATE mednexus_game_rooms SET phase = 'done', phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $1",
              [pin]
            )
          } else {
            players = players.map(p => ({ ...p, answer: null, answeredAt: null, reactionTimeMs: null }))
            await client.query(
              "UPDATE mednexus_game_rooms SET phase = 'question', current_qi = $1, players = $2, phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $3",
              [nextQi, JSON.stringify(players), pin]
            )
          }
        }
        break
      }

      case "finish": {
        await client.query(
          "UPDATE mednexus_game_rooms SET phase = 'done', phase_started_at = NOW(), version = COALESCE(version, 0) + 1 WHERE pin = $1",
          [pin]
        )
        break
      }

      case "disconnect": {
        // Mark a player as disconnected. The mednexus_host_migration DB trigger
        // fires automatically on this UPDATE: if the disconnecting player is the
        // host, the trigger promotes the oldest remaining active player and bumps
        // version — pollers notice without any extra application code.
        if (!body.playerId || !body.requesterId) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Missing playerId or requesterId" }, { status: 400 })
        }
        // Only the player themselves may mark themselves disconnected
        if (body.requesterId !== body.playerId) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        players = players.map(p =>
          p.id === body.playerId ? { ...p, status: "disconnected" as const } : p
        )

        await client.query(
          `UPDATE mednexus_game_rooms
             SET players = $1, version = COALESCE(version, 0) + 1
           WHERE pin = $2`,
          [JSON.stringify(players), pin]
        )
        // Note: trigger may have already bumped version again if host changed —
        // the SELECT after COMMIT will return the final authoritative state.
        break
      }

      default:
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    await client.query("COMMIT")

    const updated = await client.query("SELECT * FROM mednexus_game_rooms WHERE pin = $1", [pin])
    return NextResponse.json(buildResponse(updated.rows[0] as RawRoom, body.playerId ?? body.requesterId))
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("[game-rooms PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  } finally {
    client.release()
  }
}

// DELETE /api/game-rooms/[pin] — close room (host only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ pin: string }> }
) {
  try {
    await ensureSchema()
    const { pin } = await params
    const requesterId = new URL(req.url).searchParams.get("requesterId")

    if (!requesterId) return NextResponse.json({ error: "Missing requesterId" }, { status: 400 })

    const check = await pool.query("SELECT host_id FROM mednexus_game_rooms WHERE pin = $1", [pin])
    if (check.rows.length === 0) return NextResponse.json({ ok: true }) // already gone
    if (check.rows[0].host_id !== requesterId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await pool.query("DELETE FROM mednexus_game_rooms WHERE pin = $1", [pin])
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[game-rooms DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
