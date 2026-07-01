/**
 * lib/gemini.ts
 * Shared Gemini client — import `flashModel` wherever you need Gemini 1.5 Flash.
 *
 * Requires env var: GEMINI_API_KEY
 */
import { GoogleGenerativeAI } from "@google/generative-ai"

const apiKey = process.env.GEMINI_API_KEY ?? ""

if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("[gemini] GEMINI_API_KEY is not set — AI parsing will be skipped.")
}

const genAI = new GoogleGenerativeAI(apiKey)

/**
 * gemini-1.5-flash configured to return strict JSON.
 * Pass a `systemInstruction` when calling `getGenerativeModel` per-request,
 * or use this shared instance directly for simple prompts.
 */
export const flashModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
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
    model: "gemini-1.5-flash",
    systemInstruction,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  })
}
