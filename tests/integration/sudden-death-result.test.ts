import { describe, expect, it } from "vitest"
import { getSuddenDeathOutcome, getSuddenDeathResultTotal } from "@/lib/sudden-death-result"

describe("Sudden Death result totals", () => {
  it("includes an incorrect answer on question one", () => {
    expect(getSuddenDeathResultTotal("incorrect_answer", 0, 1)).toBe(1)
  })

  it("includes the final incorrect answer after several correct answers", () => {
    expect(getSuddenDeathResultTotal("incorrect_answer", 3, 4)).toBe(4)
  })

  it("includes the final timed-out attempt", () => {
    expect(getSuddenDeathResultTotal("timeout", 2, 3)).toBe(3)
  })

  it("counts only correctly completed questions for a perfect pool", () => {
    expect(getSuddenDeathResultTotal("pool_completed", 5, 5)).toBe(5)
  })
})

describe("Sudden Death outcome", () => {
  it("declares a win after the selected question pool is completed", () => {
    expect(getSuddenDeathOutcome("pool_completed")).toEqual({ emoji: "🏆", headline: "You Won!" })
  })

  it.each(["incorrect_answer", "timeout"])("declares game over for %s", completionReason => {
    expect(getSuddenDeathOutcome(completionReason)).toEqual({ emoji: "💀", headline: "Game Over!" })
  })
})
