import { describe, expect, it } from "vitest"
import {
  buildGameQuestionPool,
  createQuestionContentFingerprint,
  deduplicateGameQuestions,
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
  it("deduplicates identical question IDs even when their content differs", () => {
    const result = buildGameQuestionPool([
      question("same", { vignette: "First vignette" }),
      question("same", { vignette: "Second vignette" }),
    ])

    expect(result.questions).toHaveLength(1)
    expect(result.diagnostics.idDuplicateCount).toBe(1)
    expect(result.diagnostics.contentDuplicateCount).toBe(0)
  })

  it("gives different IDs with identical content the same fingerprint", () => {
    expect(createQuestionContentFingerprint(question("first")))
      .toBe(createQuestionContentFingerprint(question("second")))
  })

  it("deduplicates different IDs with duplicate content at the round-selection boundary", () => {
    const selected = deduplicateGameQuestions([question("first"), question("second")])

    expect(selected.map(({ id }) => id)).toEqual(["first"])
    expect(Object.isFrozen(selected)).toBe(true)
  })

  it("ignores option ordering and labels when fingerprinting visible text", () => {
    const first = question("first")
    const reordered = question("second", {
      options: [{ id: "A", text: "Treat now" }, { id: "B", text: "Observe" }],
      correctAnswer: "A",
    })

    expect(createQuestionContentFingerprint(first)).toBe(createQuestionContentFingerprint(reordered))

    const pool = buildGameQuestionPool([first, reordered])
    expect(pool.questions).toHaveLength(1)
    expect(pool.diagnostics.contentDuplicateCount).toBe(1)

    const report = findImportQuestionDuplicates([reordered], [first])
    expect(report.duplicateCount).toBe(1)
    expect([...report.duplicateCandidateIds]).toEqual(["second"])
  })

  it("normalizes HTML and plain-text equivalents", () => {
    const html = question("html", {
      vignette: "<p>A patient has <strong>chest pain</strong>.</p>",
      options: [{ id: "A", text: "<em>Observe</em>" }, { id: "B", text: "Treat&nbsp;now" }],
    })
    const plain = question("plain")

    expect(createQuestionContentFingerprint(html)).toBe(createQuestionContentFingerprint(plain))
  })

  it("normalizes punctuation and whitespace variations without exposing the answer", () => {
    const first = question("z", { vignette: "A  PATIENT has chest-pain!", correctAnswer: "A" })
    const second = question("a", { vignette: "A patient has chest pain", correctAnswer: "B" })

    expect(createQuestionContentFingerprint(first)).toBe(createQuestionContentFingerprint(second))
    expect(createQuestionContentFingerprint(first)).not.toContain("correctAnswer")
  })

  it("keeps the same vignette distinct when options materially differ", () => {
    const first = question("first")
    const differentOptions = question("second", {
      options: [{ id: "A", text: "Observe" }, { id: "B", text: "Perform surgery" }],
    })

    expect(createQuestionContentFingerprint(first)).not.toBe(createQuestionContentFingerprint(differentOptions))
    expect(buildGameQuestionPool([first, differentOptions]).questions).toHaveLength(2)
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
