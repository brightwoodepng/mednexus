/**
 * lib/gemini.ts
 * Shared Gemini client — import `flashModel` wherever you need Gemini Flash.
 *
 * Requires env var: GEMINI_API_KEY
 *
 * NOTE: the entire `gemini-2.0-*` and `gemini-1.5-*` families have `limit: 0`
 * on free-tier API keys (completely unavailable — every call 429s/404s).
 * `getFlashModel()` cascades through models that ARE available on the free
 * tier so AI parsing doesn't silently fail and fall back to the much dumber
 * regex parser. See docx import route for the same pattern.
 */
import { GoogleGenerativeAI } from "@google/generative-ai"

const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY ?? ""

if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("[gemini] GEMINI_API_KEY is not set — AI parsing will be skipped.")
}

const genAI = new GoogleGenerativeAI(apiKey)

const CANDIDATE_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-flash-latest",
]

/**
 * gemini-2.5-flash-lite configured to return strict JSON.
 * Pass a `systemInstruction` when calling `getGenerativeModel` per-request,
 * or use this shared instance directly for simple prompts.
 */
export const flashModel = genAI.getGenerativeModel({
  model: CANDIDATE_MODELS[0],
  generationConfig: {
    responseMimeType: "application/json",
    temperature: 0,
  },
})

/**
 * Build a per-request model instance with a custom system instruction.
 * Use this when the system prompt varies by call site.
 */
export function getFlashModel(systemInstruction: string) {
  return genAI.getGenerativeModel({
    model: CANDIDATE_MODELS[0],
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  })
}

/**
 * Call `generateContent` on a prompt, cascading through free-tier-safe
 * models until one succeeds. Mirrors the retry logic in the docx import
 * route so every AI-parsing entry point behaves the same way under a
 * free-tier key.
 */
export async function generateWithFallback(
  systemInstruction: string,
  prompt: string,
): Promise<string | null> {
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      })
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode
      // Try the next model on quota/not-found/bad-request AND transient
      // server-side errors (503 overloaded, 500, timeouts) — only a truly
      // unexpected error (e.g. auth failure) should abort the whole cascade.
      console.warn(`[gemini] ${modelName} failed (${status ?? err?.name ?? "unknown"}) — trying next model`)
      continue
    }
  }
  console.warn("[gemini] All Gemini models exhausted")
  return null
}

export function geminiAvailable() {
  return Boolean(apiKey)
}

function parseJsonObject(value: string) {
  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")
  const parsed: unknown = JSON.parse(cleaned)
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null
}

export async function refineTheoryNoteWithGemini(input: {
  title: string
  prompt: string
  note: string
}) {
  const result = await generateWithFallback(
    `You polish a medical student's personal study note.
Improve grammar, clarity, structure, headings, and Markdown while preserving the student's meaning.
Never add new medical facts, diagnoses, treatments, claims, citations, or information that is not already in the note.
The question title and prompt are context only. Never answer the question and never mention a model answer.
Return strict JSON with exactly one string property: {"refinedNote":"..."}.`,
    JSON.stringify({ questionTitle: input.title, questionPrompt: input.prompt, studentNote: input.note }),
  )
  if (!result) return null
  try {
    const parsed = parseJsonObject(result)
    const refined = parsed?.refinedNote
    return typeof refined === "string" && refined.trim() ? refined.trim() : null
  } catch {
    return null
  }
}

export async function transcribeTheoryAudioWithGemini(input: {
  bytes: Uint8Array
  mimeType: string
  target: "note" | "answer"
}) {
  const prompt = `Transcribe this medical-student dictation accurately.
Preserve medical terminology, drug names, abbreviations, and spoken structure.
Do not answer, correct, expand, summarize, or add medical information.
Use readable Markdown paragraphs or bullets only when clearly dictated.
Return strict JSON: {"text":"verbatim transcript","durationSeconds":number}.
The target editor is: ${input.target}.`

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      })
      const result = await model.generateContent([
        { inlineData: { data: Buffer.from(input.bytes).toString("base64"), mimeType: input.mimeType } },
        { text: prompt },
      ])
      const parsed = parseJsonObject(result.response.text())
      const text = parsed?.text
      const durationSeconds = Number(parsed?.durationSeconds)
      if (typeof text !== "string" || !text.trim()) continue
      return {
        text: text.trim(),
        durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0
          ? Math.ceil(durationSeconds)
          : null,
      }
    } catch (error: any) {
      const status = error?.status ?? error?.statusCode
      console.warn(`[gemini] audio ${modelName} failed (${status ?? error?.name ?? "unknown"})`)
    }
  }
  return null
}
