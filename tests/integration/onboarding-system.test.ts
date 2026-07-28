import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { emptyOnboardingRecord, TUTORIAL_IDS } from "../../lib/onboarding"
import { tutorials } from "../../components/onboarding/tutorials"

const root = path.resolve(__dirname, "../..")
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8")

describe("coordinated onboarding contract", () => {
  it("keeps independent, versioned MCQ and Theory definitions", () => {
    expect(TUTORIAL_IDS).toEqual(["mcq_qbank_intro", "theory_vault_intro"])
    expect(tutorials.mcq_qbank_intro.steps).toHaveLength(6)
    expect(tutorials.theory_vault_intro.steps).toHaveLength(6)
    expect(emptyOnboardingRecord("mcq_qbank_intro").status).toBe("not_started")
    expect(emptyOnboardingRecord("theory_vault_intro").status).toBe("not_started")
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
  })
})
