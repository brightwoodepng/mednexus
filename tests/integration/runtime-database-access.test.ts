import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const runtimeRoutes = [
  "app/api/admin/mcq/questions/route.ts",
  "app/api/admin/mcq/questions/[id]/route.ts",
  "app/api/admin/mcq/questions/reconcile/route.ts",
  "app/api/admin/mcq/media/route.ts",
  "app/api/admin/mcq/media/[id]/route.ts",
  "app/api/assessments/route.ts",
  "app/api/assessments/options/route.ts",
  "app/api/assessments/[id]/route.ts",
  "app/api/assessments/[id]/attempt/route.ts",
  "app/api/assessments/[id]/analytics/route.ts",
]

describe("runtime database access", () => {
  it("never runs release migrations while serving MCQ Manager or assessment requests", async () => {
    const sources = await Promise.all(runtimeRoutes.map((path) => readFile(path, "utf8")))
    for (const source of sources) {
      expect(source).not.toContain("ensureSchema")
      expect(source).toMatch(/runtimePool|optionalRuntimePool/)
    }
  })

  it("keeps the restricted runtime pool separate from schema provisioning", async () => {
    const source = await readFile("lib/runtime-db.ts", "utf8")
    expect(source).toContain('const { default: pool } = await import("@/lib/db")')
    expect(source).not.toContain("ensureSchema")
  })

  it("gives phone workspace choices canonical native destinations", async () => {
    const source = await readFile("components/navigation/study-hub-dropdown.tsx", "utf8")
    expect(source).toContain("hrefForHub && hub.available && hub.id !== activeHub")
    expect(source).toContain('<a key={hub.id} role="menuitem" href={hrefForHub(hub.id)}')
    expect(source).toContain("data-study-hub-dropdown")
    expect(source).toContain('target?.closest("[data-study-hub-dropdown]")')
  })
})
