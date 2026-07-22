import { NextRequest, NextResponse } from "next/server"
import { generateWithFallback } from "@/lib/gemini"
import { boundedJson, guardImportRequest, IMPORT_LIMITS } from "@/lib/import-guard"

export const maxDuration = 45

interface ParsedQuestion {
  module: string
  discipline: string  // explicit DISCIPLINE: tag only; "" if not tagged
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string
  explanation: {
    objective: string
    details: string
    incorrectReasoning: string
  }
  mediaBase64?: string | null
}

// ── Text cleaning ─────────────────────────────────────────────────────────────
function cleanText(t: string): string {
  return t
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/--- Page Break ---/gi, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
}

// ── Regex-based MCQ parser ────────────────────────────────────────────────────
/**
 * Regex-based MCQ parser with stateful MODULE:/DISCIPLINE: tag tracking.
 * Tag priority: explicit tag in text > fallbackModule > "Uncategorized" (module)
 *               explicit tag in text > ""                                (discipline)
 */
function parseQuestions(raw: string, fallbackModule: string): ParsedQuestion[] {
  const text = cleanText(raw)
  const results: ParsedQuestion[] = []

  const TAG_MODULE     = /^MODULE\s*[:.-]\s*(.+)/i
  const TAG_DISCIPLINE = /^(?:DISCIPLINE|SUBJECT|TOPIC)\s*[:.-]\s*(.+)/i

  // Split on question boundaries: "1." / "1)" / "(1)" / "Q1." / "Q1)" / "Question 1"
  const qSplitter = /(?:^|\n)[ \t]*(?:Question\s+|Q\.?\s*)?(\d{1,3})[.):\s][ \t]*\S/gm
  const boundaries: number[] = []
  let m: RegExpExecArray | null
  while ((m = qSplitter.exec(text)) !== null) {
    boundaries.push(m.index === 0 ? 0 : m.index + 1)
  }
  if (boundaries.length === 0) return results

  // Scan the full text before the first question boundary for initial tags
  let activeModule     = fallbackModule
  let activeDiscipline = ""

  const prefixLines = text.slice(0, boundaries[0]).split("\n")
  for (const line of prefixLines) {
    const modM = TAG_MODULE.exec(line.trim())
    if (modM) { activeModule = modM[1].trim(); continue }
    const discM = TAG_DISCIPLINE.exec(line.trim())
    if (discM) { activeDiscipline = discM[1].trim() }
  }

  for (let i = 0; i < boundaries.length; i++) {
    const blockStart = boundaries[i]
    const blockEnd   = i + 1 < boundaries.length ? boundaries[i + 1] : text.length
    const blockText  = text.slice(blockStart, blockEnd)

    // Scan this block for leading tag lines before the question stem
    const blockLines = blockText.split("\n")
    for (const line of blockLines) {
      const modM = TAG_MODULE.exec(line.trim())
      if (modM) { activeModule = modM[1].trim(); continue }
      const discM = TAG_DISCIPLINE.exec(line.trim())
      if (discM) { activeDiscipline = discM[1].trim() }
    }

    const q = parseBlock(blockText.trim(), activeModule, activeDiscipline)
    if (q) results.push(q)
  }

  return results
}

