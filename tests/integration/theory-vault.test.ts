import { describe, expect, it } from "vitest"
import {
  intInRange,
  pagination,
  requiredText,
  stringArray,
  theoryRatingOutcome,
  wordCount,
} from "@/lib/theory-server"

describe("Theory Vault contracts", () => {
  it("keeps student list responses bounded", () => {
    expect(pagination(new URL("https://mednexus.test/theory?page=-2&pageSize=1000"))).toEqual({
      page: 1,
      pageSize: 50,
      offset: 0,
    })
    expect(pagination(new URL("https://mednexus.test/theory?page=3&pageSize=20"))).toEqual({
      page: 3,
      pageSize: 20,
      offset: 40,
    })
  })

  it("applies the exact self-rating confidence and revision transitions", () => {
    expect(theoryRatingOutcome("excellent")).toEqual({ confidence: "high", revisionAction: "remove" })
    expect(theoryRatingOutcome("partial")).toEqual({ confidence: "medium", revisionAction: "preserve" })
    expect(theoryRatingOutcome("needs_revision")).toEqual({ confidence: "low", revisionAction: "add" })
  })

  it("normalizes authoring input without accepting empty required content", () => {
    expect(() => requiredText("   ", "Question prompt")).toThrow("Question prompt is required.")
    expect(requiredText("  Clinical prompt  ", "Question prompt")).toBe("Clinical prompt")
    expect(stringArray(["  alpha ", "", 12, "beta"])).toEqual(["alpha", "beta"])
    expect(intInRange(20, 15, 20, 20)).toBe(20)
    expect(intInRange(30, 15, 20, 20)).toBe(20)
    expect(wordCount("A **structured** medical answer.")).toBe(4)
  })
})
