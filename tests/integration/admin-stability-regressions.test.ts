import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("admin stability regressions", () => {
  it("treats Theory marking points as JSONB arrays", async () => {
    const sources = await Promise.all([
      readFile("lib/theory-server.ts", "utf8"),
      readFile("app/api/admin/theory/route.ts", "utf8"),
      readFile("app/api/theory/route.ts", "utf8"),
    ])
    for (const source of sources) {
      expect(source).not.toMatch(/cardinality\([^)]*key_marking_points/)
      expect(source).toContain("jsonb_array_length")
      expect(source).toContain("jsonb_typeof")
    }
  })

  it("uses valid dollar quoting for the Theory foreign-key repair", async () => {
    const source = await readFile("lib/db.ts", "utf8")
    const repair = source.slice(source.indexOf("legacy_set_fk") - 200, source.indexOf("legacy_set_fk") + 1_200)
    expect(repair).toContain("DO $$")
    expect(repair).toContain("END $$;")
    expect(repair).not.toMatch(/DO \$(?!\$)/)
    expect(repair).not.toMatch(/END \$(?!\$)/)
  })

  it("cancels stale Theory loads and updates a saved question in place", async () => {
    const source = await readFile("components/theory-admin-simplified.tsx", "utf8")
    expect(source).toContain("requestRef.current?.abort()")
    expect(source).toContain("requestId !== requestIdRef.current")
    expect(source).toContain("cacheRef.current")
    expect(source).toContain("result.question")
    expect(source).toContain("questions.map(question => question.id === active.id")
  })

  it("keeps the editor visible on failed saves and returns structured database errors", async () => {
    const [manager, route, errors, boundary] = await Promise.all([
      readFile("components/theory-admin-simplified.tsx", "utf8"),
      readFile("app/api/admin/theory/route.ts", "utf8"),
      readFile("lib/api-error-response.ts", "utf8"),
      readFile("app/admin/error.tsx", "utf8"),
    ])
    expect(manager).toContain('cacheRef.current.clear()')
    expect(manager).toMatch(/result\.question[\s\S]*Question saved\.[\s\S]*setActive\(null\)/)
    expect(route).toContain("databaseErrorResponse")
    for (const field of ["error", "code", "retryable"]) expect(errors).toContain(field)
    expect(boundary).toContain("reset")
  })
})
