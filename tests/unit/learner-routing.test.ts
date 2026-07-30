import { describe, expect, it } from "vitest"
import { learnerScreenFromUrl, learnerScreenUrl } from "@/lib/admin-hub-routing"
import type { Screen } from "@/lib/view"

describe("learner URL routing", () => {
  it("gives every ordinary MCQ destination a refresh-safe canonical URL", () => {
    const screens: Screen[] = [
      "dashboard", "modules", "weak-areas", "leaderboard", "live-assessments",
      "game", "store", "store-supply", "store-cosmetics", "store-vault",
    ]

    for (const screen of screens) {
      const url = learnerScreenUrl(screen, "mcq-qbank")
      expect(url).not.toMatch(/^\/profile/)
      expect(url).toContain("hub=mcq")
      expect(learnerScreenFromUrl(`https://mednexus.test${url}`)).toBe(screen)
    }
  })

  it("round-trips Theory Vault destinations without losing their hub", () => {
    const screens: Screen[] = [
      "theory-dashboard", "theory-browse", "theory-bookmarks", "theory-notes",
      "theory-revision", "theory-progress", "theory-search",
    ]

    for (const screen of screens) {
      const url = learnerScreenUrl(screen, "theory-vault")
      expect(url).toContain("hub=theory")
      expect(learnerScreenFromUrl(`https://mednexus.test${url}`)).toBe(screen)
    }
  })

  it("maps Profile and Dashboard to distinct URLs", () => {
    expect(learnerScreenUrl("profile", "mcq-qbank")).toBe("/profile?hub=mcq")
    expect(learnerScreenUrl("dashboard", "mcq-qbank")).toBe("/?hub=mcq")
  })
})
