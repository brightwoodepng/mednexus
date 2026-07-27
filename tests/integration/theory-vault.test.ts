import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  intInRange,
  pagination,
  requiredText,
  stringArray,
  theoryRatingOutcome,
  theorySetDisplayProjection,
  theorySetNumberExpression,
  wordCount,
} from "@/lib/theory-server"

describe("Theory Vault contracts", () => {
  it("keeps student list responses bounded", () => {
    expect(pagination(new URL("https://mednexus.test/theory?page=-2&pageSize=1000"))).toEqual({
      page: 1,
      pageSize: 50,
      offset: 0,
    })
    expect(pagination(new URL("https://mednexus.test/theory?page=3&pageSize=20"))).toEqual({
      page: 3,
      pageSize: 20,
      offset: 40,
    })
  })

  it("applies the exact self-rating confidence and revision transitions", () => {
    expect(theoryRatingOutcome("excellent")).toEqual({ confidence: "high", revisionAction: "remove" })
    expect(theoryRatingOutcome("partial")).toEqual({ confidence: "medium", revisionAction: "preserve" })
    expect(theoryRatingOutcome("needs_revision")).toEqual({ confidence: "low", revisionAction: "add" })
  })

  it("normalizes authoring input without accepting empty required content", () => {
    expect(() => requiredText("   ", "Question prompt")).toThrow("Question prompt is required.")
    expect(requiredText("  Clinical prompt  ", "Question prompt")).toBe("Clinical prompt")
    expect(stringArray(["  alpha ", "", 12, "beta"])).toEqual(["alpha", "beta"])
    expect(intInRange(20, 15, 20, 20)).toBe(20)
    expect(intInRange(30, 15, 20, 20)).toBe(20)
    expect(wordCount("A **structured** medical answer.")).toBe(4)
  })

  it("numbers published learner sets within their module or discipline", () => {
    const expression = theorySetNumberExpression("s")
    expect(expression).toContain("numbered_set.collection_id=s.collection_id")
    expect(expression).toContain("numbered_set.module_id IS NOT DISTINCT FROM s.module_id")
    expect(expression).toContain("numbered_set.discipline_id IS NOT DISTINCT FROM s.discipline_id")
    expect(expression).toContain("numbered_set.sort_order")
    expect(expression).toContain("numbered_set.name")
    expect(expression).toContain("numbered_set.id")
    expect(theorySetDisplayProjection("s")).toContain('AS "setLabel"')
  })

  it("projects learner set labels across APIs and PDFs without changing admin naming", async () => {
    const [route, dashboard, exportRoute, adminRoute] = await Promise.all([
      readFile("app/api/theory/route.ts", "utf8"),
      readFile("app/api/theory/dashboard/route.ts", "utf8"),
      readFile("app/api/theory/export/route.ts", "utf8"),
      readFile("app/api/admin/theory/route.ts", "utf8"),
    ])
    expect(route.match(/theorySetDisplayProjection/g)?.length).toBeGreaterThanOrEqual(7)
    expect(dashboard.match(/theorySetDisplayProjection/g)?.length).toBeGreaterThanOrEqual(3)
    expect(exportRoute).toContain('source === "set" ? result.rows[0].setLabel')
    expect(exportRoute).toContain('question.setLabel ?? "Unassigned"')
    expect(adminRoute).toContain("mednexus_theory_sets")
    expect(adminRoute).toContain("name")
  })
})
