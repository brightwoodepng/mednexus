import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { QuestionContextType, QuestionType } from "@/lib/types"

export const maxDuration = 60

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE PLACEHOLDER SYSTEM
// ───────────────────────────────────────────────────────────────────────────────
// Mammoth embeds a short token (__IMG_1__, __IMG_2__, …) in the HTML instead of
// raw base64.  This keeps the HTML sent to Gemini small.  After Gemini returns
// we swap tokens back to data URIs via the restore functions below.
// ═══════════════════════════════════════════════════════════════════════════════

interface ImageMap {
  [placeholder: string]: string // "__IMG_N__" → "data:<mime>;base64,<b64>"
}

async function convertDocxToHtml(
  arrayBuffer: ArrayBuffer,
): Promise<{ html: string; images: ImageMap }> {
  const images: ImageMap = {}
  let imgCounter = 0

  const result = await mammoth.convertToHtml(
    { buffer: Buffer.from(arrayBuffer) },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        imgCounter += 1
        const placeholder = `__IMG_${imgCounter}__`
        const buffer = Buffer.from(await image.read())
        const mime = image.contentType ?? "image/png"
        images[placeholder] = `data:${mime};base64,${buffer.toString("base64")}`
        return { src: placeholder, alt: `[image ${imgCounter}]` }
      }),
    },
  )

  const warnings = result.messages.filter((m) => m.type === "warning")
  if (warnings.length > 0) {
    console.warn("[parse-docx] mammoth warnings:", warnings.map((m) => m.message))
  }

  return { html: result.value, images }
}

// ── Restore functions (two variants — see comment below) ──────────────────────
//
// restoreImageSrcs  → Gemini output keeps <img src="__IMG_N__"> intact; we
//                     only need to replace the token inside the src attribute.
//
// restoreImageTokens → Fallback plain-text output has bare __IMG_N__ tokens;
//                      we wrap them in a full <img> element.
//
function restoreImageSrcs(text: string, images: ImageMap): string {
  return text.replace(/src="(__IMG_\d+__)"/g, (_, token) => {
    const uri = images[token]
    return uri ? `src="${uri}"` : `src="${token}"`
  })
}

function restoreImageTokens(text: string, images: ImageMap): string {
  return text.replace(/__IMG_\d+__/g, (token) => {
    const uri = images[token]
    return uri ? `<img src="${uri}" alt="embedded image">` : token
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// BLOCK-BASED HTML PARSER  (server-side fallback when Gemini is unavailable)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Handles all 9 question formats found in medical/exam Word documents:
//   1. Standalone MCQ
//   2. Questions sharing a common instruction / stem
//   3. Passage-based (dialogue, text extract)
//   4. Data interpretation (table + questions)
//   5. Table-based (explicit table)
//   6. Image / diagram questions
//   7. Clinical vignette (case-based)
//   8. Matching (match column A ↔ B)
//   9. Assertion-Reason (A: assertion; R: reason; standard 5 options)

type Block =
  | { kind: "table"; html: string }
  | { kind: "image"; token: string }
  | { kind: "text";  text: string }

/** Split mammoth HTML into a flat list of typed blocks. */
function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = []

  // Extract <table>…</table> regions first so they stay intact as a unit.
  const tableRe = /<table[\s\S]*?<\/table>/gi
  let cursor = 0, m: RegExpExecArray | null

  while ((m = tableRe.exec(html)) !== null) {
    processTextHtml(html.slice(cursor, m.index), blocks)
    // Preserve simple inline styles from mammoth (border, width) but strip scripts
    const safeTable = m[0].replace(/<script[\s\S]*?<\/script>/gi, "")
    blocks.push({ kind: "table", html: safeTable })
    cursor = m.index + m[0].length
  }
  processTextHtml(html.slice(cursor), blocks)

  return blocks
}

function processTextHtml(html: string, out: Block[]) {
  const text = html
    .replace(/<img[^>]*src="(__IMG_\d+__)"[^>]*>/gi, "\n$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|li|h[1-6]|div|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    if (/^__IMG_\d+__$/.test(line)) {
      out.push({ kind: "image", token: line })
    } else {
      out.push({ kind: "text", text: line })
    }
  }
}

// ── Regex vocabulary ──────────────────────────────────────────────────────────

/** "1.", "Q1.", "Question 1." followed by the question stem */
const Q_START = /^(?:Question\s+|Q\.?\s*)?(\d{1,4})[.):\s]+(.+)/i

/** "A.", "A)", "(A)" option */
const OPTION = /^(?:\(([A-Ea-e])\)|([A-Ea-e])[.):\-])[ \t]*(.+)$/

