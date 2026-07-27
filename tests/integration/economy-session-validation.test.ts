import { describe, expect, it, vi } from "vitest"

const query = vi.fn()

vi.mock("@/lib/db", () => ({ default: { query, connect: vi.fn() } }))
vi.mock("server-only", () => ({}))

describe("economy session answer validation", () => {
  it("keeps multi-select answer comparison order-independent", async () => {
    const { sameAnswer } = await import("@/lib/answer-utils")

    expect(sameAnswer(["B", "A"], ["A", "B"])).toBe(true)
    expect(sameAnswer(["A"], ["A", "B"])).toBe(false)
    expect(sameAnswer("A", "A")).toBe(true)
  })
})

describe("solo completion metadata reconstruction", () => {
  it("requires exact snapshot completion and mode-specific terminal conditions", async () => {
    const { hasConsistentSoloCompletion } = await import("@/lib/solo-completion-validation")
    const base = {
      clientRoundStartedAt: "2026-01-01T00:00:00.000Z",
      clientRoundFinishedAt: "2026-01-01T00:00:10.000Z",
      selectedQuestionCount: 3,
      answeredQuestionCount: 3,
    }
    const attempts = [
      { questionId: "a", isCorrect: false },
      { questionId: "b", isCorrect: false },
      { questionId: "c", isCorrect: false },
    ]
    expect(hasConsistentSoloCompletion("rapid", ["a", "b", "c"], attempts,
      { ...base, completionReason: "lives_exhausted" })).toBe(true)
    expect(hasConsistentSoloCompletion("rapid", ["a", "b", "c"], attempts.slice(0, 2),
      { ...base, answeredQuestionCount: 2, completionReason: "lives_exhausted" })).toBe(false)
    expect(hasConsistentSoloCompletion("sudden", ["a", "b"], [
      { questionId: "a", isCorrect: true }, { questionId: "b", isCorrect: false },
    ], { ...base, selectedQuestionCount: 2, answeredQuestionCount: 2, completionReason: "incorrect_answer" })).toBe(true)
    expect(hasConsistentSoloCompletion("streak", ["a", "b", "c"], attempts.slice(0, 1),
      { ...base, answeredQuestionCount: 1, completionReason: "player_finished" })).toBe(true)
  })

  it("reconstructs timeout clocks and Double Jeopardy banks", async () => {
    const { hasConsistentSoloCompletion } = await import("@/lib/solo-completion-validation")
    expect(hasConsistentSoloCompletion("timeatk", ["a"], [{ questionId: "a", isCorrect: false }], {
      completionReason: "timeout", clientRoundStartedAt: "2026-01-01T00:00:00.000Z",
      clientRoundFinishedAt: "2026-01-01T00:01:25.000Z", selectedQuestionCount: 1,
      answeredQuestionCount: 1, freezeCount: 0,
    })).toBe(true)
    expect(hasConsistentSoloCompletion("double", ["a"], [{ questionId: "a", isCorrect: false }], {
      completionReason: "bank_depleted", clientRoundStartedAt: "2026-01-01T00:00:00.000Z",
      clientRoundFinishedAt: "2026-01-01T00:00:05.000Z", selectedQuestionCount: 1,
      answeredQuestionCount: 1, wagerHistory: [500],
    })).toBe(true)
  })
})
