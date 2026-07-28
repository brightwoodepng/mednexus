import { NextResponse } from "next/server"
import pool from "@/lib/db"
import type { Question } from "@/lib/types"
import { requireAuthenticatedUser } from "@/lib/request-auth"
import { getQuestionBankStatus } from "@/lib/question-bank-server"
import { createQuestionContentFingerprint, isSupportedSoloQuestion } from "@/lib/game-question-pool"
import { getAuthoritativeCosmetics, roomError } from "@/lib/multiplayer-server"

const VALID_MODES = new Set(["clash", "cohort", "wager", "djmulti"])
const fail = (code: string, message: string, status: number) => NextResponse.json(roomError(code, message, status), { status })

function snapshot(q: Question) {
  const correctAnswer = Array.isArray(q.correctAnswer) ? q.correctAnswer[0] : q.correctAnswer
  return { id: q.id, subject: q.subject, discipline: q.subject, module: q.module ?? null, vignette: q.vignette,
    options: q.options, correctAnswer, explanation: q.explanation ?? null }
}

function generatePin() { return Math.floor(100000 + Math.random() * 900000).toString() }

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticatedUser(req)
    if (!auth) return fail("AUTHENTICATION_REQUIRED", "Authentication required", 401)
    const body = await req.json() as { mode?: string; hostName?: string; questionIds?: unknown; hostId?: unknown }
    if (typeof body.hostId === "string" && body.hostId !== auth.uid) return fail("IDENTITY_MISMATCH", "Authenticated identity does not match hostId", 403)
    if (!body.mode || !VALID_MODES.has(body.mode) || typeof body.hostName !== "string" || !body.hostName.trim()) {
      return fail("INVALID_REQUEST", "Mode and host name are required", 400)
    }
    if (!Array.isArray(body.questionIds) || body.questionIds.length === 0) return fail("NO_ELIGIBLE_QUESTIONS", "No eligible questions selected", 422)
    if (body.questionIds.length > 200 || body.questionIds.some(id => typeof id !== "string" || !id)) {
      return fail("INVALID_QUESTION_SELECTION", "Question selection must contain 1 to 200 valid IDs", 400)
    }
    const ids = body.questionIds as string[]
    if (new Set(ids).size !== ids.length) return fail("INVALID_QUESTION_SELECTION", "Question selection contains duplicate IDs", 400)

    const bank = (await getQuestionBankStatus()).questions as Question[]
    const byId = new Map(bank.map(question => [question.id, question]))
    const selected = ids.map(id => byId.get(id))
    if (selected.some(question => !question || !isSupportedSoloQuestion(question))) {
      return fail("INVALID_QUESTION_SELECTION", "One or more questions are missing or ineligible", 422)
    }
    const fingerprints = selected.map(question => createQuestionContentFingerprint(question!))
    if (new Set(fingerprints).size !== fingerprints.length) return fail("INVALID_QUESTION_SELECTION", "Question selection contains duplicate content", 422)
    const questions = selected.map(question => snapshot(question!))
    if (!questions.length) return fail("NO_ELIGIBLE_QUESTIONS", "No eligible questions selected", 422)

    let pin = ""
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = generatePin()
      if (!(await pool.query("SELECT pin FROM mednexus_game_rooms WHERE pin = $1", [candidate])).rows.length) { pin = candidate; break }
    }
    if (!pin) return fail("PIN_UNAVAILABLE", "Could not generate a room PIN", 503)

    const cosmetics = await getAuthoritativeCosmetics(auth)
    const isWagerLike = body.mode === "wager" || body.mode === "djmulti"
    const startingBalance = body.mode === "wager" ? 1000 : body.mode === "djmulti" ? 500 : undefined
    const host = { id: auth.uid, name: body.hostName.trim().slice(0, 24), score: 0, streak: 0, answer: null,
      answeredAt: null, isHost: true, status: "active", ...(isWagerLike ? { balance: startingBalance, wagerAmount: null, isSpectator: false } : {}), ...cosmetics }
    await pool.query(
      `INSERT INTO mednexus_game_rooms (pin, mode, host_id, host_name, question_pool, current_qi, phase, players, phase_started_at)
       VALUES ($1, $2, $3, $4, $5, 0, 'lobby', $6, NOW())`,
      [pin, body.mode, auth.uid, host.name, JSON.stringify(questions), JSON.stringify([host])],
    )
    return NextResponse.json({ pin, playerId: auth.uid }, { status: 201 })
  } catch (error) {
    console.error("[game-rooms POST]", error)
    return fail("SERVER_ERROR", "Unable to create room", 500)
  }
}
