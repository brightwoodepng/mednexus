import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("question bank loading state", () => {
  it("does not expose bundled demo questions before the runtime bank loads", async () => {
    const source = await readFile("lib/custom-questions.ts", "utf8")

    expect(source).toContain('if (typeof window === "undefined") return []')
    expect(source).not.toContain("localStorage.getItem(LS_KEY)")
    expect(source).toMatch(/_cache = \[\]\s+return _cache/)
  })

  it("does not replace a failed authenticated request with the demo bank", async () => {
    const source = await readFile("contexts/questions-context.tsx", "utf8")

    expect(source).toContain("const loaded = result.questions ?? questionsRef.current")
    expect(source).not.toContain("const loaded = result.questions ?? fallback")
  })

  it("loads the compact catalog after authentication and full records by module", async () => {
    const context = await readFile("contexts/questions-context.tsx", "utf8")
    const application = await readFile("components/mednexus-app.tsx", "utf8")

    expect(context).toContain('fetch("/api/questions?view=catalog"')
    expect(context).toContain("if (!authReady || !user)")
    expect(application).toContain("await loadQuestionSet({ module: config.module, discipline: config.discipline })")
    expect(application).not.toContain("void loadQuestionSet()")
  })
})
