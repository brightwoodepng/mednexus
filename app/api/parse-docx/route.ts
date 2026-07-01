import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { getFlashModel } from "@/lib/gemini"
import type { QuestionContextType, QuestionType } from "@/lib/types"

export const maxDuration = 60

// ── Placeholder cloud uploader ─────────────────────────────────────────────────
// Replace this with your real storage logic (e.g. S3, GCS, Cloudinary).
// It receives the raw image Buffer and its MIME type, and must return a
// publicly-accessible URL string.
async function uploadToCloud(buffer: Buffer, contentType: string): Promise<string> {
  // TODO: implement real upload (e.g. await s3.putObject({ Body: buffer, ... }))
  const base64 = buffer.toString("base64")
  return `data:${contentType};base64,${base64.slice(0, 64)}…[mock-url]`
}

// ── Mammoth: convert .docx → HTML with embedded images ───────────────────────
async function convertDocxToHtml(arrayBuffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { buffer: Buffer.from(arrayBuffer) },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = Buffer.from(await image.read())
        const url = await uploadToCloud(buffer, image.contentType ?? "image/png")
        // The <img> tag is woven back into the HTML stream in place of the
        // original embedded image, so Gemini sees it as inline context.
        return { src: url, alt: "embedded-image" }
      }),
    },
  )

  if (result.messages.length > 0) {
    const warnings = result.messages.filter((m) => m.type === "warning")
    if (warnings.length > 0) {
      console.warn("[parse-docx] mammoth warnings:", warnings.map((m) => m.message))
    }
  }

  return result.value
}

// ── Gemini system instruction ─────────────────────────────────────────────────
// Instructs the model to group shared clinical material into Context objects
// and link individual questions to them via contextId — matching our new
// Parent-Child database schema.
const SYSTEM_INSTRUCTION = `
You are a medical education data extractor specializing in question bank imports.

You will receive HTML extracted from a .docx file. It may contain clinical vignettes,
tables, images (as <img> tags), and multiple-choice questions.

Your task is to parse ALL questions and return a single JSON object with two keys:
  "contexts"  — array of shared clinical material blocks (the PARENT)
  "questions" — array of individual questions (the CHILD)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXT OBJECT (create one when 2+ questions share the same vignette, table, or image):
{
  "id":      string,   // short slug, e.g. "ctx-1", "ctx-2"
  "type":    "TEXT" | "TABLE" | "IMAGE" | "MIXED",
  "content": string    // the shared clinical passage, table HTML, or image src URL
}

QUESTION OBJECT:
{
  "contextId":    string | null,  // matches a Context id above; null for standalone questions
  "questionType": "STANDARD_MCQ" | "ASSERTION_REASON" | "MATCHING",
  "subject":      string,         // medical discipline / topic (use moduleName if unknown)
  "vignette":     string,         // the specific question stem (NOT the shared context text)
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
1. If several questions share the same opening clinical vignette or table, extract that
   shared text into ONE Context object and set contextId on each child question.
   The question's "vignette" field should then contain ONLY the question-specific stem.
2. If a question stands alone (no shared context), set contextId to null.
3. For ASSERTION_REASON questions: put the assertion in the vignette, and the reason
   options as A/B/C/D choices (e.g. A=Both true and related, B=Both true but unrelated…).
4. For MATCHING questions: put the premise list in the vignette, options as the response list.
5. Preserve complete clinical detail — do not truncate vignettes.
6. Ignore page headers, footers, and page numbers.
7. Return ONLY the JSON object — no markdown, no preamble, no trailing text.
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

  // Gemini 1.5 Flash context window is ~1 M tokens; trim generously only if
  // truly enormous to stay within safe limits while preserving content.
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

function validateGeminiOutput(raw: GeminiOutput): GeminiOutput {
  const contexts = (raw.contexts ?? []).filter(
    (c) => typeof c.id === "string" && typeof c.content === "string",
  )
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

    // 1. Convert .docx → HTML (images become <img src="..."> tags)
    const arrayBuffer = await file.arrayBuffer()
    const html = await convertDocxToHtml(arrayBuffer)

    if (!html.trim()) {
      return NextResponse.json({ error: "The document appears to be empty" }, { status: 422 })
    }

    // 2. Parse with Gemini (Parent-Child schema)
    const raw = await parseWithGemini(html, moduleName)

    if (raw && raw.questions.length > 0) {
      const { contexts, questions } = validateGeminiOutput(raw)
      return NextResponse.json({ contexts, questions, source: "gemini" })
    }

    // 3. Gemini unavailable or returned nothing — surface the extracted text
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
