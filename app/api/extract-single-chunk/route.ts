import { NextRequest, NextResponse } from "next/server"
import { generateWithFallback } from "@/lib/gemini"

// Each chunk call is a single focused Gemini request — keep duration generous
// but bounded so a stuck call doesn't block the client's progress loop.
export const maxDuration = 120

// ── System prompt generator ───────────────────────────────────────────────────
// Accepts the running context from the Relay Race orchestrator so that
// categorisation state is carried across chunk boundaries.

function buildSystemInstruction(
  fallbackModule: string | null,
  fallbackDiscipline: string | null,
): string {
  return `
You are a strict medical document extraction system. Extract every MCQ question from the raw text provided and return them as a JSON array.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL FORMATTING RULE — QUESTION TEXT CLEANING

You MUST strip all leading numbers, letters, and punctuation from the start
of every question's vignette text. Do NOT include prefixes such as:
  "1. "  "Q2: "  "(3)"  "Q1."  "4)"  "Question 5:"
Start directly with the first word of the actual question content.

WRONG:  "1. A 35-year-old woman presents with…"
RIGHT:  "A 35-year-old woman presents with…"

IMAGE PLACEHOLDERS — the text may contain markers like [IMAGE_1], [IMAGE_2], etc.
These mark where an embedded image appears in the source document.
CRITICAL: You MUST copy these markers VERBATIM into the vignette field of whichever
question they belong to. Do NOT remove, rewrite, or omit them — the system depends
on seeing the exact string [IMAGE_1] (with square brackets) in the vignette to attach
the actual image data. If you drop a marker, the image will be permanently lost.
Set mediaBase64 to null — the system will populate it automatically from the marker.

Example — if the raw text contains:
  [IMAGE_1]
  45. A 50-year-old man presents with the radiograph shown above. What is the diagnosis?
Then your vignette MUST include "[IMAGE_1]" like so:
  "[IMAGE_1] A 50-year-old man presents with the radiograph shown above. What is the diagnosis?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL CATEGORIZATION RULES — STRICT HIERARCHY (apply PER QUESTION)

MODULE assignment:
  Priority 1 (Explicit Tag): If the text contains a "MODULE: <name>" tag
    above this question, use exactly what is written.
  Priority 2 (Running Context): If no MODULE: tag is present, use the
    Running Module Context provided below.
  Priority 3 (Fallback): If no tag and no context, set module to "Uncategorized".

DISCIPLINE assignment — ZERO CREATIVITY RULE:
  Priority 1 (Explicit Tag): If a DISCIPLINE:/SUBJECT:/TOPIC: tag is active
    for this question, extract exactly what is written — do not alter a single
    character.
  Priority 2 (Running Context): If NO explicit tag is active for this question,
    you MUST use the Running Discipline Context provided below. Because documents
    are processed in sequential chunks, this running context carries the last
    known discipline tag forward from the previous chunk.
  Priority 3 (Empty String): If no tag exists and no running context is provided
    (value is EMPTY), set "discipline" to "" (empty string).

  You are STRICTLY FORBIDDEN from guessing, inferring, or inventing a discipline
  from the question's clinical content. ZERO CREATIVITY — if a discipline was not
  explicitly written in the source text or provided in the Running Context, return "".
  If you invent a discipline, the system will fail.

Running Module Context:     ${fallbackModule     ?? "EMPTY"}
Running Discipline Context: ${fallbackDiscipline ?? "EMPTY"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT

Return ONLY a valid JSON array — no markdown fences, no preamble, no trailing text.
Each element must follow this exact shape:

{
  "module":        string,
  "discipline":    string,
  "vignette":      string,
  "options":       [{"id":"A","text":"…"}, {"id":"B","text":"…"}, …],
  "correctAnswer": "A" | "B" | "C" | "D" | "E" | null,
  "explanation":   string | null,
  "mediaBase64":   string | null
}

mediaBase64: If the question refers to an image or diagram present in the source
document, extract that image and include it as a base64-encoded data URI string
(e.g. "data:image/png;base64,…"). If no image is present or extractable, set to null.

Rules:
• vignette must NOT start with a question number, letter prefix, or punctuation.
• Options must be labelled A–E only (uppercase single letter).
• correctAnswer is a single uppercase letter A–E matching the answer key,
  or null if no answer key is present.
• explanation: full explanation/rationale text if present; null otherwise.
• Parse EVERY question — do not skip, merge, or reorder any.
• Return an empty array [] if no parseable questions are found.
`.trim()
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface ChunkQuestion {
  module: string
  discipline: string
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string | null
  explanation: string | null
  mediaBase64?: string | null
}

interface ImageEntry {
  id: string       // e.g. "IMAGE_1"
  dataUri: string  // e.g. "data:image/png;base64,…"
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      textChunk?: string
      fallbackModule?: string | null
      fallbackDiscipline?: string | null
      images?: ImageEntry[]
    }

    const textChunk = (body.textChunk ?? "").trim()
    if (!textChunk) {
      return NextResponse.json({ questions: [] })
    }

    const fallbackModule     = (body.fallbackModule     ?? "").trim() || null
    const fallbackDiscipline = (body.fallbackDiscipline ?? "").trim() || null

    // Build a lookup map so reconciliation is O(1) per question.
    const imageMap = new Map<string, string>()
    for (const img of body.images ?? []) {
      if (img.id && img.dataUri) imageMap.set(img.id.toUpperCase(), img.dataUri)
    }

    const systemInstruction = buildSystemInstruction(fallbackModule, fallbackDiscipline)
    const prompt = `Text chunk:\n${textChunk}`

    const raw = await generateWithFallback(systemInstruction, prompt)

    if (!raw) {
      console.warn("[extract-single-chunk] Gemini returned nothing — returning []")
      return NextResponse.json({ questions: [] })
    }

    let questions: ChunkQuestion[]
    try {
      const parsed = JSON.parse(raw)
      questions = Array.isArray(parsed) ? parsed : (parsed?.questions ?? [])
    } catch {
      console.warn("[extract-single-chunk] JSON parse failed — returning []")
      return NextResponse.json({ questions: [] })
    }

    const VALID_ANSWER_IDS = new Set(["A", "B", "C", "D", "E"])

    // Sanitise and coerce every field before sending to the client.
    const valid = questions
      .filter(
        (q) =>
          typeof q.vignette === "string" &&
          q.vignette.trim() &&
          Array.isArray(q.options) &&
          q.options.length >= 2,
      )
      .map((q) => {
        // Coerce module using the same priority hierarchy as the system prompt:
        //   explicit tag from AI → request fallbackModule → "Uncategorized"
        // (discipline is kept independent — never used to fill module)
        const mod =
          typeof q.module === "string" && q.module.trim()
            ? q.module.trim()
            : fallbackModule ?? "Uncategorized"

        // Discipline priority (mirrors Relay Race contract):
        //   1. Non-empty value returned by AI (explicit tag in this chunk)
        //   2. Running discipline context passed in from the previous chunk
        //   3. "" — never infer from clinical content
        const disc =
          typeof q.discipline === "string" && q.discipline.trim()
            ? q.discipline.trim()
            : fallbackDiscipline ?? ""

        // Keep only valid A–E options with string text
        const options = (q.options as any[])
          .filter(
            (o) =>
              o &&
              typeof o.id === "string" &&
              VALID_ANSWER_IDS.has(o.id.toUpperCase().trim()) &&
              typeof o.text === "string" &&
              o.text.trim(),
          )
          .map((o) => ({ id: (o.id as string).toUpperCase().trim(), text: (o.text as string).trim() }))

        if (options.length < 2) return null // skip degenerate questions

        // Normalise correctAnswer to uppercase A–E or null
        let correctAnswer: string | null = null
        if (typeof q.correctAnswer === "string") {
          const ca = q.correctAnswer.toUpperCase().trim()
          if (VALID_ANSWER_IDS.has(ca)) correctAnswer = ca
        }

        // Server-side backstop: strip clear question-number prefixes that Gemini
        // sometimes returns despite the prompt instruction.
        //
        // Patterns matched (requires explicit punctuation or parens — not bare space):
        //   (3)        → parenthesized number
        //   Q2.  Q2:  Q2)  Q2 → letter Q + number + any separator
        //   Question 5. / Question 5: → word "Question" + number + separator
        //   1.  1)  1: → number + punctuation (. ) :) then whitespace
        //
        // NOT matched (safe):
        //   "2024 guidelines…"  — year/number followed only by space, no punctuation
        //   "35-year-old…"      — hyphen after number is not in the pattern
        const vignette = q.vignette
          .trim()
          .replace(
            /^(?:\(\d{1,4}\)\s*|Q\.?\s*\d{1,4}[.):\-\s]\s*|Question\s+\d{1,4}[.):\-\s]\s*|\d{1,4}[.):]\s+)/i,
            "",
          )
          .trim()

        if (!vignette) return null   // degenerate after strip

        // ── Image reconciliation ─────────────────────────────────────────────
        // Gemini preserves [IMAGE_N] markers in the vignette. Find the first
        // such marker, resolve it to a base64 data URI from the imageMap, set
        // mediaBase64, then strip ALL markers from the display text.
        let mediaBase64: string | null = null

        // First: check if Gemini already returned a real data URI (unlikely but possible)
        if (typeof q.mediaBase64 === "string" && q.mediaBase64.startsWith("data:")) {
          mediaBase64 = q.mediaBase64.trim()
        }

        // Then: scan vignette for [IMAGE_N] markers and resolve via imageMap
        if (!mediaBase64 && imageMap.size > 0) {
          const markerMatch = vignette.match(/\[IMAGE_(\d+)\]/i)
          if (markerMatch) {
            const key = `IMAGE_${markerMatch[1]}`.toUpperCase()
            mediaBase64 = imageMap.get(key) ?? null
          }
        }

        // Always strip [IMAGE_N] markers from the display vignette
        const cleanVignette = vignette.replace(/\[IMAGE_\d+\]\s*/gi, "").trim()
        if (!cleanVignette) return null

        return {
          module: mod,
          discipline: disc,
          vignette: cleanVignette,
          options,
          correctAnswer,
          explanation: typeof q.explanation === "string" && q.explanation.trim() ? q.explanation.trim() : null,
          mediaBase64,
        } satisfies ChunkQuestion
      })
      .filter(Boolean) as ChunkQuestion[]

    return NextResponse.json({ questions: valid })
  } catch (err) {
    console.error("[extract-single-chunk]", err)
    return NextResponse.json({ error: "Failed to process chunk" }, { status: 500 })
  }
}
