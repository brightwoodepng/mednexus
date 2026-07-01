import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import type { QuestionContextType, QuestionType } from "@/lib/types"

export const maxDuration = 60

// ── Image → placeholder map ───────────────────────────────────────────────────
// Images are stored as base64 data URIs keyed by a lightweight placeholder
// token (__IMG_1__, __IMG_2__, …).  Mammoth embeds placeholders in the HTML;
// Gemini only sees the tokens (tiny), not the raw bytes.  After Gemini returns
// we swap the real data URIs back in.
interface ImageMap {
  [placeholder: string]: string // "__IMG_N__" → "data:<mime>;base64,<b64>"
}

// ── Mammoth: convert .docx → HTML with image placeholders ────────────────────
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

// ── Placeholder substitution ──────────────────────────────────────────────────
//
// Two variants are needed because the token appears in two different contexts:
//
// 1. restoreImageSrcs — for Gemini output.
//    Gemini preserves the <img> tag verbatim: <img src="__IMG_1__">
//    We only need to replace the src attribute value, not the whole element.
//    Result: <img src="data:image/png;base64,...">
//
// 2. restoreImageTokens — for server-side fallback output.
//    The HTML→text conversion emits bare tokens: "… __IMG_1__ …"
//    We wrap them in a full <img> element.
//    Result: <img src="data:image/png;base64,..." alt="embedded image" …>
//
function restoreImageSrcs(text: string, images: ImageMap): string {
  // Replace token inside src="..." attributes produced by Gemini
  return text.replace(/src="(__IMG_\d+__)"/g, (_, token) => {
    const dataUri = images[token]
    return dataUri ? `src="${dataUri}"` : `src="${token}"`
  })
}

function restoreImageTokens(text: string, images: ImageMap): string {
  // Replace bare __IMG_N__ tokens produced by the plain-text extractor
  return text.replace(/__IMG_\d+__/g, (token) => {
    const dataUri = images[token]
    return dataUri
      ? `<img src="${dataUri}" alt="embedded image" style="max-width:100%;height:auto;">`
      : token
  })
}

// ── Server-side HTML fallback parser ─────────────────────────────────────────
// Parses mammoth-generated HTML into structured questions, preserving images.
// Used when Gemini is unavailable.
interface RawQuestion {
  vignette: string    // may contain restored <img> tags
  options: { id: string; text: string }[]
  correctAnswer: string | null
  explanation: string
}

