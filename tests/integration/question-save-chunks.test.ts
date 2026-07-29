import { describe, expect, it, vi } from "vitest"
import type { Question } from "@/lib/types"
import { createQuestionSaveChunks, saveQuestionChunks } from "@/lib/question-save-chunks"

function question(id: string, mediaSize = 0): Question {
  return {
    id,
    module: "Integument II",
    subject: "Dermatology",
    vignette: `Question ${id}`,
    options: [
      { id: "A", text: "Option A" },
      { id: "B", text: "Option B" },
    ],
    correctAnswer: "A",
    explanation: "Explanation",
    mediaBase64: mediaSize ? `data:image/png;base64,${"a".repeat(mediaSize)}` : undefined,
  } as unknown as Question
}

describe("chunked question saving", () => {
  it("splits image-heavy questions by payload size without changing their media", () => {
    const questions = [question("1", 900_000), question("2", 900_000), question("3", 900_000)]
    const chunks = createQuestionSaveChunks(questions)

    expect(chunks).toHaveLength(3)
    expect(chunks.flat().map((item) => item.mediaBase64)).toEqual(questions.map((item) => item.mediaBase64))
  })

  it("retries a failed chunk and reports incremental progress", async () => {
    const questions = [question("1"), question("2")]
    const save = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: "HTTP 503" })
      .mockResolvedValueOnce({ ok: true })
    const progress = vi.fn()

    const result = await saveQuestionChunks(questions, save, progress, async () => {})

    expect(result.ok).toBe(true)
    expect(save).toHaveBeenCalledTimes(2)
    expect(result.savedQuestions).toEqual(questions)
    expect(progress).toHaveBeenLastCalledWith({
      saved: 2,
      total: 2,
      completedChunks: 1,
      totalChunks: 1,
    })
  })

  it("retains successful chunks and returns only failed questions for retry", async () => {
    const questions = [question("1", 900_000), question("2", 900_000)]
    const save = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValue({ ok: false, error: "HTTP 413" })

    const result = await saveQuestionChunks(questions, save, undefined, async () => {})

    expect(result.ok).toBe(false)
    expect(result.savedQuestions.map((item) => item.id)).toEqual(["1"])
    expect(result.failedQuestions.map((item) => item.id)).toEqual(["2"])
    expect(result.error).toBe("HTTP 413")
  })
})
