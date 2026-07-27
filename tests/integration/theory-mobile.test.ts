import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { getHubNavigation } from "@/components/navigation/study-hub-navigation"

describe("Theory Vault phone experience", () => {
  it("uses four study-specific Theory destinations and keeps Revision in the sidebar", () => {
    const theoryTabs = getHubNavigation("theory-vault").filter(item => item.bottomNav)
    expect(theoryTabs.map(item => item.screen)).toEqual([
      "theory-dashboard",
      "theory-browse",
      "theory-bookmarks",
      "theory-notes",
    ])
    expect(theoryTabs).toHaveLength(4)
    expect(theoryTabs.map(item => item.mobileLabel ?? item.label)).toEqual([
      "Dashboard",
      "Browse",
      "Bookmarks",
      "Notes",
    ])
    expect(getHubNavigation("theory-vault").some(item => item.screen === "theory-revision")).toBe(true)
    expect(theoryTabs.some(item => item.screen === "profile")).toBe(false)
  })

  it("uses four study destinations in MCQ without duplicating Profile", () => {
    const mcqTabs = getHubNavigation("mcq-qbank").filter(item => item.bottomNav)
    expect(mcqTabs.map(item => item.screen)).toEqual(["dashboard", "modules", "game", "leaderboard"])
    expect(mcqTabs.map(item => item.mobileLabel ?? item.label)).toEqual(["Dashboard", "Modules", "Game", "Rank"])
    expect(mcqTabs.find(item => item.screen === "game")?.label).toBe("Game Mode")
    expect(mcqTabs.find(item => item.screen === "leaderboard")?.label).toBe("Leaderboard")
    expect(mcqTabs.some(item => item.screen === "profile")).toBe(false)
  })

  it("uses non-scrolling equal-width Theory navigation with safe-area support", async () => {
    const source = await readFile("components/bottom-nav.tsx", "utf8")
    expect(source).toContain("grid grid-cols-4 items-stretch")
    expect(source).toContain('bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))"')
    expect(source).toContain("rounded-[2rem]")
    expect(source).toContain("shadow-[0_14px_36px")
    expect(source).toContain("min-w-0")
    expect(source).not.toContain("overflow-x-auto")
    expect(source).not.toContain("min-w-max")
  })

  it("centers the welcome modal and keeps the phone drawer above navigation", async () => {
    const [app, shell, sidebar] = await Promise.all([
      readFile("components/mednexus-app.tsx", "utf8"),
      readFile("components/learner-workspace-shell.tsx", "utf8"),
      readFile("components/navigation/sidebar-primitives.tsx", "utf8"),
    ])
    expect(app).toContain("fixed inset-0 z-[70] flex items-center justify-center")
    expect(app).toContain("max-h-[calc(100dvh-1.5rem)]")
    expect(shell).toContain("hideBottomNavigation || mobileNavigationOpen")
    expect(sidebar).toContain("fixed inset-0 z-[60] md:hidden")
    expect(sidebar).toContain('paddingBottom: "env(safe-area-inset-bottom, 0px)"')
  })

  it("includes phone reflow and unobscured question navigation contracts", async () => {
    const source = await readFile("components/theory-vault.tsx", "utf8")
    expect(source).toContain("grid grid-cols-1 gap-3 sm:grid-cols-2")
    expect(source).toContain("flex flex-col items-stretch gap-3 px-4 py-4 sm:flex-row")
    expect(source).toContain("fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))]")
    expect(source).toContain("space-y-2.5 pb-24")
    expect(source).toContain('role="dialog" aria-label="PDF export options"')
    expect(source).toContain("fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]")
    expect(source).toContain("onQuestionViewChange")
    expect(source).not.toContain("[question.collectionTitle, question.moduleName, question.disciplineName, question.setTitle]")
    expect(source).toContain("sm:hidden")
    expect(source).toContain("hidden sm:block")
  })

  it("uses a focused phone question header and finishes back at the current set", async () => {
    const [question, app] = await Promise.all([
      readFile("components/theory-vault.tsx", "utf8"),
      readFile("components/mednexus-app.tsx", "utf8"),
    ])
    expect(question).toContain("min-h-11 w-fit")
    expect(question).toContain("sm:hidden")
    expect(question).toContain("hidden w-full truncate")
    expect(question).toContain('question.nextId ? onMove(question.nextId) : onFinish(question.setId)')
    expect(question).toContain("if (setId) await openSet(setId)")
    expect(question).toContain('<>Finish <CheckCircle2 size={16}/></>')
    expect(app).toContain('hideBottomNavigation={isExamActive || (activeStudyHub === "theory-vault" && theoryQuestionOpen)}')
  })

  it("keeps the Theory search compact on phones and wider on desktop", async () => {
    const source = await readFile("components/mednexus-app.tsx", "utf8")
    expect(source).toContain("max-w-[10.5rem]")
    expect(source).toContain("sm:max-w-xl")
    expect(source).toContain("lg:max-w-2xl")
    expect(source).toContain("activeStudyHub === \"theory-vault\" && !theoryQuestionOpen")
  })

  it("exposes Appearance through the shared mobile sidebar", async () => {
    const source = await readFile("components/sidebar.tsx", "utf8")
    expect(source).toContain('label="Appearance"')
    expect(source).toContain("onCloseMobile(); onOpenThemes()")
    expect(source).toContain("md:hidden")
    expect(source).toContain("Admin Console")
  })

  it("uses the shared color-card system and simplified learner set labels", async () => {
    const source = await readFile("components/theory-vault.tsx", "utf8")
    expect(source).toContain("Open {groupType}")
    expect(source).toContain("groupSets.reduce")
    expect(source).toContain("{set.setLabel}")
    expect(source).toContain('aria-label="Set study summary"')
    expect(source).not.toContain("{data.name}</h1>")
    expect(source).toContain('colored={view === "Bookmarks"}')
    expect(source).toContain('item.setLabel ?? "Unassigned"')
  })
})
