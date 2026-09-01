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
    expect(source).toContain("shadow-[0_12px_36px")
    expect(source).toContain("min-w-0")
    expect(source).not.toContain("overflow-x-auto")
    expect(source).not.toContain("min-w-max")
  })

  it("keeps phone navigation geometry and typography stable across states", async () => {
    const source = await readFile("components/bottom-nav.tsx", "utf8")
    expect(source).toContain("h-12 w-full min-w-0")
    expect(source).toContain("text-[9px] font-semibold leading-none")
    expect(source).toContain("transition-[background-color,color,box-shadow]")
    expect(source).toContain('aria-current={active ? "page" : undefined}')
    expect(source).toContain('active ? "bg-primary/15 shadow-sm" : "bg-transparent"')
    expect(source).not.toContain("transition-all")
    expect(source).not.toContain('active ? "font-bold')
    expect(source).not.toMatch(/(?:hover|active):scale-/)
  })

  it("switches workspaces and their home screens through one immediate action", async () => {
    const [app, applicationShell, shell, sidebar, theory] = await Promise.all([
      readFile("components/mednexus-app.tsx", "utf8"),
      readFile("components/authenticated-application-shell.tsx", "utf8"),
      readFile("components/learner-workspace-shell.tsx", "utf8"),
      readFile("components/sidebar.tsx", "utf8"),
      readFile("components/theory-vault.tsx", "utf8"),
    ])
    expect(app).toContain("const handleStudyHubNavigation = useCallback")
    expect(app).toContain("const homeScreen = learnerHomeScreen(hub)")
    expect(app).toContain("setScreen(homeScreen)")
    expect(app).toContain("learnerScreenUrl(homeScreen, hub)")
    expect(app).toContain("onSelectStudyHub={handleStudyHubNavigation}")
    expect(applicationShell).toContain("const [activeStudyHub, setActiveStudyHub] = useState")
    expect(applicationShell).not.toContain("withHubContext")
    expect(applicationShell).not.toContain("window.history")
    expect(shell).toContain("onSelectStudyHub={onSelectStudyHub}")
    expect(sidebar).toContain("onSelect={selectStudyHub}")
    expect(sidebar).toContain("onSelectStudyHub(hub)")
    expect(sidebar).toContain("hrefForHub={mobileOpen ? (hub) => learnerScreenUrl(learnerHomeScreen(hub), hub) : undefined}")
    expect(sidebar).not.toContain("flushSync")
    expect(sidebar).not.toContain("window.setTimeout")
    expect(sidebar).not.toContain("onAfterSelect")
    expect(sidebar).toContain("<StudyHubDropdownIcon activeHub={activeStudyHub} onSelect={onSelectStudyHub}")
    expect(theory).toContain('role="status" aria-live="polite"')
    expect(theory).toContain('className="animate-spin text-primary"')
    expect(app).toContain("void preloadTheoryDashboard().catch(() => undefined)")
    expect(app).toContain("}, 25_000)")
    expect(app).toContain("initialDashboard={getRecentTheoryDashboard()}")
    expect(theory).toContain("if (!dashboardVisible.current) setLoading(true)")
    expect(theory).toContain("const nextDashboard = await loadTheoryDashboard()")
  })

  it("keeps learner Theory reads separate from release-only schema migrations", async () => {
    const server = await readFile("lib/theory-server.ts", "utf8")
    expect(server).not.toContain("ensureSchema")
    expect(server).toContain("return runtimePool()")
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
    expect(source).toContain("grid gap-3 lg:grid-cols-2")
    expect(source).toContain("fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))]")
    expect(source).toContain("space-y-4 pb-24")
    expect(source).toContain('role="dialog" aria-label="PDF export options"')
    expect(source).toContain("fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]")
    expect(source).toContain("onQuestionViewChange")
    expect(source).not.toContain("[question.collectionTitle, question.moduleName, question.disciplineName, question.setTitle]")
    expect(source).toContain("sm:hidden")
    expect(source).toContain('focus-visible:ring-inset focus-visible:ring-primary/40')
  })

  it("uses a focused phone question header and finishes back at the current set", async () => {
    const [question, app] = await Promise.all([
      readFile("components/theory-vault.tsx", "utf8"),
      readFile("components/mednexus-app.tsx", "utf8"),
    ])
    expect(question).toContain('aria-label="Back to set"')
    expect(question).toContain("h-11 w-11")
    expect(question).toContain("sm:hidden")
    expect(question).toContain("reviewPane")
    expect(question).toContain("lg:grid-cols-[minmax(0,1fr)_320px]")
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

  it("keeps the dashboard, set browser, and study review compact", async () => {
    const source = await readFile("components/theory-vault.tsx", "utf8")
    const recentHeading = source.indexOf('id="recently-studied-heading"')
    const categoriesHeading = source.indexOf(">Study Categories</h2>")

    expect(recentHeading).toBeGreaterThan(-1)
    expect(recentHeading).toBeGreaterThan(categoriesHeading)
    expect(source).toContain('grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3')
    expect(source).toContain('aria-labelledby="set-questions-heading"')
    expect(source).toContain('Choose a question to review or practise.')
    expect(source).toContain('aria-label="Set study summary" className="rounded-2xl border border-border bg-card p-3')
    expect(source).not.toContain('{data.description &&')
    expect(source).toContain('<details className="group mt-5')
    expect(source).not.toContain('bg-primary/5 sm:hidden')
    expect(source).toContain('setSubmitted(false); setRevealed(false)')
    expect(source).toContain('{!submitted && <article')
    expect(source).toContain('{submitted && <article')
    expect(source).toContain('useAutosizeTextarea(answerRef, answer, mode === "practice" && !submitted)')
    expect(source).toContain('textarea.style.height = "auto"')
    expect(source).toContain('Math.max(88, textarea.scrollHeight)')
    expect(source).toContain('rows={3}')
    expect(source).toContain('resize-none overflow-hidden')
  })
})
