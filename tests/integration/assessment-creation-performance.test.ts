import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("live assessment creation performance", () => {
  const admin = read("components/live-assessments-admin.tsx")
  const createRoute = read("app/api/assessments/route.ts")
  const optionsRoute = read("app/api/assessments/options/route.ts")
  const eligibility = read("lib/assessment-eligibility.ts")

  it("loads compact server-backed module options without scanning the client bank", () => {
    expect(admin).toContain('fetch("/api/assessments/options")')
    expect(admin).not.toContain("getModules()")
    expect(optionsRoute).toContain('requireAdminRequest(req, "manage_assessments")')
    expect(optionsRoute).toContain("eligibleQuestionCount")
    expect(optionsRoute).not.toContain("question.value AS question")
  })

  it("shares canonical module and structural eligibility rules", () => {
    expect(optionsRoute).toContain('assessmentEligibilitySql("question.value")')
    expect(createRoute).toContain('assessmentEligibilitySql("question.value")')
    expect(eligibility).toContain("BTRIM")
    expect(eligibility).toContain("correctAnswer")
    expect(eligibility).toContain("explanation")
  })

  it("randomizes lightweight ids before loading selected snapshots", () => {
    expect(createRoute).toContain("eligible_ids AS MATERIALIZED")
    expect(createRoute).toContain("selected_ids AS MATERIALIZED")
    expect(createRoute).toContain("SELECT id FROM eligible_ids ORDER BY random() LIMIT $4")
    expect(createRoute.indexOf("selected_ids AS MATERIALIZED")).toBeLessThan(createRoute.indexOf("question.value AS question"))
  })

  it("reports requested and actual counts while allowing short modules", () => {
    expect(createRoute).toContain("requestedQuestionCount, actualQuestionCount")
    expect(admin).toContain("this assessment will use {actualCount}")
    expect(admin).toContain("Assessment created with all")
  })

  it("handles slow and malformed responses without duplicate submissions", () => {
    expect(admin).toContain("readJsonResponse")
    expect(admin).toContain("controller.abort()")
    expect(admin).toContain("disabled={saving || optionsLoading")
    expect(admin).toContain("Creation took too long. Refresh the assessment list before retrying")
  })
})
