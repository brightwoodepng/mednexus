import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const pagePath = new URL("../../app/admin/mcq/page.tsx", import.meta.url)
const workspacePath = new URL("../../components/admin/mcq-bank-workspace.tsx", import.meta.url)
const importerPath = new URL("../../components/universal-importer.tsx", import.meta.url)

describe("MCQ importer wiring", () => {
  it("opens the importer from the protected MCQ editor and returns imported questions as drafts", async () => {
    const [page, workspace] = await Promise.all([
      readFile(pagePath, "utf8"),
      readFile(workspacePath, "utf8"),
    ])

    expect(page).toContain("<McqBankWorkspace />")
    expect(workspace).toContain("onOpenImporter={() => setImporterOpen(true)}")
    expect(workspace).toContain("{importerOpen && (")
    expect(workspace).toContain("<UniversalImporter")
    expect(workspace).toMatch(/onImport=\{\(questions\) => \{[\s\S]*setPendingImport\(questions\)[\s\S]*setImporterOpen\(false\)/)
    expect(workspace).toContain("onPendingImportConsumed={() => setPendingImport(null)}")
    expect(workspace).toContain("onClose={() => setImporterOpen(false)}")
  })

  it("routes plain-text files through the resumable MCQ import workflow", async () => {
    const importer = await readFile(importerPath, "utf8")
    expect(importer).toContain(".txt,.md")
    expect(importer).toContain("text/plain,text/markdown")
    expect(importer).toContain("readPlainTextImportFile(file)")
    expect(importer).toContain("processDocumentFile(file, fileType)")
  })
})

