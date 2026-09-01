import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  detectAudioDurationSeconds,
  hasValidAudioSignature,
  normalizeAudioMime,
  parseDeclaredDuration,
  THEORY_AI_CONSENT_VERSION,
  THEORY_AI_DAILY_LIMIT,
  THEORY_AI_MAX_AUDIO_BYTES,
  THEORY_AI_MAX_AUDIO_SECONDS,
} from "@/lib/theory-ai"

describe("Theory AI study tools", () => {
  it("uses versioned consent and the planned durable limits", () => {
    expect(THEORY_AI_CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(THEORY_AI_DAILY_LIMIT).toBe(50)
    expect(THEORY_AI_MAX_AUDIO_SECONDS).toBe(300)
    expect(THEORY_AI_MAX_AUDIO_BYTES).toBe(8 * 1024 * 1024)
  })

  it("normalizes supported recorder MIME types and rejects unsupported audio", () => {
    expect(normalizeAudioMime("audio/webm;codecs=opus")).toBe("audio/webm")
    expect(normalizeAudioMime("audio/x-m4a")).toBe("audio/mp4")
    expect(normalizeAudioMime("audio/mp3")).toBe("audio/mpeg")
    expect(normalizeAudioMime("video/webm")).toBeNull()
  })

  it("validates signatures instead of trusting an upload MIME label", () => {
    expect(hasValidAudioSignature(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]), "audio/webm")).toBe(true)
    expect(hasValidAudioSignature(Uint8Array.from([0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0, 0, 0, 0, 0]), "audio/ogg")).toBe(true)
    expect(hasValidAudioSignature(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]), "audio/wav")).toBe(true)
    expect(hasValidAudioSignature(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]), "audio/webm")).toBe(false)
  })

  it("requires a positive declared duration within five minutes", () => {
    expect(parseDeclaredDuration("0")).toBeNull()
    expect(parseDeclaredDuration("300")).toBe(300)
    expect(parseDeclaredDuration("300.1")).toBeNull()
    expect(parseDeclaredDuration("not-a-number")).toBeNull()
  })

  it("reads WAV container duration server-side instead of trusting the form field", () => {
    const wav = new Uint8Array(44 + 16_000)
    wav.set([0x52, 0x49, 0x46, 0x46], 0)
    wav.set([0x57, 0x41, 0x56, 0x45], 8)
    wav.set([0x64, 0x61, 0x74, 0x61], 36)
    const view = new DataView(wav.buffer)
    view.setUint32(28, 16_000, true)
    view.setUint32(40, 16_000, true)
    expect(detectAudioDurationSeconds(wav, "audio/wav")).toBe(1)
  })

  it("keeps AI routes separate from note storage and never sends a model answer for refinement", async () => {
    const [refineRoute, transcribeRoute, gemini, theoryUi] = await Promise.all([
      readFile("app/api/theory/ai/refine-note/route.ts", "utf8"),
      readFile("app/api/theory/ai/transcribe/route.ts", "utf8"),
      readFile("lib/gemini.ts", "utf8"),
      readFile("components/theory-vault.tsx", "utf8"),
    ])
    expect(refineRoute).not.toContain("model_answer")
    expect(refineRoute).not.toContain("mednexus_theory_notes")
    expect(transcribeRoute).not.toContain("INSERT INTO mednexus_theory_notes")
    expect(transcribeRoute).not.toContain("audio BYTEA")
    expect(gemini).toContain("Never answer the question and never mention a model answer.")
    expect(theoryUi).toContain("Write a quick note…")
    expect(theoryUi).not.toContain('"/api/theory/ai/refine-note"')
    expect(theoryUi).toContain("cursorRef.current")
  })
})
