import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const manager = fs.readFileSync(path.join(root, "components/theory-admin-simplified.tsx"), "utf8")
const api = fs.readFileSync(path.join(root, "app/api/admin/theory/route.ts"), "utf8")

describe("admin Theory Manager", () => {
  it("uses one category-aware Theory workspace", () => {
    expect(manager).toContain('setKind("end_of_module")')
    expect(manager).toContain('setKind("end_of_year")')
    expect(manager).not.toContain('setMode("legacy")')
    expect(manager).not.toContain("bg-gradient-to-br from-teal-700")
  })

  it("provides module-first folders, set filters, search, and visible actions", () => {
    for (const contract of ["data.hierarchyStats", "groupId", "setId", "Search questions", "Import history", "FolderSettingsPanel", "Questions per new set"]) {
      expect(manager).toContain(contract)
    }
    for (const contract of ['searchParams.get("moduleId")', 'searchParams.get("disciplineId")', 'searchParams.get("setId")', "GROUP BY q.status", "GROUPING SETS"]) {
      expect(api).toContain(contract)
    }
  })

  it("supports selected bulk actions and prompt-only publication validation", () => {
    expect(manager).toContain("selected.length")
    expect(manager).toContain('action: "bulk"')
    expect(api).toContain('if (action === "bulk")')
    expect(api).toContain("set_id IS NOT NULL AND trim(prompt)<>''")
    expect(api).toContain("statusBreakdown")
    expect(api).toContain("auditTheory")
  })
})
