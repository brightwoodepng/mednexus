import { NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"
import type { Question } from "@/lib/types"

// Strip to only what's needed in-room to keep payload lean
function slimQuestion(q: Question) {
  return {
    id: q.id,
    subject: q.subject,
    module: q.module ?? null,
    vignette: q.vignette,
    options: q.options,
    correctAnswer: q.correctAnswer,
  }
}

function generatePin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST /api/game-rooms — create a new room
export async function POST(req: Request) {
  try {
    await ensureSchema()
    const body = await req.json()
    const { mode, hostId, hostName, questionPool } = body as {
      mode: "clash" | "cohort" | "wager"
      hostId: string
      hostName: string
      questionPool: Question[]
    }

    if (!mode || !hostId || !hostName || !Array.isArray(questionPool) || questionPool.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    if (mode !== "clash" && mode !== "cohort" && mode !== "wager") {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 })
    }

    const slim = questionPool.map(slimQuestion)

    // Try up to 5 times to get a unique PIN
    let pin = ""
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generatePin()
      const exists = await pool.query("SELECT pin FROM mednexus_game_rooms WHERE pin = $1", [candidate])
      if (exists.rows.length === 0) { pin = candidate; break }
    }
    if (!pin) return NextResponse.json({ error: "Could not generate PIN" }, { status: 500 })

    const hostPlayer = {
      id: hostId, name: hostName, score: 0, streak: 0, answer: null, answeredAt: null, isHost: true,
      ...(mode === "wager" ? { balance: 1000, wagerAmount: null, isSpectator: false } : {}),
    }

    await pool.query(
      `INSERT INTO mednexus_game_rooms (pin, mode, host_id, host_name, question_pool, current_qi, phase, players)
       VALUES ($1, $2, $3, $4, $5, 0, 'lobby', $6)`,
      [pin, mode, hostId, hostName, JSON.stringify(slim), JSON.stringify([hostPlayer])]
    )

    return NextResponse.json({ pin })
  } catch (err) {
    console.error("[game-rooms POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