/** Answer key line */
const ANS_KEY = /^(?:correct[\s_]?answer|answer|ans(?:wer)?|key)[\s.:—-]*([A-Ea-e])\b/i

/** Explanation / rationale start */
const EXPL_START = /^(?:explanation|rationale|discussion|reason|solution)[.:\s—-]/i

/**
 * Context trigger — lines that introduce shared material for a group of
 * questions: "For questions 1-5", "Read the following passage", etc.
 *
 * Note: JS regex does not support /x (free-spacing) mode — patterns are
 * joined via new RegExp() with explicit alternation.
 */
const CTX_TRIGGER = new RegExp(
  [
    // "For questions 1–5" / "Questions 1 to 5"
    "(?:for\\s+)?questions?\\s+\\d+\\s*(?:to|[-\u2013\u2014])\\s*\\d+",
    // "Questions 1-5 refer to / are based on…"
    "questions?\\s+\\d+[\\s\\-\u2013\u2014]+\\d+\\s+(?:refer|are\\s+based)",
    // "Read / study / refer to the following"
    "(?:read|refer|study|examine|answer|based\\s+on)\\s+(?:the\\s+)?(?:following|below)",
    // "The following passage / table / figure…"
    "(?:following|below)\\s+(?:passage|dialogue|text|extract|scenario|case|table|figure|data|graph|image|diagram|vignette|information)",
    // "Passage / table below / follows"
    "(?:passage|dialogue|extract|vignette|scenario|table|figure)\\s+(?:below|follows|following)",
  ].join("|"),
  "i",
)

/**
 * Assertion-Reason option text patterns (matches any one of the standard
 * 5 A/R options).  Used to auto-detect A/R questions.
 */
const AR_OPT = new RegExp(
  [
    "both.*(?:assertion|a).*(?:reason|r).*true.*correct\\s+explanation",
    "both.*true.*r.*not.*correct\\s+explanation",
    "(?:assertion|a).*true.*(?:reason|r).*false",
    "(?:assertion|a).*false.*(?:reason|r).*true",
    "both.*false",
    "neither.*true",
  ].join("|"),
  "i",
)

function detectQuestionType(vignette: string, opts: { id: string; text: string }[]): QuestionType {
  if (opts.some((o) => AR_OPT.test(o.text))) return "ASSERTION_REASON"
  if (
    /match\s+(?:the\s+)?(?:following|column|list|items)/i.test(vignette) ||
    /column\s+[abi1]/i.test(vignette)
  ) return "MATCHING"
  return "STANDARD_MCQ"
}

// ── Fallback output types ─────────────────────────────────────────────────────

export interface FallbackContext {
  id: string
  type: QuestionContextType
  content: string
}

export interface FallbackQuestion {
  contextId: string | null
  questionType: QuestionType
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string | null
  explanation: string
}

// ── Main fallback parser ──────────────────────────────────────────────────────

