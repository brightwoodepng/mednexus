"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { QuestionEditor } from "@/components/question-editor"
import { UniversalImporter } from "@/components/universal-importer"
import type { Question } from "@/lib/types"

/**
 * Keeps the protected MCQ page server-authenticated while providing the local
 * UI state required by the importer modal and the editor's draft queue.
 */
export function McqBankWorkspace() {
  const [importerOpen, setImporterOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<Question[] | null>(null)
  const searchParams = useSearchParams()
  useEffect(() => { if (searchParams.get("import") === "true") setImporterOpen(true) }, [searchParams])

  return (
    <>
      <QuestionEditor
        pendingImport={pendingImport}
        onPendingImportConsumed={() => setPendingImport(null)}
        onOpenImporter={() => setImporterOpen(true)}
      />
      {importerOpen && (
        <UniversalImporter
          onImport={(questions) => {
            void fetch("/api/admin/content/imports", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ bank: "mcq", sourceName: "MCQ universal importer", drafts: questions }),
            })
            setPendingImport(questions)
            setImporterOpen(false)
          }}
          onClose={() => setImporterOpen(false)}
        />
      )}
    </>
  )
}

