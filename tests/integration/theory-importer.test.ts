import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { normalizeTheoryImport } from "../../lib/theory-import"
import { sanitizeTheoryMedia } from "../../lib/theory-media"

describe("Theory bulk importer", () => {
  it("preserves module, related discipline, set, and embedded image placement", () => {
    const result = normalizeTheoryImport({
      questions: [{
        collectionTitle: "End of Module",
        collectionKind: "end_of_module",
        moduleName: "Cardiovascular Medicine",
        disciplineName: "Cardiology",
        setName: "Acute Presentations",
        prompt: "[IMAGE_1] Discuss the ECG findings and immediate priorities.",
        modelAnswer: "Use a structured clinical approach.",
        markingPoints: ["Recognise instability", "Interpret the tracing"],
        marks: 10,
      }],
    }, [{ id: "IMAGE_1", dataUri: "data:image/png;base64,aGVsbG8=" }])

    expect(result.errors).toEqual([])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      collectionKind: "end_of_module",
      moduleName: "Cardiovascular Medicine",
      disciplineName: "Cardiology",
      setName: "Acute Presentations",
      prompt: "Discuss the ECG findings and immediate priorities.",
    })
    expect(result.items[0].media[0].url).toBe("data:image/png;base64,aGVsbG8=")
  })

  it("accepts nested collection, module, discipline, set, and question JSON", () => {
    const result = normalizeTheoryImport({
      collections: [{
        title: "End of Module",
        kind: "end_of_module",
        modules: [{
          name: "Respiratory Medicine",
          disciplines: [{
            name: "Pulmonology",
            sets: [{
              name: "Breathlessness",
              questions: [{ prompt: "Outline the assessment of acute breathlessness.", modelAnswer: "Start with ABCDE." }],
            }],
          }],
        }],
      }],
    })
    expect(result.errors).toEqual([])
    expect(result.items[0]).toMatchObject({
      collectionTitle: "End of Module",
      moduleName: "Respiratory Medicine",
      disciplineName: "Pulmonology",
      setName: "Breathlessness",
    })
  })

  it("isolates invalid rows instead of discarding a valid batch", () => {
    const result = normalizeTheoryImport([
      { collectionKind: "end_of_module", moduleName: "", prompt: "Missing module" },
      { collectionKind: "end_of_year", disciplineName: "Pathology", prompt: "Describe reversible cell injury." },
    ])
    expect(result.items).toHaveLength(1)
    expect(result.errors).toEqual([{ row: 1, message: "Module is required for End-of-Module content." }])
  })

  it("rejects unsafe media while allowing HTTPS and supported image uploads", () => {
    expect(() => sanitizeTheoryMedia([{ type: "image", url: "javascript:alert(1)" }])).toThrow("must use HTTPS")
    expect(sanitizeTheoryMedia([
      { type: "image", url: "https://example.edu/image.png", alt: "Chest radiograph" },
      { type: "diagram", url: "data:image/webp;base64,aGVsbG8=" },
    ])).toHaveLength(2)
  })

  it("keeps the importer admin-protected and renders saved media to learners", async () => {
    const [route, manager, vault] = await Promise.all([
      readFile(new URL("../../app/api/admin/theory/import/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../../components/theory-admin-manager.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../components/theory-vault.tsx", import.meta.url), "utf8"),
    ])
    expect(route).toContain('requireAdminPermission(request, "manage_theory_content")')
    expect(route).toContain('"bulk_import"')
    expect(manager).toContain("<TheoryBulkImporter")
    expect(manager).toContain("<TheoryMediaEditor")
    expect(vault).toContain("<TheoryQuestionMedia media={question.media}")
  })
})
