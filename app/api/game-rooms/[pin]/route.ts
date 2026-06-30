import { NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"

type RoomPhase = "lobby" | "wager" | "question" | "reveal" | "done"

interface RoomPlayer {
  id: string; name: string; score: number; streak: number
  answer: string | null; answeredAt: number | null; isHost: boolean
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
      action: "join" | "start" | "answer" | "advance" | "finish" | "place_wager"
      playerId?: string
      playerName?: string
      answer?: string
      wagerAmount?: number
      requesterId?: string
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
          "UPDATE mednexus_game_rooms SET phase = $1, current_qi = 0, players = $2, version = COALESCE(version, 0) + 1 WHERE pin = $3",
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
        if (body.requesterId && body.requesterId !== body.playerId) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
        if (row.phase !== "question") break

        const q = row.question_pool[row.current_qi]
        if (!q) break
        const correct = body.answer === q.correctAnswer
        const now = Date.now()

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
              answer: body.answer!, answeredAt: now,
              score: newBalance, balance: newBalance,
              isSpectator: becameSpectator || !!p.isSpectator,
            }
          }

          // Normal modes
          const newStreak = correct ? p.streak + 1 : 0
          const newScore = correct ? p.score + 100 + Math.max(0, p.streak * 10) : p.score
          return { ...p, answer: body.answer!, answeredAt: now, score: newScore, streak: newStreak }
        })

        await client.query(
          "UPDATE mednexus_game_rooms SET players = $1, version = COALESCE(version, 0) + 1 WHERE pin = $2",
          [JSON.stringify(players), pin]
        )

        // Wager mode: auto-advance to reveal when all active players answered
        if (row.mode === "wager") {
          const activePlayers = players.filter(p => !p.isSpectator)
          const allDone = activePlayers.length === 0 || activePlayers.every(p => p.answer !== null)
          if (allDone) {
            await client.query(
              "UPDATE mednexus_game_rooms SET phase = 'reveal', version = COALESCE(version, 0) + 1 WHERE pin = $1",
              [pin]
            )
          }
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
                "UPDATE mednexus_game_rooms SET phase = 'done', version = COALESCE(version, 0) + 1 WHERE pin = $1",
                [pin]
              )
            } else {
              // Check if any players remain active
              const anyActive = players.some(p => !p.isSpectator)
              if (!anyActive) {
                await client.query(
                  "UPDATE mednexus_game_rooms SET phase = 'done', version = COALESCE(version, 0) + 1 WHERE pin = $1",
                  [pin]
                )
              } else {
                // Reset answer + wagerAmount for all players, go to wager phase
                players = players.map(p => ({ ...p, answer: null, answeredAt: null, wagerAmount: null }))
                await client.query(
                  "UPDATE mednexus_game_rooms SET phase = 'wager', current_qi = $1, players = $2, version = COALESCE(version, 0) + 1 WHERE pin = $3",
                  [nextQi, JSON.stringify(players), pin]
                )
              }
            }
          }
          break
        }

        // Normal modes
        if (row.phase === "question") {
          await client.query(
            "UPDATE mednexus_game_rooms SET phase = 'reveal', version = COALESCE(version, 0) + 1 WHERE pin = $1",
            [pin]
          )
        } else if (row.phase === "reveal") {
          const nextQi = row.current_qi + 1
          if (nextQi >= row.question_pool.length) {
            await client.query(
              "UPDATE mednexus_game_rooms SET phase = 'done', version = COALESCE(version, 0) + 1 WHERE pin = $1",
              [pin]
            )
          } else {
            players = players.map(p => ({ ...p, answer: null, answeredAt: null }))
            await client.query(
              "UPDATE mednexus_game_rooms SET phase = 'question', current_qi = $1, players = $2, version = COALESCE(version, 0) + 1 WHERE pin = $3",
              [nextQi, JSON.stringify(players), pin]
            )
          }
        }
        break
      }

      case "finish": {
        await client.query(
          "UPDATE mednexus_game_rooms SET phase = 'done', version = COALESCE(version, 0) + 1 WHERE pin = $1",
          [pin]
        )
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
