import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const manager = fs.readFileSync(path.join(root, "components/theory-admin-manager.tsx"), "utf8")
const api = fs.readFileSync(path.join(root, "app/api/admin/theory/route.ts"), "utf8")

describe("admin Theory Manager", () => {
  it("uses a compact Manager and Legacy workspace switch", () => {
    expect(manager).toContain('setMode("manager")')
    expect(manager).toContain('setMode("legacy")')
    expect(manager).not.toContain("bg-gradient-to-br from-teal-700")
  })

  it("provides global statuses, hierarchy filters, sorting, pagination, and remembered layouts", () => {
    for (const contract of ["data.counts", "moduleFilter", "disciplineFilter", "setFilter", "Recently updated", "Question pages", "mednexus-admin-theory-layout"]) {
      expect(manager).toContain(contract)
    }
    for (const contract of ['searchParams.get("moduleId")', 'searchParams.get("disciplineId")', 'searchParams.get("setId")', 'searchParams.get("sort")', "GROUP BY status"]) {
      expect(api).toContain(contract)
    }
  })

  it("supports page and filtered scopes with authoritative publication validation", () => {
    expect(manager).toContain('"page" | "filtered"')
    expect(manager).toContain('action:"bulk"')
    expect(api).toContain('if (action === "bulk")')
    expect(api).toContain("cardinality(key_marking_points)>0")
    expect(api).toContain("statusBreakdown")
    expect(api).toContain("auditTheory")
  })
})
