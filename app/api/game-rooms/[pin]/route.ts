import { NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"

type RoomPhase = "lobby" | "question" | "reveal" | "done"

interface RoomPlayer {
  id: string; name: string; score: number; streak: number
  answer: string | null; answeredAt: number | null; isHost: boolean
}

interface SlimQuestion {
  id: string; subject: string; module: string | null
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string
}

interface RawRoom {
  pin: string; mode: "clash" | "cohort"; host_id: string; host_name: string
  question_pool: SlimQuestion[]; current_qi: number; phase: RoomPhase
  players: RoomPlayer[]; version: number; created_at: Date
}

function buildResponse(row: RawRoom, myId?: string) {
  // Never expose correctAnswer while players are still answering
  const isRevealedPhase = row.phase === "reveal" || row.phase === "done"
  const safePool = row.question_pool.map((q) => ({
    ...q,
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
      action: "join" | "start" | "answer" | "advance" | "finish"
      playerId?: string
      playerName?: string
      answer?: string
      requesterId?: string // caller's ID — required for host-only actions
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

        // Clash: max 5 players
        if (row.mode === "clash" && players.length >= 5) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Room is full (max 5 players)" }, { status: 409 })
        }

        players.push({
          id: body.playerId, name: body.playerName,
          score: 0, streak: 0, answer: null, answeredAt: null, isHost: false,
        })

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
        players = players.map(p => ({ ...p, answer: null, answeredAt: null }))
        await client.query(
          "UPDATE mednexus_game_rooms SET phase = 'question', current_qi = 0, players = $1, version = COALESCE(version, 0) + 1 WHERE pin = $2",
          [JSON.stringify(players), pin]
        )
        break
      }

      case "answer": {
        if (!body.playerId || !body.answer) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Missing playerId or answer" }, { status: 400 })
        }
        // Verify caller is the player they claim to be
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
          const newStreak = correct ? p.streak + 1 : 0
          const newScore = correct ? p.score + 100 + Math.max(0, p.streak * 10) : p.score
          return { ...p, answer: body.answer!, answeredAt: now, score: newScore, streak: newStreak }
        })

        await client.query(
          "UPDATE mednexus_game_rooms SET players = $1, version = COALESCE(version, 0) + 1 WHERE pin = $2",
          [JSON.stringify(players), pin]
        )
        break
      }

      case "advance": {
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

    // Return updated state (pass requesterId as myId for personalized response)
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
