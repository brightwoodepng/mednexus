import { NextRequest, NextResponse } from "next/server"
import { geminiAvailable, refineTheoryNoteWithGemini } from "@/lib/gemini"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import {
  consumeTheoryAiQuota,
  hasCurrentTheoryAiConsent,
  logTheoryAiAction,
} from "@/lib/theory-ai"
import { optionalText, theoryDatabaseAvailable, theoryPool, withTransaction } from "@/lib/theory-server"

export async function POST(request: NextRequest) {
  const startedAt = Date.now()
  if (!theoryDatabaseAvailable()) {
    return NextResponse.json({ error: "Theory Vault database is not configured." }, { status: 503 })
  }
  const auth = await requireRegisteredUser(request)
  if (!auth) return unauthorized()
  const pool = await theoryPool()
  let quotaUsed = 0
  let outcome = "failed"

  try {
    if (!geminiAvailable()) {
      outcome = "provider_unavailable"
      return NextResponse.json({ error: "AI study tools are not configured right now." }, { status: 503 })
    }
    if (!await hasCurrentTheoryAiConsent(pool, auth.uid)) {
      outcome = "consent_required"
      return NextResponse.json({ error: "Please accept the AI privacy notice first." }, { status: 412 })
    }

    const body = await request.json() as Record<string, unknown>
    const questionId = typeof body.questionId === "string" ? body.questionId : ""
    const note = optionalText(body.note, 20_000).trim()
    if (!questionId || !note) {
      outcome = "invalid_request"
      return NextResponse.json({ error: "A question and non-empty note are required." }, { status: 400 })
    }

    const questionResult = await pool.query(
      `SELECT title, prompt FROM mednexus_theory_questions
       WHERE id=$1 AND status='published'`,
      [questionId],
    )
    const question = questionResult.rows[0]
    if (!question) {
      outcome = "question_not_found"
      return NextResponse.json({ error: "Question not found." }, { status: 404 })
    }

    const remaining = await withTransaction(pool, client => consumeTheoryAiQuota(client, auth.uid, "refinement"))
    if (remaining == null) {
      outcome = "quota_exceeded"
      return NextResponse.json({ error: "You have used all 50 note refinements for today." }, { status: 429 })
    }
    quotaUsed = 1

    const refinedNote = await refineTheoryNoteWithGemini({
      title: String(question.title ?? ""),
      prompt: String(question.prompt),
      note,
    })
    if (!refinedNote) {
      outcome = "provider_failure"
      return NextResponse.json({ error: "Gemini could not refine this note. Your original note is unchanged." }, { status: 502 })
    }

    outcome = "success"
    return NextResponse.json({ refinedNote, remaining })
  } catch (error) {
    outcome = "server_error"
    console.error("[theory ai refine]", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Unable to refine this note. Your original note is unchanged." }, { status: 500 })
  } finally {
    await logTheoryAiAction(pool, auth.uid, "refine_note", outcome, Date.now() - startedAt, quotaUsed)
      .catch(error => console.error("[theory ai audit]", error instanceof Error ? error.name : "UnknownError"))
  }
}
