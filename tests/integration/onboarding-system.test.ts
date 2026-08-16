import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { emptyOnboardingRecord, TUTORIAL_IDS, TUTORIAL_VERSION } from "../../lib/onboarding"
import { tutorials } from "../../components/onboarding/tutorials"

const root = path.resolve(__dirname, "../..")
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8")

describe("coordinated onboarding contract", () => {
  it("keeps independent, versioned MCQ and Theory definitions", () => {
    expect(TUTORIAL_VERSION).toBe(3)
    expect(TUTORIAL_IDS).toEqual(["mcq_qbank_desktop_intro", "mcq_qbank_phone_intro", "theory_vault_desktop_intro", "theory_vault_phone_intro"])
    expect(tutorials.mcq_qbank_desktop_intro.steps).toHaveLength(11)
    expect(tutorials.mcq_qbank_phone_intro.steps).toHaveLength(12)
    expect(tutorials.theory_vault_desktop_intro.steps).toHaveLength(12)
    expect(tutorials.theory_vault_phone_intro.steps).toHaveLength(13)
    expect(tutorials.mcq_qbank_desktop_intro.steps.find(step => step.id === "desktop-mcq-qbank-dashboard")?.navigationAction).toEqual({ type: "navigate-preview", screen: "dashboard" })
    expect(tutorials.theory_vault_phone_intro.steps.find(step => step.id === "phone-theory-vault-theory-dashboard")?.navigationAction).toEqual({ type: "navigate-preview", screen: "theory-dashboard" })
    expect(emptyOnboardingRecord("mcq_qbank_desktop_intro").status).toBe("not_started")
    expect(emptyOnboardingRecord("mcq_qbank_phone_intro").status).toBe("not_started")
  })

  it("gives every device-specific step a visible target for that layout", () => {
    for (const tutorial of Object.values(tutorials)) {
      expect(tutorial.steps.every(step => tutorial.device === "phone" ? Boolean(step.mobileTargetAnchorId) : Boolean(step.desktopTargetAnchorId))).toBe(true)
    }
    expect(tutorials.mcq_qbank_phone_intro.steps.some(step => step.mobileTargetAnchorId === "mobile-bottom-navigation")).toBe(true)
    expect(tutorials.mcq_qbank_phone_intro.steps.some(step => step.mobileDrawerTargetAnchorId === "drawer-navigation")).toBe(true)
    expect(tutorials.mcq_qbank_desktop_intro.steps.some(step => step.desktopTargetAnchorId === "desktop-navigation")).toBe(true)
  })

  it("persists onboarding separately from roles, economy and learning progress", () => {
    const schema = read("lib/db.ts")
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS mednexus_user_onboarding")
    expect(schema).toContain("PRIMARY KEY (user_id, tutorial_id, tutorial_version)")
    expect(schema).toContain("mednexus_onboarding_events")
  })

  it("derives identity from authentication and uses an idempotent completion timestamp", () => {
    const route = read("app/api/onboarding/route.ts")
    expect(route).toContain("requireRegisteredUser(request)")
    expect(route).not.toContain("body.userId")
    expect(route).toContain("COALESCE(mednexus_user_onboarding.completed_at,NOW())")
  })

  it("namespaces expiring guest state and never promotes it into account state", () => {
    const provider = read("components/onboarding/TutorialProvider.tsx")
    expect(provider).toContain("mednexus:onboarding:${user.role}:${user.uid}")
    expect(provider).toContain('fetch("/api/onboarding"')
    expect(provider).not.toContain("mergeGuest")
  })

  it("advances locally before persistence so storage failures cannot trap the learner", () => {
    const provider = read("components/onboarding/TutorialProvider.tsx")
    expect(provider.indexOf("setRecords(current =>")).toBeLessThan(provider.indexOf('fetch("/api/onboarding", { method: "POST"'))
    expect(provider).toContain("The local checkpoint keeps the tutorial usable offline")
  })

  it("keeps a paused tutorial closed for the rest of the current session", () => {
    const provider = read("components/onboarding/TutorialProvider.tsx")
    expect(provider).toContain("pausedTutorials.current.has(id)")
    expect(provider).toContain("pausedTutorials.current.add(activeTutorial)")
    expect(provider).toContain("pausedTutorials.current.delete(id)")
  })

  it("sequences Welcome, blocks unsafe activity, and provides safe target fallback", () => {
    const app = read("components/mednexus-app.tsx")
    const overlay = read("components/onboarding/TutorialOverlay.tsx")
    const mobileSheet = read("components/onboarding/TutorialMobileSheet.tsx")
    expect(app).toContain("welcomeOpen={showWelcome}")
    expect(app).toContain("isExamActive")
    expect(app).toContain("theoryQuestionOpen")
    expect(overlay).toContain("This feature is not visible")
    expect(overlay).toContain("prefers-reduced-motion")
    expect(overlay).toContain('event.key === "Escape"')
    expect(mobileSheet).toContain("safe-area-inset-bottom")
    expect(mobileSheet).toContain("48dvh")
    expect(mobileSheet).toContain("44dvh")
    expect(overlay).toContain("setConfirmSkip(false)")
    expect(overlay).toContain("visualViewport")
    expect(overlay).toContain("ResizeObserver")
  })

  it("opens dashboard previews through the application's normal navigation", () => {
    const app = read("components/mednexus-app.tsx")
    const controller = read("components/onboarding/TutorialNavigationController.tsx")
    expect(app).toContain("onNavigate={handleScreenNavigation}")
    expect(controller).toContain("onNavigateRef.current(action.screen)")
    expect(controller.indexOf("setSidebarCollapsed(false)")).toBeLessThan(controller.indexOf('if (!action || action.type === "none") return'))
  })

  it("restarts replay from the matching workspace instead of remaining on profile", () => {
    const provider = read("components/onboarding/TutorialProvider.tsx")
    expect(provider).toContain("setPendingReplay(id)")
    expect(provider).toContain('id.startsWith("mcq_qbank_")')
    expect(provider).toContain("setActiveStudyHub(targetHub)")
    expect(provider).toContain('window.history.pushState({}, "", withHubContext("/", targetHub))')
    expect(provider).toContain("onNavigate(targetScreen)")
    expect(provider).toContain("currentScreen !== targetScreen")
    expect(provider).toContain("currentScreen !== hubHome")
  })

  it("checkpoints each phone interaction once without a render loop", () => {
    const controller = read("components/onboarding/TutorialNavigationController.tsx")
    const definitions = read("components/onboarding/tutorials.ts")
    expect(controller).toContain("checkpointedStep.current === step.id")
    expect(controller).toContain("onCheckpointRef.current()")
    expect(controller).not.toContain("[onCheckpoint, shell.mobileNavigationOpen")
    expect(definitions).toContain('mobileDrawerTargetAnchorId: "drawer-workspace-switcher"')
  })

  it("tracks desktop and phone completion independently", () => {
    const provider = read("components/onboarding/TutorialProvider.tsx")
    const settings = read("components/onboarding/TutorialSettings.tsx")
    expect(provider).toContain('isPhone ? "mcq_qbank_phone_intro" : "mcq_qbank_desktop_intro"')
    expect(provider).toContain("if (!deviceReady")
    expect(settings).toContain("MCQ desktop:")
    expect(settings).toContain("Theory desktop:")
  })
})
