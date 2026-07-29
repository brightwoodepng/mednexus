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

  it("loads the runtime bank once the application has an eligible user", async () => {
    const source = await readFile("components/mednexus-app.tsx", "utf8")

    expect(source).toContain("if (!authReady || !user || requiresPasswordUpdate) return")
    expect(source).toContain("void loadQuestionSet()")
  })
})
