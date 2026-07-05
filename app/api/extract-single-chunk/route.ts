import { NextRequest, NextResponse } from "next/server"
import { generateWithFallback } from "@/lib/gemini"

// Each chunk call is a single focused Gemini request — keep duration generous
// but bounded so a stuck call doesn't block the client's progress loop.
export const maxDuration = 120

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `
You are a medical exam question extractor. Parse every MCQ question from the raw text provided and return them as a JSON array.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORIZATION HIERARCHY — apply PER QUESTION in this exact order:

Priority 1 — EXPLICIT TAGS IMMEDIATELY BEFORE THE QUESTION (or its group)
  Scan backwards from each question to find the nearest tag line:
    MODULE: <name>
    DISCIPLINE: <name>   (or SUBJECT: / TOPIC:)
  If a tag appears anywhere above this question (before the next previous
  question), use those exact names. A new tag resets the active value for
  all questions that follow it — so different groups in the same chunk CAN
  have different module/discipline values.

Priority 2 — FALLBACK MODULE (per-question)
  If no MODULE: tag precedes this specific question, use the
  "fallbackModule" value from the user prompt for "module".

Priority 3 — UNCATEGORIZED (per-question)
  If no tag precedes this question AND fallbackModule is null or empty,
  set module to "Uncategorized".

For "discipline" (applied per question):
  Detect the specific clinical discipline from each question's own content
  (e.g. Cardiology, Pharmacology, Nephrology, Neurology, Surgery…).
  If a DISCIPLINE:/SUBJECT:/TOPIC: tag is active for this question, use that
  exact value. Only copy the module name into discipline if there is genuinely
  no clinical clue at all.

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
  "explanation":   string | null
}

Rules:
• Options must be labelled A–E only (uppercase single letter).
• correctAnswer is a single uppercase letter A–E matching the answer key,
  or null if no answer key is present.
• explanation: full explanation/rationale text if present; null otherwise.
• Parse EVERY question — do not skip, merge, or reorder any.
• Return an empty array [] if no parseable questions are found.
`.trim()

// ── Route handler ─────────────────────────────────────────────────────────────

interface ChunkQuestion {
  module: string
  discipline: string
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string | null
  explanation: string | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { textChunk?: string; fallbackModule?: string | null }

    const textChunk = (body.textChunk ?? "").trim()
    if (!textChunk) {
      return NextResponse.json({ questions: [] })
    }

    const fallbackModule = body.fallbackModule?.trim() || null

    const prompt = `fallbackModule: ${fallbackModule ?? "null"}\n\nText chunk:\n${textChunk}`

    const raw = await generateWithFallback(SYSTEM_INSTRUCTION, prompt)

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

        // Discipline: explicit AI value → fallback to module as last resort
        const disc =
          typeof q.discipline === "string" && q.discipline.trim()
            ? q.discipline.trim()
            : mod

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

        return {
          module: mod,
          discipline: disc,
          vignette: q.vignette.trim(),
          options,
          correctAnswer,
          explanation: typeof q.explanation === "string" && q.explanation.trim() ? q.explanation.trim() : null,
        } satisfies ChunkQuestion
      })
      .filter(Boolean) as ChunkQuestion[]

    return NextResponse.json({ questions: valid })
  } catch (err) {
    console.error("[extract-single-chunk]", err)
    return NextResponse.json({ error: "Failed to process chunk" }, { status: 500 })
  }
}