function parseHtmlFallback(
  html: string,
  images: ImageMap,
): { contexts: FallbackContext[]; questions: FallbackQuestion[] } {
  const blocks = htmlToBlocks(html)
  const contexts: FallbackContext[] = []
  const questions: FallbackQuestion[] = []

  // ── State ──
  let ctxCounter = 0
  let currentContextId: string | null = null
  // Text/image/table blocks that accumulate before the first question of a group
  let pendingCtxBlocks: Block[] = []

  // Current question being built
  let qVignette     = ""
  let qOptions:       { id: string; text: string }[] = []
  let qAnswer:        string | null = null
  let qExpl          = ""
  let qActive        = false
  let inOptions      = false
  let inExpl         = false

  const flushQuestion = () => {
    if (!qActive || !qVignette.trim() || qOptions.length < 2) {
      qActive = false; qVignette = ""; qOptions = []; qAnswer = null; qExpl = ""; inOptions = false; inExpl = false
      return
    }
    const vignette = restoreImageTokens(qVignette.trim(), images)
    const options  = qOptions.map((o) => ({ ...o, text: restoreImageTokens(o.text, images) }))
    const expl     = restoreImageTokens(qExpl.trim(), images)
    questions.push({
      contextId: currentContextId,
      questionType: detectQuestionType(vignette, options),
      vignette,
      options,
      correctAnswer: qAnswer,
      explanation: expl,
    })
    qActive = false; qVignette = ""; qOptions = []; qAnswer = null; qExpl = ""; inOptions = false; inExpl = false
  }

  const buildContextFromPending = (): string | null => {
    if (pendingCtxBlocks.length === 0) return null

    const parts: string[] = []
    let ctxType: QuestionContextType = "TEXT"

    for (const b of pendingCtxBlocks) {
      if (b.kind === "table") {
        parts.push(b.html)
        ctxType = parts.length === 1 ? "TABLE" : "MIXED"
      } else if (b.kind === "image") {
        parts.push(`<img src="${images[b.token] ?? b.token}" alt="context image">`)
        ctxType = parts.length === 1 ? "IMAGE" : "MIXED"
      } else {
        parts.push(b.text)
      }
    }

    const content = parts.join("\n").trim()
    if (!content) return null

    ctxCounter++
    const id = `ctx-${ctxCounter}`
    if (ctxType === "TEXT" && (/<table/i.test(content) || /<img/i.test(content))) ctxType = "MIXED"
    contexts.push({ id, type: ctxType, content })
    pendingCtxBlocks = []
    return id
  }

  for (const block of blocks) {
    // ── TABLE block ────────────────────────────────────────────────────────────
    if (block.kind === "table") {
      if (!qActive) {
        // Tables before any question become a shared context
        pendingCtxBlocks.push(block)
      } else {
        // Table inside a question stem — append as HTML
        qVignette += "\n" + block.html
      }
      continue
    }

    // ── IMAGE block ────────────────────────────────────────────────────────────
    if (block.kind === "image") {
      if (!qActive) {
        pendingCtxBlocks.push(block)
      } else if (!inOptions && !inExpl) {
        qVignette += " " + block.token  // will be restored later via restoreImageTokens
      }
      continue
    }

    // ── TEXT block ─────────────────────────────────────────────────────────────
    const { text } = block

    // Answer key
    const ansM = ANS_KEY.exec(text)
    if (ansM && qActive) { qAnswer = ansM[1].toUpperCase(); inExpl = false; continue }

    // Explanation
    if (EXPL_START.test(text) && qActive) {
      inExpl = true
      qExpl = text.replace(EXPL_START, "").trim()
      continue
    }

    // Option line
    const optM = OPTION.exec(text)
    if (optM && (qActive || inOptions)) {
      inOptions = true
      inExpl = false
      const id  = (optM[1] ?? optM[2]).toUpperCase()
      const txt = optM[3].trim()
      if (!qOptions.find((o) => o.id === id)) qOptions.push({ id, text: txt })
      continue
    }

    // Option continuation (wrapped line)
    if (inOptions && !inExpl && qActive && qOptions.length > 0 && !Q_START.test(text)) {
      qOptions[qOptions.length - 1].text += " " + text
      continue
    }

    // Question start
    const qM = Q_START.exec(text)
    if (qM) {
      flushQuestion()

      // If we have accumulated non-trivial content before this question, make a context.
      // "non-trivial" = contains a table/image, OR is more than 2 text lines (a passage).
      if (pendingCtxBlocks.length > 0) {
        const hasMedia = pendingCtxBlocks.some((b) => b.kind === "table" || b.kind === "image")
        const textCount = pendingCtxBlocks.filter((b) => b.kind === "text").length
        if (hasMedia || textCount >= 2) {
          currentContextId = buildContextFromPending()
        } else {
          // Too short to be a real context — discard and reset context so
          // the short filler text doesn't keep the previous group's context alive.
          pendingCtxBlocks = []
          currentContextId = null
        }
      }

      qActive = true
      qVignette = qM[2].trim()
      continue
    }

    // Context-trigger line (e.g. "For questions 1–5:", "Read the following passage")
    if (CTX_TRIGGER.test(text) && !qActive) {
      // The trigger itself becomes part of the pending context
      pendingCtxBlocks.push({ kind: "text", text })
      continue
    }

    // Plain text
    if (qActive) {
      if (inExpl) {
        qExpl += " " + text
      } else if (!inOptions) {
        qVignette += " " + text
      }
    } else {
      // Accumulate as potential context material
      pendingCtxBlocks.push({ kind: "text", text })
    }
  }

  flushQuestion()
  return { contexts, questions }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI SYSTEM INSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════════

const SYSTEM_INSTRUCTION = `
You are a medical/exam question bank extractor. You receive HTML extracted from a
Word (.docx) file and must return every question as structured JSON.

Images appear as <img src="__IMG_N__"> placeholders — preserve them verbatim in
content/vignette strings. Do NOT describe, caption, or drop image tags.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — return exactly ONE JSON object with two keys:

{
  "contexts":  Context[],    // shared material blocks (parent)
  "questions": Question[]    // individual questions (child)
}

CONTEXT object:
{
  "id":      string,            // unique slug, e.g. "ctx-1"
  "type":    "TEXT" | "TABLE" | "IMAGE" | "MIXED",
  "content": string             // full HTML of the shared material
}

QUESTION object:
{
  "contextId":     string | null,          // id of parent Context, or null
  "questionType":  "STANDARD_MCQ" | "ASSERTION_REASON" | "MATCHING",
  "subject":       string,                 // discipline / topic
  "vignette":      string,                 // question-specific stem (HTML allowed)
  "options":       [{"id":"A","text":"…"}, …],   // A–E only
  "correctAnswer": string | null,          // "A"–"E", or null if unstated
  "explanation": {
    "objective":          string,
    "details":            string,
    "incorrectReasoning": string
  } | null
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUESTION FORMAT RULES

1. STANDALONE MCQ
   A numbered question with its own A–E options. contextId = null.

2. COMMON INSTRUCTION GROUP  ("For questions 1–5 …" / "Questions 1–10 refer to…")
   The instruction text becomes ONE Context (type TEXT). Every question in the
   range gets that contextId. The question's vignette = only its own stem.

3. PASSAGE-BASED  (dialogue, text extract, reading comprehension)
   The shared passage → ONE Context (type TEXT or MIXED).
   Each question linked to it via contextId.

4. DATA INTERPRETATION  (a scenario with statistics, lab values, graphs)
   The scenario block → ONE Context (type TEXT or MIXED).
   Each follow-up question gets contextId.

5. TABLE-BASED  (questions refer to a shared table)
   The <table> HTML → ONE Context (type TABLE).
   Questions linked via contextId.

6. IMAGE / DIAGRAM  (X-ray, ECG, histology, graph)
   If ONE image serves multiple questions → Context (type IMAGE), content = the
   <img src="__IMG_N__"> tag.  All linked questions get contextId.
   If an image belongs to a single question → put the <img> tag in that
   question's vignette; contextId = null (or the existing text context if any).

7. CLINICAL VIGNETTE  (patient case with multiple follow-up questions)
   The case narrative → ONE Context (type TEXT). Each follow-up question linked.
   The question vignette = only the specific question stem for that follow-up.

8. MATCHING
   questionType = "MATCHING".
   vignette = the full premise column (numbered list) plus the instruction.
   options = the lettered response set (A–E entries combining matches).
   contextId = null unless multiple matching blocks share introductory text.

9. ASSERTION-REASON
   questionType = "ASSERTION_REASON".
   vignette = "Assertion (A): … Reason (R): …"
   options = the standard 5 A/R choices:
     A. Both A and R are true and R is the correct explanation of A
     B. Both A and R are true but R is not the correct explanation of A
     C. A is true but R is false
     D. A is false but R is true
     E. Both A and R are false
   If the source uses different labels for these options, map them to A–E above.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GENERAL RULES
• When in doubt whether text is shared context vs individual vignette: if 2+
  questions reference it, extract as Context; if only 1 question, keep in vignette.
• Preserve COMPLETE clinical / passage detail — never truncate.
• Ignore page headers, footers, and page numbers.
• Return ONLY the JSON object — no markdown fences, no preamble, no trailing text.
`.trim()

// ═══════════════════════════════════════════════════════════════════════════════
// OUTPUT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface GeminiContext {
  id: string
  type: QuestionContextType
  content: string
}