function parseBlock(block: string, activeModule: string, activeDiscipline: string): ParsedQuestion | null {
  const TAG_MODULE     = /^MODULE\s*[:.-]\s*(.+)/i
  const TAG_DISCIPLINE = /^(?:DISCIPLINE|SUBJECT|TOPIC)\s*[:.-]\s*(.+)/i

  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) return null

  const vignetteLines: string[] = []
  const options: { id: string; text: string }[] = []
  let answerLine = ""
  const explanationLines: string[] = []
  let inExplanation = false
  let inOptions = false

  // Option: A. / A) / (A) / A: / A -  followed by text
  const optPattern = /^(?:\(([A-Ea-e])\)|([A-Ea-e])[.):\-])[ \t]*(.+)$/
  // Answer line
  const answerPattern = /^(?:correct[\s_]?answer|answer|ans(?:wer)?|key)[\s.:—-]*([A-Ea-e])\b/i
  // Explanation header
  const explPattern = /^(?:explanation|rationale|discussion|reason|solution|note)[.:\s—-]/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (inExplanation) { explanationLines.push(line); continue }

    // Tag lines within a block update the active values for this block
    const modM = TAG_MODULE.exec(line)
    if (modM) { activeModule = modM[1].trim(); continue }
    const discM = TAG_DISCIPLINE.exec(line)
    if (discM) { activeDiscipline = discM[1].trim(); continue }

    const ansM = line.match(answerPattern)
    if (ansM) { answerLine = ansM[1].toUpperCase(); inExplanation = false; continue }

    if (explPattern.test(line)) {
      inExplanation = true
      const rest = line.replace(explPattern, "").trim()
      if (rest) explanationLines.push(rest)
      continue
    }

    const optM = line.match(optPattern)
    if (optM) {
      inOptions = true
      const id = (optM[1] ?? optM[2]).toUpperCase()
      const text = optM[3].trim()
      if (!options.find((o) => o.id === id)) options.push({ id, text })
      continue
    }

    // Option continuation: indented line after an option, no new pattern matched
    if (inOptions && options.length > 0 && !line.match(/^(?:Question\s+|Q\.?\s*)?\d{1,3}[.):\s]/)) {
      options[options.length - 1].text += " " + line
      continue
    }

    if (!inOptions) {
      const cleaned = line.replace(/^(?:Question\s+|Q\.?\s*)?\d{1,3}[.):\s]+/, "").trim()
      if (cleaned) vignetteLines.push(cleaned)
    }
  }

  if (vignetteLines.length === 0 || options.length < 2) return null

  const correctAnswer = answerLine || options[0].id
  const vignetteText = vignetteLines.join(" ").trim()
  const explText = explanationLines.join(" ").trim()

  let objective = ""
  let details = explText
  let incorrectReasoning = ""

  const incorrectIdx = explText.search(/\b(?:incorrect|distractor|wrong choice|other option|whereas)\b/i)
  if (incorrectIdx > 50) {
    details = explText.slice(0, incorrectIdx).trim()
    incorrectReasoning = explText.slice(incorrectIdx).trim()
  }

  const firstSentEnd = vignetteText.search(/[.?!]/)
  objective = firstSentEnd > 20 && firstSentEnd < 160
    ? vignetteText.slice(0, firstSentEnd + 1).trim()
    : vignetteText.slice(0, 120).trim()

  return {
    module: activeModule,
    discipline: activeDiscipline,  // explicit DISCIPLINE: tag only; "" if not tagged
    vignette: vignetteText,
    options,
    correctAnswer,
    explanation: {
      objective: objective || "Clinical reasoning question.",
      details: details || "See explanation.",
      incorrectReasoning,
    },
  }
}

