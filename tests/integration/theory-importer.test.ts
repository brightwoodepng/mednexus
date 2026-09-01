import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { normalizeTheoryImport } from "../../lib/theory-import"
import { sanitizeTheoryMedia } from "../../lib/theory-media"
import { theorySetAllocationKey, theorySetPlacement } from "../../lib/theory-set-placement"

describe("Theory bulk importer", () => {
  it("keeps End-of-Module set and question placement compatible with the legacy composite foreign key", () => {
    const collectionId = "theory-collection-end-of-module"
    const moduleId = "theory-module-community-medicine"
    const disciplineId = "theory-discipline-community-medicine"
    const set = theorySetPlacement("end_of_module", moduleId, disciplineId)

    expect(set).toEqual({ moduleId, disciplineId })
    expect([collectionId, set.disciplineId]).toEqual([collectionId, disciplineId])
    expect(theorySetAllocationKey(collectionId, "end_of_module", moduleId, disciplineId)).toContain(disciplineId)
  })

  it("preserves module, related discipline, and embedded image placement while ignoring source sets and marks", () => {
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
        referencesMd: "Ignored source reference",
      }],
    }, [{ id: "IMAGE_1", dataUri: "data:image/png;base64,aGVsbG8=" }])

    expect(result.errors).toEqual([])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      collectionKind: "end_of_module",
      moduleName: "Cardiovascular Medicine",
      disciplineName: "Cardiology",
      title: "Discuss the ECG findings and immediate priorities.",
      prompt: "Discuss the ECG findings and immediate priorities.",
      marks: 4,
    })
    expect(result.items[0]).not.toHaveProperty("setName")
    expect(result.items[0]).not.toHaveProperty("referencesMd")
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
              questions: [{
                prompt: "Outline the assessment of acute breathlessness.",
                modelAnswer: "Start with ABCDE.",
                keyMarkingPoints: ["Uses an ABCDE assessment"],
              }],
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
      marks: 2,
    })
  })

  it("isolates invalid rows instead of discarding a valid batch", () => {
    const result = normalizeTheoryImport([
      { collectionKind: "end_of_module", moduleName: "", prompt: "Missing module" },
      { collectionKind: "end_of_year", disciplineName: "Pathology", prompt: "Describe reversible cell injury.", keyMarkingPoints: ["Defines reversible injury"] },
    ])
    expect(result.items).toHaveLength(1)
    expect(result.errors).toEqual([{ row: 1, message: "Module is required for End-of-Module content." }])
  })

  it("locks every row to the administrator-selected Theory category", () => {
    const result = normalizeTheoryImport([{
      collectionTitle: "Final examination",
      moduleName: "Cardiovascular Medicine",
      prompt: "Discuss acute heart failure.",
      keyMarkingPoints: ["Explains initial assessment"],
    }], [], "end_of_module")
    expect(result.errors).toEqual([])
    expect(result.items[0]).toMatchObject({ collectionTitle: "End of Module", collectionKind: "end_of_module" })

    const mixed = normalizeTheoryImport([{
      collectionKind: "end_of_year",
      moduleName: "Cardiovascular Medicine",
      prompt: "Discuss acute heart failure.",
      keyMarkingPoints: ["Explains initial assessment"],
    }], [], "end_of_module")
    expect(mixed.items).toEqual([])
    expect(mixed.errors[0].message).toContain("importer is locked to End of Module")
  })

  it("accepts raw unanswered questions as drafts and generates bounded titles", () => {
    const raw = normalizeTheoryImport([{
      collectionKind: "end_of_year",
      disciplineName: "Pathology",
      prompt: "Discuss coagulative necrosis.",
    }])
    expect(raw.errors).toEqual([])
    expect(raw.items).toHaveLength(1)
    expect(raw.items[0]).toMatchObject({ modelAnswer: "", keyMarkingPoints: [], marks: 0 })
    expect(raw.items[0].title).toBeTruthy()

    const generated = normalizeTheoryImport([{
      collectionKind: "end_of_year",
      disciplineName: "Pathology",
      prompt: `Question 12: ${"Describe the pathological processes involved in tissue injury ".repeat(4)}`,
      keyMarkingPoints: ["Defines the process", "Gives a clinical example"],
    }])
    expect(generated.items[0].title.length).toBeLessThanOrEqual(96)
    expect(generated.items[0].title).not.toMatch(/^Question 12:/)
    expect(generated.items[0].marks).toBe(4)
  })

  it("rejects unsafe media while allowing HTTPS and supported image uploads", () => {
    expect(() => sanitizeTheoryMedia([{ type: "image", url: "javascript:alert(1)" }])).toThrow("must use HTTPS")
    expect(sanitizeTheoryMedia([
      { type: "image", url: "https://example.edu/image.png", alt: "Chest radiograph" },
      { type: "diagram", url: "data:image/webp;base64,aGVsbG8=" },
    ])).toHaveLength(2)
  })

  it("preserves preambles, sub-questions, matching answer sections, and unique images", () => {
    const result = normalizeTheoryImport({ questions: [{
      collectionKind: "end_of_module",
      moduleName: "Community Medicine",
      disciplineName: "Community Medicine",
      title: "Port health flags and hazards",
      preamble: "Study the port-health flags shown in the exhibit.",
      subQuestions: [
        { label: "A", text: "Explain each flag and what it communicates." },
        { label: "B", text: "State two port hazards and their health effects." },
      ],
      modelAnswerSections: [
        { label: "A", heading: "Quarantine flags", body: "Q requests free pratique; QQ requires clearance; QL indicates infection risk." },
        { label: "B", heading: "Port hazards", body: "Dust may cause respiratory disease; noise may cause hearing loss." },
      ],
      prompt: "compatibility fallback",
      modelAnswer: "compatibility fallback",
      imageIds: ["IMAGE_1"],
    }] }, [{ id: "IMAGE_1", dataUri: "data:image/png;base64,aGVsbG8=" }])
    expect(result.errors).toEqual([])
    expect(result.items[0].prompt).toContain("> **Preamble**")
    expect(result.items[0].prompt).toContain("**A.** Explain each flag")
    expect(result.items[0].prompt).toContain("communicates.\n\n**B.**")
    expect(result.items[0].modelAnswer).toContain("### A. Quarantine flags")
    expect(result.items[0].modelAnswer).toContain("### B. Port hazards")
    expect(result.items[0].media).toHaveLength(1)

    expect(sanitizeTheoryMedia([
      { type: "image", url: "https://example.edu/flags.png" },
      { type: "image", url: "https://example.edu/flags.png" },
    ])).toHaveLength(1)
  })

  it("keeps the importer admin-protected and renders saved media to learners", async () => {
    const [route, adminRoute, exportRoute, manager, vault, db] = await Promise.all([
      readFile(new URL("../../app/api/admin/theory/import/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../../app/api/admin/theory/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../../app/api/theory/export/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../../components/theory-admin-manager.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../components/theory-vault.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../lib/db.ts", import.meta.url), "utf8"),
    ])
    expect(route).toContain('requireAdminPermission(request, "manage_theory_content")')
    expect(route).toContain('"bulk_import"')
    expect(route).toContain("default_set_size")
    expect(route).toContain('theoryId("theory-set")')
    expect(route).toContain("collectionKind")
    expect(route).not.toContain("ensureTheoryImportSchema")
    expect(route).toContain("s.discipline_id IS NOT DISTINCT FROM $3")
    expect(route).toContain("placement.moduleId, placement.disciplineId")
    expect(route).not.toContain("findOrCreateSet")
    expect(manager).toContain("<TheoryBulkImporter")
    expect(manager).toContain("<TheoryMediaEditor")
    expect(manager).toContain("Assign selected to set")
    expect(vault).toContain("<TheoryQuestionMedia media={question.media}")
    expect(vault).toContain("<TheoryMarkdown children={question.prompt}")
    expect(vault).not.toContain("question.referencesMd")
    expect(adminRoute).toContain("question_limit")
    expect(adminRoute).toContain("discipline_id=COALESCE($4,discipline_id)")
    expect(exportRoute).not.toContain("referencesMd")
    expect(db).toContain("jsonb_array_length(key_marking_points) * 2")
    expect(db).toContain("pg_get_constraintdef(oid) LIKE")
    expect(db).toContain("FOREIGN KEY (set_id, collection_id, discipline_id)%")
    expect(db).toContain("ALTER TABLE mednexus_theory_questions DROP CONSTRAINT %I")
    expect(db).toContain("CONSTRAINT mednexus_theory_questions_set_fk")
    expect(db).not.toContain("export async function ensureTheoryImportSchema()")
    const schemaStartup = db.slice(
      db.indexOf("export async function ensureSchema()"),
      db.indexOf("const current = await client.query"),
    )
    expect(schemaStartup).not.toContain("ALTER TABLE mednexus_theory_questions")
  })

  it("parses text and Markdown files without document extraction", async () => {
    const importer = await readFile(new URL("../../components/theory-bulk-importer.tsx", import.meta.url), "utf8")
    expect(importer).toContain(".txt,.md")
    expect(importer).toContain("text/plain,text/markdown")
    expect(importer).toContain("readPlainTextImportFile(file)")
    expect(importer).toMatch(/plainTextImportFileType\(file\.name\)[\s\S]*action: "parse"[\s\S]*images: \[\]/)
    expect(importer).toContain("onDrop={handleDrop}")
    expect(importer).toContain("Unsupported file type. Choose a .pdf, .docx, .json, .txt, or .md file.")
  })
})