interface GeminiQuestion {
  contextId: string | null
  questionType: QuestionType
  subject: string
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string | null
  explanation: {
    objective: string
    details: string
    incorrectReasoning: string
  } | null
}

interface GeminiOutput {
  contexts: GeminiContext[]
  questions: GeminiQuestion[]
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI CALL — tries multiple models (free-tier safe)
// ═══════════════════════════════════════════════════════════════════════════════
//
// gemini-2.0-flash has limit=0 on free-tier keys.  We cascade through models
// that ARE available on the free tier.

const CANDIDATE_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash-8b",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
]

async function parseWithGemini(
  html: string,
  moduleName: string,
): Promise<GeminiOutput | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[parse-docx] GEMINI_API_KEY not set — skipping AI parse")
    return null
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

  const excerpt =
    html.length > 400_000
      ? html.slice(0, 200_000) + "\n\n<!-- [middle truncated] -->\n\n" + html.slice(-200_000)
      : html

  const prompt = `Module: ${moduleName}\n\nExtracted HTML:\n${excerpt}`

  for (const modelName of CANDIDATE_MODELS) {
    try {
      console.log(`[parse-docx] Trying model: ${modelName}`)
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      })
      const result = await model.generateContent(prompt)
      const text = result.response.text()

      let parsed: GeminiOutput
      try {
        parsed = JSON.parse(text) as GeminiOutput
      } catch {
        console.warn(`[parse-docx] ${modelName} returned non-JSON — trying next model`)
        continue
      }
      if (!Array.isArray(parsed?.questions)) {
        console.warn(`[parse-docx] ${modelName} returned unexpected shape — trying next model`)
        continue
      }

      console.log(`[parse-docx] ${modelName} succeeded — ${parsed.questions.length} questions, ${parsed.contexts?.length ?? 0} contexts`)
      return parsed
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode
      if (status === 429 || status === 404 || status === 400) {
        console.warn(`[parse-docx] ${modelName} failed (${status}) — trying next model`)
        continue
      }
      console.error(`[parse-docx] ${modelName} unexpected error:`, err?.message ?? err)
      return null
    }
  }

  console.warn("[parse-docx] All Gemini models exhausted — using fallback parser")
  return null
}

