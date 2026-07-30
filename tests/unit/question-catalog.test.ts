import { describe, expect, it } from "vitest"
import { buildQuestionCatalog } from "@/lib/question-bank-server"
import type { Question } from "@/lib/types"

function question(overrides: Partial<Question>): Question {
  return {
    id: "q1", module: "Cardiology", subject: "Medicine", vignette: "secret stem",
    options: [{ id: "A", text: "secret option" }], correctAnswer: "A",
    explanation: { objective: "secret", details: "secret", incorrectReasoning: "secret" },
    status: "live", tags: ["Arrhythmia"], ...overrides,
  }
}

describe("question catalog aggregation", () => {
  it("returns topic-aware counts and version metadata without question content", () => {
    const catalog = buildQuestionCatalog([
      question({}),
      question({ id: "q2" }),
      question({ id: "draft", status: "draft", tags: ["Hidden"] }),
    ], "2026-07-30T00:00:00.000Z")

    expect(catalog).toEqual({
      totalCount: 2,
      updatedAt: "2026-07-30T00:00:00.000Z",
      modules: [{ name: "Cardiology", count: 2, disciplines: [{
        name: "Medicine", count: 2, topics: [{ name: "Arrhythmia", count: 2 }],
      }] }],
    })
    expect(JSON.stringify(catalog)).not.toMatch(/secret stem|secret option|correctAnswer|explanation|media/i)
  })
})