// ── Gemini-enhanced parsing ───────────────────────────────────────────────────
const PARSE_PDF_SYSTEM_INSTRUCTION = `
You are a medical education data extractor. Parse all MCQ questions from the
supplied text and return a JSON object with a single key "questions" whose
value is an array.

Each element must exactly match:
{
  "module":        string,        // see MODULE rules below
  "discipline":    string,        // see DISCIPLINE rules below — may be ""
  "vignette":      string,        // full question stem — preserve all clinical detail
  "options":       [{ "id": "A", "text": "..." }, ...],  // A–E only, each id must be unique
  "correctAnswer": string | null, // single uppercase letter matching an option id; null if not stated
  "explanation": {
    "objective":          string,  // ≤1 sentence: what concept is tested
    "details":            string,  // why the correct answer is right
    "incorrectReasoning": string   // why each distractor is wrong (may be "")
  } | null,
  "mediaBase64": string | null    // base64 data URI of an embedded image/diagram if present, else null
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CATEGORIZATION RULES — apply per question in this exact order:

MODULE (field: "module"):
  Priority 1: If the text contains a line MODULE: [Name] above this question
    (before any subsequent MODULE: line), extract exactly what is written — do
    not alter a single character.
  Priority 2: If no MODULE: tag precedes this question, use the fallbackModule
    value provided in the input prompt.
  Priority 3: If no MODULE: tag exists AND fallbackModule is null or empty,
    set "module" to "Uncategorized".

DISCIPLINE (field: "discipline") — STRICT ANTI-HALLUCINATION RULE:
  Priority 1: If the text contains a line DISCIPLINE: [Name] or SUBJECT: [Name]
    or TOPIC: [Name] above this question (before any subsequent tag of that
    kind), extract exactly what is written — do not alter a single character.
  Priority 2: If NO such tag precedes this question, set "discipline" to ""
    (empty string). You are STRICTLY FORBIDDEN from guessing, inferring, or
    inventing a discipline from the question's clinical content. Zero creativity —
    if it was not explicitly written in the source text with a tag, return "".

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rules:
- Return ONLY the JSON object — no markdown fences, no preamble.
- If a question has no explanation, set explanation to null.
- If the correct answer is not stated and cannot be inferred, set correctAnswer to null.
- Preserve the complete clinical vignette — do not truncate.
- Ignore page headers, footers, and page numbers.
`.trim()

// Raw shape Gemini may return (nullable fields before normalisation)
interface GeminiParsedQuestion {
  module?: string
  discipline?: string
  vignette?: string
  options?: { id: string; text: string }[]
  correctAnswer?: string | null
  explanation?: {
    objective: string
    details: string
    incorrectReasoning: string
  } | null
  mediaBase64?: string | null
}

/**
 * Normalise a Gemini-returned question into the ParsedQuestion contract:
 * - module:        explicit MODULE: tag → fallbackModule → "Uncategorized"
 * - discipline:    explicit DISCIPLINE:/SUBJECT:/TOPIC: tag only → "" if absent (no inference)
 * - correctAnswer: always a non-empty string (falls back to first option id or "A")
 * - explanation:   always a non-null object (falls back to empty strings)
 */
function normaliseQuestion(
  q: GeminiParsedQuestion,
  fallbackModule: string,
): ParsedQuestion | null {
  const vignette = q.vignette?.trim()
  const options = q.options?.filter(
    (o) => typeof o.id === "string" && /^[A-E]$/i.test(o.id) && typeof o.text === "string",
  )
  if (!vignette || !options || options.length < 2) return null

  const correctAnswer =
    typeof q.correctAnswer === "string" && q.correctAnswer.trim()
      ? q.correctAnswer.trim().toUpperCase()
      : options[0].id

  const explanation = q.explanation ?? { objective: "", details: "", incorrectReasoning: "" }

  return {
    module: q.module?.trim() || fallbackModule,
    // discipline: only what was explicitly tagged — never inferred from clinical content
    discipline: q.discipline?.trim() ?? "",
    vignette,
    options,
    correctAnswer,
    explanation,
    mediaBase64: typeof q.mediaBase64 === "string" && q.mediaBase64.trim() ? q.mediaBase64.trim() : null,
  }
}

// ── Text chunking ─────────────────────────────────────────────────────────────

/**
 * Split plain text into chunks of ~targetWords words.
 * Breaks are taken at question-number boundaries so no question is split
 * across two chunks (a chunk may exceed the target slightly to honour this).
 */
function chunkText(text: string, targetWords = 2500): string[] {
  // Matches the same question-start formats the fallback parser recognises:
  //   "1."  "1)"  "1:"  "Q1."  "Question 1."  "(1)"  and up to 4-digit numbers
  const Q_BOUNDARY = /^(?:(?:Question\s+|Q\.?\s*)?\d{1,4}[.):\s]|\(\d{1,4}\))/i
  const lines = text.split("\n")
  const chunks: string[] = []
  let current: string[] = []
  let wordCount = 0

  for (const line of lines) {
    const lineWords = line.trim().split(/\s+/).filter(Boolean).length
    // Flush the current chunk at a question boundary once the target is reached
    if (wordCount >= targetWords && Q_BOUNDARY.test(line.trim()) && current.length > 0) {
      chunks.push(current.join("\n"))
      current = []
      wordCount = 0
    }
    current.push(line)
    wordCount += lineWords
  }
  if (current.length > 0) chunks.push(current.join("\n"))
  return chunks.filter((c) => c.trim())
}

