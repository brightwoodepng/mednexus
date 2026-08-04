import { describe, expect, it } from "vitest"
import {
  assessmentPercentage,
  gradeAssessment,
  isAssessmentGradingMode,
} from "@/lib/assessment-grading"

const questionIds = ["q1", "q2", "q3", "q4"]
const correctAnswers = new Map([
  ["q1", "a"],
  ["q2", "b"],
  ["q3", "c"],
  ["q4", "d"],
])

describe("live assessment grading", () => {
  it("retains standard +1/0/0 grading", () => {
    expect(gradeAssessment(questionIds, correctAnswers, {
      q1: "a", q2: "wrong", q3: null,
    }, "standard", 50)).toEqual({
      score: 1,
      total: 4,
      percentage: 25,
      passed: false,
      correct: 1,
      wrong: 1,
      unanswered: 2,
    })
  })

  it("applies +1/−1/0 negative marking and allows negative scores", () => {
    expect(gradeAssessment(questionIds, correctAnswers, {
      q1: "a", q2: "wrong", q3: "wrong", q4: "wrong",
    }, "negative", 50)).toEqual({
      score: -2,
      total: 4,
      percentage: -50,
      passed: false,
      correct: 1,
      wrong: 3,
      unanswered: 0,
    })
  })

  it("scores all-correct, all-wrong, and all-unanswered submissions", () => {
    expect(gradeAssessment(questionIds, correctAnswers, { q1: "a", q2: "b", q3: "c", q4: "d" }, "negative", 50).score).toBe(4)
    expect(gradeAssessment(questionIds, correctAnswers, { q1: "x", q2: "x", q3: "x", q4: "x" }, "negative", 50).score).toBe(-4)
    expect(gradeAssessment(questionIds, correctAnswers, {}, "negative", 50)).toMatchObject({ score: 0, correct: 0, wrong: 0, unanswered: 4 })
  })

  it("treats null, blank, and non-string values as unanswered", () => {
    const malformed = { q1: null, q2: "", q3: "   ", q4: 42 } as unknown as Record<string, string | null>
    expect(gradeAssessment(questionIds, correctAnswers, malformed, "negative", 0)).toMatchObject({
      score: 0,
      correct: 0,
      wrong: 0,
      unanswered: 4,
    })
  })

  it("validates modes and preserves negative percentages", () => {
    expect(isAssessmentGradingMode("standard")).toBe(true)
    expect(isAssessmentGradingMode("negative")).toBe(true)
    expect(isAssessmentGradingMode("custom")).toBe(false)
    expect(assessmentPercentage(-3, 20)).toBe(-15)
  })
})
