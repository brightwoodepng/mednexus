import { NextRequest, NextResponse } from "next/server"

export const maxDuration = 30

// POST /api/parse-pdf
// Body: { text: string, moduleName?: string }
// Returns: { questions: ParsedQuestion[] }

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

// ── Regex-based MCQ parser ────────────────────────────────────────────────────
// Handles common formats found in medical MCQ PDFs.

function cleanText(t: string): string {
  return t
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function parseQuestions(raw: string, defaultSubject: string): ParsedQuestion[] {
  const text = cleanText(raw)
  const results: ParsedQuestion[] = []

  // Split on question boundaries. Matches:
  //   1. / Q1. / Question 1 / Q1: / 1) at line start
  const qSplitter = /(?:^|\n)(?:Question\s+|Q\.?\s*)?(\d{1,3})[.):\s]/gm
  const boundaries: number[] = []
  let m: RegExpExecArray | null
  while ((m = qSplitter.exec(text)) !== null) {
    boundaries.push(m.index)
  }
  if (boundaries.length === 0) return results

  const blocks: string[] = []
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]
    const end = i + 1 < boundaries.length ? boundaries[i + 1] : text.length
    blocks.push(text.slice(start, end).trim())
  }

  for (const block of blocks) {
    const q = parseBlock(block, defaultSubject)
    if (q) results.push(q)
  }

  return results
}

function parseBlock(block: string, defaultSubject: string): ParsedQuestion | null {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) return null

  // Strip leading question number from first line
  const vignetteLines: string[] = []
  const optionLines: string[] = []
  let answerLine = ""
  let explanationLines: string[] = []
  let inExplanation = false
  let inOptions = false

  // Option patterns: A. / A) / (A) / A: / A -
  const optPattern = /^([A-Ea-e])[.):\-\s]\s+(.+)$/
  // Answer patterns
  const answerPattern = /^(?:answer|correct\s+answer|key|ans)[.:\s]*([A-Ea-e])/i
  // Explanation patterns
  const explPattern = /^(?:explanation|rationale|discussion|reason|solution|note)[.:\s]/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (inExplanation) {
      explanationLines.push(line)
      continue
    }

    // Check for answer line
    const ansMath = line.match(answerPattern)
    if (ansMath) {
      answerLine = ansMath[1].toUpperCase()
      inExplanation = false
      continue
    }

    // Check for explanation header
    if (explPattern.test(line)) {
      inExplanation = true
      // Include rest of line after the header word
      const rest = line.replace(explPattern, "").trim()
      if (rest) explanationLines.push(rest)
      continue
    }

    // Check for option
    const optMatch = line.match(optPattern)
    if (optMatch) {
      inOptions = true
      optionLines.push(line)
      continue
    }

    // Everything before options is vignette
    if (!inOptions) {
      // Strip leading question number
      const cleaned = line.replace(/^(?:Question\s+|Q\.?\s*)?\d{1,3}[.):\s]+/, "").trim()
      if (cleaned) vignetteLines.push(cleaned)
    }
  }

  if (vignetteLines.length === 0 || optionLines.length < 2) return null

  // Parse options
  const options: { id: string; text: string }[] = []
  for (const ol of optionLines) {
    const om = ol.match(optPattern)
    if (om) options.push({ id: om[1].toUpperCase(), text: om[2].trim() })
  }

  if (options.length < 2) return null

  // Determine correct answer — fallback to first option if not found
  const correctAnswer = answerLine || options[0].id

  // Build explanation
  const explText = explanationLines.join(" ").trim()

  // Try to split explanation into objective / details / incorrectReasoning
  let objective = ""
  let details = explText
  let incorrectReasoning = ""

  // If explanation mentions "incorrect" or distractor reasoning, split there
  const incorrectIdx = explText.search(/incorrect|distractor|wrong choice|other option/i)
  if (incorrectIdx > 50) {
    details = explText.slice(0, incorrectIdx).trim()
    incorrectReasoning = explText.slice(incorrectIdx).trim()
  }

  // Derive objective from vignette: first sentence or first 100 chars
  const vignetteText = vignetteLines.join(" ")
  const firstSentenceEnd = vignetteText.search(/[.?!]/)
  if (firstSentenceEnd > 20 && firstSentenceEnd < 150) {
    objective = vignetteText.slice(0, firstSentenceEnd + 1).trim()
  } else {
    objective = vignetteText.slice(0, Math.min(120, vignetteText.length)).trim()
  }

  return {
    subject: defaultSubject,
    vignette: vignetteText,
    options,
    correctAnswer,
    explanation: {
      objective: objective || "Clinical reasoning question.",
      details: details || "See explanation above.",
      incorrectReasoning: incorrectReasoning || "",
    },
  }
}

// ── OpenAI-enhanced parsing (used if key is available) ────────────────────────
async function parseWithAI(
  text: string,
  moduleName: string,
): Promise<ParsedQuestion[] | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 4096,
        messages: [
          {
            role: "system",
            content: `You are a medical education assistant. Extract all MCQ questions from the given text and return a JSON array.

Each question must match this TypeScript interface:
{
  subject: string,            // use the provided module name
  vignette: string,           // the full question stem / clinical vignette
  options: { id: string, text: string }[],  // A, B, C, D (and optionally E)
  correctAnswer: string,      // single letter: "A" | "B" | "C" | "D" | "E"
  explanation: {
    objective: string,        // 1 sentence: what concept is tested
    details: string,          // why the correct answer is correct
    incorrectReasoning: string // why the distractors are wrong
  }
}

Return ONLY a valid JSON array. No markdown, no code fences, no extra text.`,
          },
          {
            role: "user",
            content: `Module name: ${moduleName}\n\nText to parse:\n\n${text.slice(0, 12000)}`,
          },
        ],
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ""
    const parsed = JSON.parse(content)
    if (Array.isArray(parsed)) return parsed as ParsedQuestion[]
  } catch {
    return null
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const { text, moduleName = "Imported Module" } = await req.json()
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 })
    }

    // Try AI-enhanced parsing first (only if OPENAI_API_KEY is set)
    const aiResult = await parseWithAI(text, moduleName)
    if (aiResult && aiResult.length > 0) {
      return NextResponse.json({ questions: aiResult, source: "ai" })
    }

    // Fall back to regex parser
    const questions = parseQuestions(text, moduleName)
    return NextResponse.json({ questions, source: "regex" })
  } catch (err) {
    console.error("parse-pdf error:", err)
    return NextResponse.json({ error: "Parse failed" }, { status: 500 })
  }
}