/** Send a single text chunk to the AI and return normalised questions (never throws). */
async function parseChunkWithAI(
  chunk: string,
  fallbackModule: string,
  chunkIndex: number,
): Promise<ParsedQuestion[]> {
  try {
    const responseText = await generateWithFallback(
      PARSE_PDF_SYSTEM_INSTRUCTION,
      `fallbackModule: ${fallbackModule}\n\nText:\n${chunk}`,
    )
    if (!responseText) return []

    const parsed = JSON.parse(responseText) as
      | { questions?: GeminiParsedQuestion[] }
      | GeminiParsedQuestion[]

    const raw: GeminiParsedQuestion[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { questions?: GeminiParsedQuestion[] }).questions)
        ? (parsed as { questions: GeminiParsedQuestion[] }).questions
        : []

    const normalised = raw.map((q) => normaliseQuestion(q, fallbackModule)).filter(Boolean) as ParsedQuestion[]
    console.log(`[parse-pdf] Chunk ${chunkIndex}: ${normalised.length} question(s) extracted`)
    return normalised
  } catch (err) {
    // Log and skip — one bad chunk must not abort the whole upload
    console.error(`[parse-pdf] Chunk ${chunkIndex} failed — skipping:`, err)
    return []
  }
}

async function parseWithAI(text: string, fallbackModule: string): Promise<ParsedQuestion[] | null> {
  if (!process.env.GEMINI_API_KEY) return null

  const chunks = chunkText(text)
  if (chunks.length > IMPORT_LIMITS.chunksPerImport) throw new Error("Import contains too many chunks")
  console.log(`[parse-pdf] ${chunks.length} chunk(s) to process sequentially`)

  const master: ParsedQuestion[] = []
  for (let i = 0; i < chunks.length; i++) {
    const questions = await parseChunkWithAI(chunks[i], fallbackModule, i + 1)
    master.push(...questions)
  }

  console.log(`[parse-pdf] Total questions extracted: ${master.length}`)
  return master.length > 0 ? master : null
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const guarded = await guardImportRequest(req, "parse-pdf")
    if ("response" in guarded) return guarded.response
    const body = await req.json()
    if (!body.text || typeof body.text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 })
    }
    const text: string = body.text
    if (text.length > IMPORT_LIMITS.textChars) return NextResponse.json({ error: "Text exceeds the allowed import size.", code: "PAYLOAD_TOO_LARGE" }, { status: 413 })
    // Accept fallbackModule (new) or moduleName (legacy) — null/empty → "Uncategorized"
    const fallbackModule: string =
      (body.fallbackModule ?? body.moduleName ?? "").trim() || "Uncategorized"

    const aiResult = await parseWithAI(text, fallbackModule)
    if (aiResult && aiResult.length > 0) {
      return boundedJson({ questions: aiResult, source: "ai" })
    }

    const questions = parseQuestions(text, fallbackModule)
    return boundedJson({ questions, source: "regex" })
  } catch (err) {
    console.error("[parse-pdf]", err)
    const message = err instanceof Error && err.message === "Import contains too many chunks"
      ? "Import contains too many chunks." : "The AI provider failed to process this document."
    return NextResponse.json({ error: message, code: err instanceof Error && err.message === "Import contains too many chunks" ? "PAYLOAD_TOO_LARGE" : "PROVIDER_FAILURE" }, { status: err instanceof Error && err.message === "Import contains too many chunks" ? 413 : 502 })
  }
}
