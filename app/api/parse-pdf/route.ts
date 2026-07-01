import { NextRequest, NextResponse } from "next/server"
import { getFlashModel } from "@/lib/gemini"

export const maxDuration = 45

interface ParsedQuestion {
  subject: string
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string
  explanation: {
    objective: string
    details: string
    incorrectReasoning: string
  }
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
function parseQuestions(raw: string, defaultSubject: string): ParsedQuestion[] {
  const text = cleanText(raw)
  const results: ParsedQuestion[] = []

  // Split on question boundaries: "1." / "1)" / "(1)" / "Q1." / "Q1)" / "Question 1"
  const qSplitter = /(?:^|\n)[ \t]*(?:Question\s+|Q\.?\s*)?(\d{1,3})[.):\s][ \t]*\S/gm
  const boundaries: number[] = []
  let m: RegExpExecArray | null
  while ((m = qSplitter.exec(text)) !== null) {
    boundaries.push(m.index === 0 ? 0 : m.index + 1)
  }
  if (boundaries.length === 0) return results

  for (let i = 0; i < boundaries.length; i++) {
    const block = text.slice(boundaries[i], i + 1 < boundaries.length ? boundaries[i + 1] : text.length).trim()
    const q = parseBlock(block, defaultSubject)
    if (q) results.push(q)
  }

  return results
}

function parseBlock(block: string, defaultSubject: string): ParsedQuestion | null {
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
      // Avoid duplicate IDs
      if (!options.find((o) => o.id === id)) options.push({ id, text })
      continue
    }

    // Option continuation: indented line after an option, no new pattern matched
    if (inOptions && options.length > 0 && !line.match(/^(?:Question\s+|Q\.?\s*)?\d{1,3}[.):\s]/)) {
      // Only append if not a new question boundary
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
    subject: defaultSubject,
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
  "subject":      string,  // discipline or topic from context; use the supplied moduleName if unknown
  "vignette":     string,  // full question stem — preserve all clinical detail
  "options":      [{ "id": "A", "text": "..." }, ...],  // A–E only, each id must be unique
  "correctAnswer": string | null,  // single uppercase letter matching an option id; null if not stated
  "explanation": {
    "objective":          string,  // ≤1 sentence: what concept is tested
    "details":            string,  // why the correct answer is right
    "incorrectReasoning": string   // why each distractor is wrong (may be "")
  } | null
}

Rules:
- Return ONLY the JSON object — no markdown fences, no preamble.
- If a question has no explanation, set explanation to null.
- If the correct answer is not stated and cannot be inferred, set correctAnswer to null.
- Preserve the complete clinical vignette — do not truncate.
- Ignore page headers, footers, and page numbers.
`.trim()

// Raw shape Gemini may return (nullable fields before normalisation)
interface GeminiParsedQuestion {
  subject?: string
  vignette?: string
  options?: { id: string; text: string }[]
  correctAnswer?: string | null
  explanation?: {
    objective: string
    details: string
    incorrectReasoning: string
  } | null
}

/**
 * Normalise a Gemini-returned question into the ParsedQuestion contract:
 * - correctAnswer: always a non-empty string (falls back to first option id or "A")
 * - explanation:   always a non-null object (falls back to empty strings)
 * Preserves the existing API contract so consumers are never broken.
 */
function normaliseQuestion(q: GeminiParsedQuestion, moduleName: string): ParsedQuestion | null {
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
    subject: q.subject?.trim() || moduleName,
    vignette,
    options,
    correctAnswer,
    explanation,
  }
}

async function parseWithAI(text: string, moduleName: string): Promise<ParsedQuestion[] | null> {
  if (!process.env.GEMINI_API_KEY) return null

  // Send up to 200 000 chars; if longer, take first 100 000 + last 100 000 so
  // we capture both early and late questions in very long documents.
  const excerpt =
    text.length > 200_000
      ? text.slice(0, 100_000) + "\n\n[...middle truncated...]\n\n" + text.slice(-100_000)
      : text

  try {
    const model = getFlashModel(PARSE_PDF_SYSTEM_INSTRUCTION)
    const result = await model.generateContent(
      `Module: ${moduleName}\n\nText:\n${excerpt}`,
    )
    // responseMimeType: "application/json" guarantees valid JSON — no fence stripping needed.
    const parsed = JSON.parse(result.response.text()) as
      | { questions?: GeminiParsedQuestion[] }
      | GeminiParsedQuestion[]

    const raw: GeminiParsedQuestion[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { questions?: GeminiParsedQuestion[] }).questions)
        ? (parsed as { questions: GeminiParsedQuestion[] }).questions
        : []

    const normalised = raw.map((q) => normaliseQuestion(q, moduleName)).filter(Boolean) as ParsedQuestion[]
    return normalised.length > 0 ? normalised : null
  } catch (err) {
    console.error("[parse-pdf AI] Gemini error:", err)
  }

  return null
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { text, moduleName = "Imported Module" } = await req.json()
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 })
    }

    const aiResult = await parseWithAI(text, moduleName)
    if (aiResult && aiResult.length > 0) {
      return NextResponse.json({ questions: aiResult, source: "ai" })
    }

    const questions = parseQuestions(text, moduleName)
    return NextResponse.json({ questions, source: "regex" })
  } catch (err) {
    console.error("[parse-pdf]", err)
    return NextResponse.json({ error: "Parse failed" }, { status: 500 })
  }
}
