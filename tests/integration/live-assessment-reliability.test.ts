import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("live assessment reliability", () => {
  it("returns actionable structured failures instead of hiding database errors", () => {
    const errors = read("lib/assessment-api-errors.ts")
    const collection = read("app/api/assessments/route.ts")
    const admin = read("components/live-assessments-admin.tsx")

    expect(errors).toContain("ASSESSMENT_SCHEMA_OUTDATED")
    expect(errors).toContain("ASSESSMENT_DATABASE_PERMISSION")
    expect(collection).toContain("assessmentErrorResponse(err)")
    expect(collection).not.toContain("return NextResponse.json({ assessments: [] })")
    expect(admin).toContain('role="alert"')
    expect(admin).toContain("Unable to change assessment status")
    expect(admin).toContain("Unable to delete the assessment")
  })

  it("includes the grading rule in guest assessment instructions", () => {
    const guestAssessment = read("app/api/assessments/by-token/route.ts")
    expect(guestAssessment).toContain("pass_mark,grading_mode,status")
    expect(guestAssessment).toContain('gradingMode: row.grading_mode ?? "standard"')
  })

  it("uses the unified attempt source for accurate registered and guest analytics", () => {
    const analytics = read("app/api/assessments/[id]/analytics/route.ts")
    expect(analytics).toContain("bestAttempts(await loadAttempts(pool, id))")
    expect(analytics).toContain("allRows.filter(row => row.isGuest).length")
    expect(analytics).not.toContain("false AS is_guest")
  })

  it("keeps schema migration work out of all assessment and result requests", () => {
    const runtimeRoutes = [
      "app/api/assessments/route.ts",
      "app/api/assessments/options/route.ts",
      "app/api/assessments/[id]/route.ts",
      "app/api/assessments/[id]/attempt/route.ts",
      "app/api/assessments/[id]/analytics/route.ts",
      "app/api/admin/results/route.ts",
      "app/api/admin/results/[id]/route.ts",
      "app/api/admin/results/export/route.ts",
    ]
    for (const route of runtimeRoutes) expect(read(route)).not.toContain("ensureSchema")
  })
})
