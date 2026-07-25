import { describe, expect, it } from "vitest"
import {
  theoryDemoCollections,
  theoryDemoDisciplines,
  theoryDemoModules,
  theoryDemoQuestions,
  theoryDemoSets,
  theoryDemoSummary,
} from "../../lib/theory-demo-content"

describe("Theory Vault demonstration content", () => {
  it("provides both intended study categories and six usable sets", () => {
    expect(theoryDemoCollections.map(item => item.kind)).toEqual(["end_of_module", "end_of_year"])
    expect(theoryDemoModules).toHaveLength(3)
    expect(theoryDemoDisciplines).toHaveLength(3)
    expect(theoryDemoSets).toHaveLength(6)
    expect(theoryDemoSummary.questions).toBe(24)
  })

  it("uses modules for teaching content and disciplines for end-of-year content", () => {
    for (const set of theoryDemoSets) {
      const collection = theoryDemoCollections.find(item => item.id === set.collectionId)
      expect(collection).toBeDefined()
      if (collection?.kind === "end_of_module") {
        expect(set.moduleId).toBeTruthy()
        expect(set.disciplineId).toBeNull()
      } else {
        expect(set.disciplineId).toBeTruthy()
        expect(set.moduleId).toBeNull()
      }
    }
  })

  it("contains unique, publishable questions with rich study metadata", () => {
    expect(new Set(theoryDemoQuestions.map(item => item.id)).size).toBe(theoryDemoQuestions.length)
    for (const item of theoryDemoQuestions) {
      expect(item.title.trim().length).toBeGreaterThan(5)
      expect(item.prompt.trim().length).toBeGreaterThan(20)
      expect(item.modelAnswer.trim().length).toBeGreaterThan(100)
      expect(item.markingPoints.length).toBeGreaterThanOrEqual(5)
      expect(item.marks).toBeGreaterThan(0)
      expect(item.tags).toContain("demo")
      expect(item.referencesMd).toContain("Demo reference")
      expect(theoryDemoSets.some(set => set.id === item.setId)).toBe(true)
    }
  })
})

