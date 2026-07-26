import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { getHubNavigation, PROFILE_NAVIGATION_ITEM } from "@/components/navigation/study-hub-navigation"

describe("Theory Vault phone experience", () => {
  it("uses five study-specific Theory destinations and keeps Profile outside that bar", () => {
    const theoryTabs = getHubNavigation("theory-vault").filter(item => item.bottomNav)
    expect(theoryTabs.map(item => item.screen)).toEqual([
      "theory-dashboard",
      "theory-browse",
      "theory-bookmarks",
      "theory-notes",
      "theory-revision",
    ])
    expect(theoryTabs).toHaveLength(5)
    expect(theoryTabs.map(item => item.mobileLabel ?? item.label)).toEqual([
      "Dashboard",
      "Browse",
      "Bookmarks",
      "Notes",
      "Revision",
    ])
    expect(theoryTabs.some(item => item.screen === PROFILE_NAVIGATION_ITEM.screen)).toBe(false)
  })

  it("preserves the existing four-button MCQ phone navigation", () => {
    const mcqTabs = [
      ...getHubNavigation("mcq-qbank").filter(item => item.bottomNav),
      PROFILE_NAVIGATION_ITEM,
    ]
    expect(mcqTabs.map(item => item.screen)).toEqual(["dashboard", "game", "leaderboard", "profile"])
  })

  it("uses non-scrolling equal-width Theory navigation with safe-area support", async () => {
    const source = await readFile("components/bottom-nav.tsx", "utf8")
    expect(source).toContain('activeHub === "theory-vault" ? "grid-cols-5" : "grid-cols-4"')
    expect(source).toContain('paddingBottom: "env(safe-area-inset-bottom, 0px)"')
    expect(source).toContain("min-w-0")
    expect(source).not.toContain("overflow-x-auto")
    expect(source).not.toContain("min-w-max")
  })

  it("includes phone reflow and unobscured question navigation contracts", async () => {
    const source = await readFile("components/theory-vault.tsx", "utf8")
    expect(source).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2")
    expect(source).toContain("flex flex-col items-stretch gap-3 px-4 py-4 sm:flex-row")
    expect(source).toContain("fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))]")
    expect(source).toContain("space-y-3 pb-16")
    expect(source).toContain('role="dialog" aria-label="PDF export options"')
    expect(source).toContain("fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]")
  })
})
