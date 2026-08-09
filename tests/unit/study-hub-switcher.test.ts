import { describe, expect, it } from "vitest"
import { getStudyHubMenuOptions } from "@/components/study-hub-switcher"

describe("study hub menu options", () => {
  it("does not repeat MCQ while MCQ is active", () => {
    expect(getStudyHubMenuOptions("mcq-qbank").map((hub) => hub.id)).toEqual([
      "theory-vault",
      "osce-hub",
    ])
  })

  it("does not repeat Theory while Theory is active", () => {
    expect(getStudyHubMenuOptions("theory-vault").map((hub) => hub.id)).toEqual([
      "mcq-qbank",
      "osce-hub",
    ])
  })
})
