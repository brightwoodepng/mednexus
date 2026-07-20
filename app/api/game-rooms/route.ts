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
    explanation: q.explanation ?? null,
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
    const { mode, hostId, hostName, questionPool, equippedTitle, equippedFrame, equippedHighlight, equippedAvatar } = body as {
      mode: "clash" | "cohort" | "wager" | "djmulti"
      hostId: string
      hostName: string
      questionPool: Question[]
      equippedTitle?: string | null
      equippedFrame?: string | null
      equippedHighlight?: string | null
      equippedAvatar?: string | null
    }

    if (!mode || !hostId || !hostName || !Array.isArray(questionPool) || questionPool.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const VALID_MODES = ["clash", "cohort", "wager", "djmulti"]
    if (!VALID_MODES.includes(mode)) {
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

    // djmulti starts players with a 500-chip bank (Double Jeopardy mechanics)
    const isWagerLike = mode === "wager" || mode === "djmulti"
    const startingBalance = mode === "wager" ? 1000 : mode === "djmulti" ? 500 : undefined

    const hostPlayer = {
      id: hostId, name: hostName, score: 0, streak: 0, answer: null, answeredAt: null, isHost: true,
      ...(isWagerLike ? { balance: startingBalance, wagerAmount: null, isSpectator: false } : {}),
      equippedTitle:     equippedTitle     ?? null,
      equippedFrame:     equippedFrame     ?? null,
      equippedHighlight: equippedHighlight ?? null,
      equippedAvatar:    equippedAvatar    ?? null,
    }

    await pool.query(
      `INSERT INTO mednexus_game_rooms (pin, mode, host_id, host_name, question_pool, current_qi, phase, players, phase_started_at)
       VALUES ($1, $2, $3, $4, $5, 0, 'lobby', $6, NOW())`,
      [pin, mode, hostId, hostName, JSON.stringify(slim), JSON.stringify([hostPlayer])]
    )

    return NextResponse.json({ pin })
  } catch (err) {
    console.error("[game-rooms POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