function parseHtmlFallback(html: string, images: ImageMap): RawQuestion[] {
  // 1. Convert HTML to plain-text segments, preserving image placeholders as tokens
  //    Strip all tags except <img>, convert <img src="__IMG_N__"> → __IMG_N__
  const text = html
    .replace(/<img[^>]*src="(__IMG_\d+__)"[^>]*>/gi, " $1 ")  // img → token
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")                                    // strip remaining tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')

  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const results: RawQuestion[] = []

  let pending: Partial<RawQuestion> | null = null
  let pendingOptions: { id: string; text: string }[] = []
  let collectingExplanation = false
  let inOptions = false

  const flush = () => {
    if (pending?.vignette && pendingOptions.length >= 2) {
      results.push({
        // Bare __IMG_N__ tokens in plain-text → full <img> elements
        vignette: restoreImageTokens(pending.vignette.trim(), images),
        options: pendingOptions.map((o) => ({
          id: o.id,
          text: restoreImageTokens(o.text, images),
        })),
        correctAnswer: pending.correctAnswer ?? null,
        explanation: restoreImageTokens(pending.explanation ?? "", images),
      })
    }
    pending = null
    pendingOptions = []
    collectingExplanation = false
    inOptions = false
  }

  const optPattern = /^(?:\(([A-Ea-e])\)|([A-Ea-e])[.):\-])[ \t]*(.+)$/
  const ansPattern = /^(?:correct[\s_]?answer|answer|ans(?:wer)?|key)[\s.:—-]*([A-Ea-e])\b/i
  const explPattern = /^(?:explanation|rationale|discussion|reason|solution)[.:\s—-]/i
  const qPattern   = /^(?:Question\s+|Q\.?\s*)?(\d{1,4})[.):\s]+(.+)/

  for (const line of lines) {
    if (!line) continue

    const ansM = ansPattern.exec(line)
    if (ansM && pending) {
      pending.correctAnswer = ansM[1].toUpperCase()
      collectingExplanation = false
      continue
    }

    const expM = explPattern.exec(line)
    if (expM && pending) {
      collectingExplanation = true
      pending.explanation = line.replace(explPattern, "").trim()
      continue
    }

    const optM = optPattern.exec(line)
    if (optM && (pending || inOptions)) {
      inOptions = true
      const id = (optM[1] ?? optM[2]).toUpperCase()
      const text = optM[3].trim()
      if (!pendingOptions.find((o) => o.id === id)) pendingOptions.push({ id, text })
      collectingExplanation = false
      continue
    }

    if (inOptions && pendingOptions.length > 0 && pending && !collectingExplanation) {
      if (!qPattern.test(line)) {
        pendingOptions[pendingOptions.length - 1].text += " " + line
        continue
      }
    }

    const qM = qPattern.exec(line)
    if (qM) {
      flush()
      pending = { vignette: qM[2].trim(), correctAnswer: null, explanation: "" }
      continue
    }

    // Image token or continuation text
    if (pending) {
      if (collectingExplanation) {
        pending.explanation = (pending.explanation ?? "") + " " + line
      } else if (!inOptions) {
        // If the line is just an image token, attach it to vignette
        pending.vignette = (pending.vignette ?? "") + " " + line
      }
    }
  }

  flush()
  return results
}

// ── Gemini system instruction ─────────────────────────────────────────────────
const SYSTEM_INSTRUCTION = `
You are a medical education data extractor specializing in question bank imports.

You will receive HTML extracted from a .docx file. It may contain clinical vignettes,
tables, images (as <img> tags whose src is a placeholder like __IMG_1__), and multiple-choice questions.

Your task is to parse ALL questions and return a single JSON object with two keys:
  "contexts"  — array of shared clinical material blocks (the PARENT)
  "questions" — array of individual questions (the CHILD)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT OBJECT (create one when 2+ questions share the same vignette, table, or image):
{
  "id":      string,   // short slug, e.g. "ctx-1", "ctx-2"
  "type":    "TEXT" | "TABLE" | "IMAGE" | "MIXED",
  "content": string    // the shared clinical passage, full table HTML, or the <img> tag verbatim
}

QUESTION OBJECT:
{
  "contextId":    string | null,  // matches a Context id above; null for standalone questions
  "questionType": "STANDARD_MCQ" | "ASSERTION_REASON" | "MATCHING",
  "subject":      string,         // medical discipline / topic (use moduleName if unknown)
  "vignette":     string,         // the specific question stem; include the <img> tag verbatim if the image belongs to this question alone
  "options":      [{ "id": "A", "text": "..." }, ...],  // A–E only
  "correctAnswer": string | null, // single uppercase letter; null if not stated in source
  "explanation": {
    "objective":          string,
    "details":            string,
    "incorrectReasoning": string
  } | null
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES:
1. If several questions share the same opening clinical vignette, table, or image, extract that
   shared material into ONE Context object and set contextId on each child question.
2. If a question stands alone, set contextId to null.
3. When an <img> tag appears, preserve the ENTIRE <img src="__IMG_N__"> tag verbatim — do NOT describe or drop it.
4. For ASSERTION_REASON: put assertion in vignette, reason options as A/B/C/D choices.
5. For MATCHING: put premise list in vignette, options as response list.
6. Preserve complete clinical detail — do not truncate vignettes.
7. Ignore page headers, footers, and page numbers.
8. Return ONLY the JSON object — no markdown, no preamble, no trailing text.
`.trim()

// ── Output shapes ─────────────────────────────────────────────────────────────
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

