import { NextRequest, NextResponse } from "next/server"
import { geminiAvailable, transcribeTheoryAudioWithGemini } from "@/lib/gemini"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import {
  consumeTheoryAiQuota,
  detectAudioDurationSeconds,
  hasCurrentTheoryAiConsent,
  hasValidAudioSignature,
  logTheoryAiAction,
  normalizeAudioMime,
  parseDeclaredDuration,
  THEORY_AI_MAX_AUDIO_BYTES,
  THEORY_AI_MAX_AUDIO_SECONDS,
  type TheoryAiAuditAction,
} from "@/lib/theory-ai"
import { theoryDatabaseAvailable, theoryPool, withTransaction } from "@/lib/theory-server"

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
  let auditAction: TheoryAiAuditAction = "transcribe_note"

  try {
    if (!geminiAvailable()) {
      outcome = "provider_unavailable"
      return NextResponse.json({ error: "AI dictation is not configured right now." }, { status: 503 })
    }
    if (!await hasCurrentTheoryAiConsent(pool, auth.uid)) {
      outcome = "consent_required"
      return NextResponse.json({ error: "Please accept the AI privacy notice first." }, { status: 412 })
    }

    const form = await request.formData()
    const questionId = typeof form.get("questionId") === "string" ? String(form.get("questionId")) : ""
    const target = form.get("target")
    const audio = form.get("audio")
    const durationSeconds = parseDeclaredDuration(form.get("durationSeconds"))
    if (target !== "note" && target !== "answer") {
      outcome = "invalid_target"
      return NextResponse.json({ error: "A valid dictation target is required." }, { status: 400 })
    }
    auditAction = target === "answer" ? "transcribe_answer" : "transcribe_note"
    if (!questionId || !(audio instanceof File) || !durationSeconds) {
      outcome = "invalid_request"
      return NextResponse.json({ error: "A valid audio recording and duration are required." }, { status: 400 })
    }
    if (audio.size <= 0 || audio.size > THEORY_AI_MAX_AUDIO_BYTES) {
      outcome = "invalid_size"
      return NextResponse.json({ error: "Recordings must be no larger than 8 MB." }, { status: 413 })
    }
    const mimeType = normalizeAudioMime(audio.type)
    if (!mimeType) {
      outcome = "invalid_mime"
      return NextResponse.json({ error: "This audio format is not supported." }, { status: 415 })
    }
    const bytes = new Uint8Array(await audio.arrayBuffer())
    if (!hasValidAudioSignature(bytes, mimeType)) {
      outcome = "invalid_signature"
      return NextResponse.json({ error: "The recording is corrupt or its format does not match." }, { status: 400 })
    }
    const containerDuration = detectAudioDurationSeconds(bytes, mimeType)
    if (containerDuration != null && containerDuration > THEORY_AI_MAX_AUDIO_SECONDS) {
      outcome = "duration_exceeded"
      return NextResponse.json({ error: "Recordings cannot be longer than five minutes." }, { status: 413 })
    }

    const question = await pool.query(
      "SELECT 1 FROM mednexus_theory_questions WHERE id=$1 AND status='published'",
      [questionId],
    )
    if (!question.rows.length) {
      outcome = "question_not_found"
      return NextResponse.json({ error: "Question not found." }, { status: 404 })
    }

    const remaining = await withTransaction(pool, client => consumeTheoryAiQuota(client, auth.uid, "transcription"))
    if (remaining == null) {
      outcome = "quota_exceeded"
      return NextResponse.json({ error: "You have used all 50 transcriptions for today." }, { status: 429 })
    }
    quotaUsed = 1

    const result = await transcribeTheoryAudioWithGemini({ bytes, mimeType, target })
    if (!result) {
      outcome = "provider_failure"
      return NextResponse.json({ error: "Gemini could not transcribe this recording. Please try again." }, { status: 502 })
    }
    const verifiedDuration = Math.ceil(Math.max(containerDuration ?? 0, result.durationSeconds ?? 0, durationSeconds))
    if (verifiedDuration > THEORY_AI_MAX_AUDIO_SECONDS) {
      outcome = "duration_exceeded"
      return NextResponse.json({ error: "Recordings cannot be longer than five minutes." }, { status: 413 })
    }

    outcome = "success"
    return NextResponse.json({ text: result.text, durationSeconds: verifiedDuration, remaining })
  } catch (error) {
    outcome = "server_error"
    console.error("[theory ai transcribe]", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Unable to transcribe this recording." }, { status: 500 })
  } finally {
    await logTheoryAiAction(pool, auth.uid, auditAction, outcome, Date.now() - startedAt, quotaUsed)
      .catch(error => console.error("[theory ai audit]", error instanceof Error ? error.name : "UnknownError"))
  }
}
