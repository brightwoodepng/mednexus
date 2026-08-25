import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const live = readFileSync("components/live-assessments-admin.tsx", "utf8")
const results = readFileSync("components/admin/assessment-results-workspace.tsx", "utf8")

describe("admin assessment workspaces", () => {
  it("organizes live assessments as a searchable responsive workspace", () => {
    for (const value of ["Live Assessments", "Search by assessment or module", "Live now", "filteredAssessments", "xl:grid-cols-2"]) expect(live).toContain(value)
    expect(live).not.toContain("Create and manage live exams for your students")
  })

  it("uses separate desktop and mobile result layouts", () => {
    for (const value of ["Assessment Results", "md:block", "md:hidden", "Open results", "No results found"]) expect(results).toContain(value)
    expect(results).not.toContain("Best attempts are used for summaries")
  })
})