// ── Gemini call — tries multiple models ───────────────────────────────────────
// Free-tier keys have quota = 0 for gemini-2.0-flash.
// Try flash-lite first (free tier), then 8b (also free), then 1.5-flash.
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

  // Trim only if truly enormous (placeholder HTML is compact — images are stripped out)
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
        // Malformed JSON from this model — try the next one
        console.warn(`[parse-docx] ${modelName} returned non-JSON — trying next model`)
        continue
      }

      if (!Array.isArray(parsed?.questions)) {
        console.warn(`[parse-docx] ${modelName} returned unexpected shape — trying next model`)
        continue
      }

      console.log(`[parse-docx] ${modelName} succeeded — ${parsed.questions.length} questions`)
      return parsed
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode
      // 429 quota, 404 model not found, 400 bad request → try next model
      if (status === 429 || status === 404 || status === 400) {
        console.warn(`[parse-docx] ${modelName} failed (${status}) — trying next model`)
        continue
      }
      // Unexpected error — bail out entirely rather than hammering the API
      console.error(`[parse-docx] ${modelName} unexpected error:`, err?.message ?? err)
      return null
    }
  }

  console.warn("[parse-docx] All Gemini models exhausted — using fallback")
  return null
}

// ── Output validation ─────────────────────────────────────────────────────────
const VALID_OPTION_IDS = new Set(["A", "B", "C", "D", "E"])

function validateAndRestoreImages(raw: GeminiOutput, images: ImageMap): GeminiOutput {
  // Gemini preserves <img src="__IMG_N__"> verbatim — restore only the src value
  const contexts = (raw.contexts ?? [])
    .filter((c) => typeof c.id === "string" && typeof c.content === "string")
    .map((c) => ({ ...c, content: restoreImageSrcs(c.content, images) }))

  const validContextIds = new Set(contexts.map((c) => c.id))

  const questions = (raw.questions ?? []).filter((q) => {
    if (!q.vignette || !Array.isArray(q.options) || q.options.length < 2) return false
    const optIds = q.options.map((o) => o.id?.toUpperCase())
    if (!optIds.every((id) => VALID_OPTION_IDS.has(id))) return false
    if (q.correctAnswer !== null && q.correctAnswer !== undefined) {
      q.correctAnswer = q.correctAnswer.toUpperCase()
      if (!VALID_OPTION_IDS.has(q.correctAnswer)) q.correctAnswer = null
    }
    if (q.contextId && !validContextIds.has(q.contextId)) q.contextId = null
    q.vignette = restoreImageSrcs(q.vignette, images)
    return true
  })

  return { contexts, questions }
}

// ── Route handler ─────────────────────────────────────────────────────────────
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
        { error: `File too large. Max ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 413 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()

    // 1. Extract HTML with image placeholders
    const { html, images } = await convertDocxToHtml(arrayBuffer)
    if (!html.trim()) {
      return NextResponse.json({ error: "The document appears to be empty" }, { status: 422 })
    }

    const imgCount = Object.keys(images).length
    console.log(`[parse-docx] extracted ${imgCount} image(s); HTML length: ${html.length}`)

    // 2. Try Gemini (attempts multiple free-tier models in order)
    const raw = await parseWithGemini(html, moduleName)

    if (raw && raw.questions.length > 0) {
      // 3. Swap placeholders back to real data URIs
      const { contexts, questions } = validateAndRestoreImages(raw, images)
      return NextResponse.json({ contexts, questions, source: "gemini" })
    }

    // 4. Gemini unavailable — server-side HTML fallback that preserves images
    console.log("[parse-docx] Using server-side HTML fallback parser")
    const rawQuestions = parseHtmlFallback(html, images)

    if (rawQuestions.length > 0) {
      const questions: GeminiQuestion[] = rawQuestions.map((q) => ({
        contextId: null,
        questionType: "STANDARD_MCQ",
        subject: moduleName,
        vignette: q.vignette,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation
          ? { objective: "", details: q.explanation, incorrectReasoning: "" }
          : null,
      }))
      return NextResponse.json({ contexts: [], questions, source: "gemini" })
    }

    // 5. Last resort — return extracted text so client regex can try
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