// ═══════════════════════════════════════════════════════════════════════════════
// GEMINI OUTPUT VALIDATION + IMAGE RESTORATION
// ═══════════════════════════════════════════════════════════════════════════════

const VALID_OPT_IDS = new Set(["A", "B", "C", "D", "E"])

function validateAndRestoreImages(raw: GeminiOutput, images: ImageMap): GeminiOutput {
  // Gemini keeps <img src="__IMG_N__"> intact — only the src value needs swapping
  const contexts = (raw.contexts ?? [])
    .filter((c) => typeof c.id === "string" && typeof c.content === "string")
    .map((c) => ({ ...c, content: restoreImageSrcs(c.content, images) }))

  const validCtxIds = new Set(contexts.map((c) => c.id))

  const questions = (raw.questions ?? []).filter((q) => {
    if (!q.vignette || !Array.isArray(q.options) || q.options.length < 2) return false
    const optIds = q.options.map((o) => o.id?.toUpperCase())
    if (!optIds.every((id) => VALID_OPT_IDS.has(id))) return false
    if (q.correctAnswer != null) {
      q.correctAnswer = q.correctAnswer.toUpperCase()
      if (!VALID_OPT_IDS.has(q.correctAnswer)) q.correctAnswer = null
    }
    if (q.contextId && !validCtxIds.has(q.contextId)) q.contextId = null
    q.vignette = restoreImageSrcs(q.vignette, images)
    return true
  })

  return { contexts, questions }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_FILE_BYTES = 25 * 1024 * 1024

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")
    const moduleName = (formData.get("moduleName") as string | null) ?? "Imported Module"

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required (multipart/form-data)" }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Only .docx files are supported" }, { status: 415 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large — max ${MAX_FILE_BYTES / 1024 / 1024} MB` },
        { status: 413 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()

    // 1. Extract HTML with lightweight image placeholders
    const { html, images } = await convertDocxToHtml(arrayBuffer)
    if (!html.trim()) {
      return NextResponse.json({ error: "The document appears to be empty" }, { status: 422 })
    }

    const imgCount = Object.keys(images).length
    console.log(`[parse-docx] ${imgCount} image(s) extracted; HTML length: ${html.length}`)

    // 2. Attempt Gemini AI parsing (cascades through free-tier models)
    const raw = await parseWithGemini(html, moduleName)

    if (raw && raw.questions.length > 0) {
      const { contexts, questions } = validateAndRestoreImages(raw, images)
      return NextResponse.json({ contexts, questions, source: "gemini" })
    }

    // 3. Gemini unavailable — use server-side block-based fallback (preserves images)
    console.log("[parse-docx] Using block-based HTML fallback parser")
    const fallback = parseHtmlFallback(html, images)

    if (fallback.questions.length > 0) {
      // Convert to GeminiQuestion shape so the client code path is identical
      const questions: GeminiQuestion[] = fallback.questions.map((q) => ({
        contextId:    q.contextId,
        questionType: q.questionType,
        subject:      moduleName,
        vignette:     q.vignette,
        options:      q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
          ? { objective: "", details: q.explanation, incorrectReasoning: "" }
          : null,
      }))
      return NextResponse.json({ contexts: fallback.contexts, questions, source: "gemini" })
    }

    // 4. Last resort — plain text for the client-side regex parser
    const textResult = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) })
    return NextResponse.json({
      contexts: [],
      questions: [],
      source: "fallback",
      extractedText: textResult.value,
    })
  } catch (err) {
    console.error("[parse-docx]", err)
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 })
  }
}
