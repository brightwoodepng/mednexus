import { describe, expect, it } from "vitest"
import { getPersonalBestUpdate, personalBestValue, type SoloPersonalBestResult } from "@/lib/game-personal-best"

const cases: Array<{ mode: SoloPersonalBestResult["mode"]; result: Omit<SoloPersonalBestResult, "mode"> }> = [
  { mode: "rapid", result: { score: 10, bestStreak: 2 } },
  { mode: "sudden", result: { score: 1_000, bestStreak: 10, survivedCount: 10 } },
  { mode: "timeatk", result: { score: 10, bestStreak: 0 } },
  { mode: "double", result: { score: 10, bestStreak: 0 } },
  { mode: "streak", result: { score: 1_000, bestStreak: 10 } },
]

describe.each(cases)("$mode personal best", ({ mode, result }) => {
  const current = personalBestValue({ mode, ...result })

  it("does not mark a lower result as new", () => {
    expect(getPersonalBestUpdate(current + 1, current)).toEqual({ best: current + 1, isNewHigh: false })
  })

  it("does not mark an equal result as new", () => {
    expect(getPersonalBestUpdate(current, current)).toEqual({ best: current, isNewHigh: false })
  })

  it("marks only a strictly greater result as new", () => {
    expect(getPersonalBestUpdate(current - 1, current)).toEqual({ best: current, isNewHigh: true })
  })
})
