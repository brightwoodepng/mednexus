import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("admin dashboard and content workflows", () => {
  it("uses real activity, editorial status, work queues, and permission-aware actions", async () => {
    const [page, dashboard] = await Promise.all([
      readFile("app/admin/page.tsx", "utf8"),
      readFile("components/admin/admin-dashboard.tsx", "utf8"),
    ])

    expect(page).toContain("CURRENT_DATE - INTERVAL '13 days'")
    expect(page).toContain("assessment_submissions")
    expect(page).toContain("registrations")
    expect(page).toContain("mcqReview")
    expect(page).toContain("theoryReview")
    expect(dashboard).toContain("Editorial Readiness")
    expect(dashboard).toContain("Work Queue")
    expect(dashboard).toContain("capabilities.mcq &&")
    expect(dashboard).toContain("capabilities.broadcasts &&")
    expect(dashboard).not.toContain("Add MCQ")
    expect(dashboard).not.toContain("OSCE Stations")
  })

  it("hosts both importers inside Imports and Exports", async () => {
    const source = await readFile("components/admin/content-workspace.tsx", "utf8")

    expect(source).toContain('setImporter("mcq")')
    expect(source).toContain('setImporter("theory")')
    expect(source).toContain('<UniversalImporter')
    expect(source).toContain('<TheoryBulkImporter')
    expect(source).toContain("Close at any time to return to Imports &amp; Exports.")
    expect(source).not.toContain('href="/admin/mcq?import=true"')
    expect(source).not.toContain('href="/admin/theory?import=true"')
  })

  it("uses searchable taxonomy rows and app dialogs instead of browser prompts", async () => {
    const source = await readFile("components/admin/taxonomy-workspace.tsx", "utf8")

    expect(source).toContain("Search modules or disciplines")
    expect(source).toContain('role="dialog"')
    expect(source).toContain("rename_module")
    expect(source).toContain("move_discipline")
    expect(source).toContain("Theory hierarchy")
    expect(source).not.toContain("window.prompt")
    expect(source).not.toContain("window.confirm")
  })
})
