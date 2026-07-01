import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { getFlashModel } from "@/lib/gemini"
import type { QuestionContextType, QuestionType } from "@/lib/types"

export const maxDuration = 60

// ── Mammoth: convert .docx → HTML with image placeholders ────────────────────
//
// Images are extracted into a side-map keyed by placeholder tokens
// (__IMG_1__, __IMG_2__, …).  Gemini only sees the lightweight placeholder
// tokens — it never receives the raw base64 payload, keeping token counts
// small.  After Gemini returns we substitute the real data URIs back in.
//
interface ImageMap {
  [placeholder: string]: string // placeholder → "data:<mime>;base64,<b64>"
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
        // The placeholder becomes the src; Gemini sees a tiny token, not MB of base64.
        return { src: placeholder, alt: `[image ${imgCounter}]` }
      }),
    },
  )

  if (result.messages.length > 0) {
    const warnings = result.messages.filter((m) => m.type === "warning")
    if (warnings.length > 0) {
      console.warn("[parse-docx] mammoth warnings:", warnings.map((m) => m.message))
    }
  }

  return { html: result.value, images }
}

// ── Placeholder substitution ──────────────────────────────────────────────────
//
// After Gemini returns, swap every __IMG_N__ token that appears in any string
// field with its real data URI so the client receives embeddable images.
//
function restoreImages(text: string, images: ImageMap): string {
  return text.replace(/__IMG_\d+__/g, (token) => images[token] ?? token)
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
  "vignette":     string,         // the specific question stem (NOT the shared context text); include the <img> tag verbatim if the image belongs to this question alone
  "options":      [{ "id": "A", "text": "..." }, ...],  // A–E only
  "correctAnswer": string | null, // single uppercase letter; null if not stated in source
  "explanation": {                // null if no explanation in source
    "objective":          string, // ≤1 sentence: what concept is tested
    "details":            string, // why the correct answer is right
    "incorrectReasoning": string  // why each distractor is wrong (may be "")
  } | null
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RULES:
1. If several questions share the same opening clinical vignette, table, or image, extract that
   shared material into ONE Context object and set contextId on each child question.
   The question's "vignette" field should then contain ONLY the question-specific stem.
2. If a question stands alone (no shared context), set contextId to null.
3. When an <img> tag appears, preserve the ENTIRE <img ...> tag verbatim in the content/vignette
   string — do NOT replace it with a description or drop it.
4. For ASSERTION_REASON questions: put the assertion in the vignette, and the reason
   options as A/B/C/D choices (e.g. A=Both true and related, B=Both true but unrelated…).
5. For MATCHING questions: put the premise list in the vignette, options as the response list.
6. Preserve complete clinical detail — do not truncate vignettes.
7. Ignore page headers, footers, and page numbers.
8. Return ONLY the JSON object — no markdown, no preamble, no trailing text.
`.trim()

// ── Output shapes returned by Gemini ──────────────────────────────────────────
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

// ── Gemini call ───────────────────────────────────────────────────────────────
async function parseWithGemini(
  html: string,
  moduleName: string,
): Promise<GeminiOutput | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[parse-docx] GEMINI_API_KEY not set — skipping AI parse")
    return null
  }

  // Trim only if truly enormous (placeholder HTML is compact; images are stripped out)
  const excerpt =
    html.length > 400_000
      ? html.slice(0, 200_000) + "\n\n<!-- [middle truncated] -->\n\n" + html.slice(-200_000)
      : html

  try {
    const model = getFlashModel(SYSTEM_INSTRUCTION)
    const result = await model.generateContent(
      `Module: ${moduleName}\n\nExtracted HTML:\n${excerpt}`,
    )
    const text = result.response.text()

    const parsed = JSON.parse(text) as GeminiOutput
    if (!Array.isArray(parsed?.questions)) {
      console.error("[parse-docx] Gemini returned unexpected shape:", text.slice(0, 300))
      return null
    }
    return parsed
  } catch (err) {
    console.error("[parse-docx] Gemini error:", err)
    return null
  }
}

// ── Output validation ──────────────────────────────────────────────────────────
const VALID_OPTION_IDS = new Set(["A", "B", "C", "D", "E"])

function validateAndRestoreImages(raw: GeminiOutput, images: ImageMap): GeminiOutput {
  const contexts = (raw.contexts ?? [])
    .filter((c) => typeof c.id === "string" && typeof c.content === "string")
    .map((c) => ({ ...c, content: restoreImages(c.content, images) }))

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
    // Restore images in vignette too (for standalone image questions)
    q.vignette = restoreImages(q.vignette, images)
    return true
  })

  return { contexts, questions }
}

// ── Route handler ─────────────────────────────────────────────────────────────

/** Maximum upload size: 25 MB */
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
      return NextResponse.json(
        { error: "Only .docx files are supported by this endpoint" },
        { status: 415 },
      )
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum allowed size is ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 413 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()

    // 1. Convert .docx → placeholder HTML + image map
    const { html, images } = await convertDocxToHtml(arrayBuffer)

    if (!html.trim()) {
      return NextResponse.json({ error: "The document appears to be empty" }, { status: 422 })
    }

    console.log(
      `[parse-docx] extracted ${Object.keys(images).length} image(s); HTML length: ${html.length}`,
    )

    // 2. Parse with Gemini (placeholder HTML — images not in token budget)
    const raw = await parseWithGemini(html, moduleName)

    if (raw && raw.questions.length > 0) {
      // 3. Swap placeholders back to real data URIs before returning to client
      const { contexts, questions } = validateAndRestoreImages(raw, images)
      return NextResponse.json({ contexts, questions, source: "gemini" })
    }

    // 4. Gemini unavailable or returned nothing — surface the extracted text
    //    so the client can fall back to its own regex parser.
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
