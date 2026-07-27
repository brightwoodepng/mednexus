import { describe, expect, it } from "vitest"
import {
  buildGameQuestionPool,
  createQuestionContentFingerprint,
  findImportQuestionDuplicates,
} from "@/lib/game-question-pool"
import type { Question } from "@/lib/types"

function question(id: string, overrides: Partial<Question> = {}): Question {
  return {
    id,
    module: "Clinical Medicine",
    subject: "Cardiology",
    vignette: "A patient has chest pain.",
    options: [{ id: "A", text: "Observe" }, { id: "B", text: "Treat now" }],
    correctAnswer: "B",
    explanation: null,
    ...overrides,
  }
}

describe("game question pool", () => {
  it("normalizes rich text and punctuation without exposing the answer", () => {
    const first = question("z", { vignette: "<p>A  PATIENT has chest-pain!</p>", correctAnswer: "A" })
    const second = question("a", { vignette: "A patient has chest pain", correctAnswer: "B" })

    expect(createQuestionContentFingerprint(first)).toBe(createQuestionContentFingerprint(second))
    expect(createQuestionContentFingerprint(first)).not.toContain("correctAnswer")
  })

  it("filters unsupported records and deterministically deduplicates IDs then content", () => {
    const result = buildGameQuestionPool([
      question("z"),
      question("a", { vignette: "A patient has chest pain!" }),
      question("a", { vignette: "Different content" }),
      question("draft", { status: "draft" }),
      question("sata", { correctAnswer: ["A", "B"] }),
      question("matching", { questionType: "MATCHING" }),
    ], { effectiveModule: "Clinical Medicine", discipline: "Cardiology" })

    expect(result.questions.map(({ id }) => id)).toEqual(["a"])
    expect(result.diagnostics.idDuplicateCount).toBe(1)
    expect(result.diagnostics.contentDuplicateCount).toBe(1)
  })

  it("detects duplicates within imports and against the bank", () => {
    const report = findImportQuestionDuplicates([
      question("new-1"),
      question("new-2", { vignette: "Unique" }),
      question("new-3", { vignette: "Unique!" }),
    ], [question("existing")])

    expect(report.duplicateCount).toBe(2)
    expect([...report.duplicateCandidateIds]).toEqual(["new-1", "new-3"])
  })
})
