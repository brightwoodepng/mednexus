"use client"

import { useState } from "react"
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
            setPendingImport(questions)
            setImporterOpen(false)
          }}
          onClose={() => setImporterOpen(false)}
        />
      )}
    </>
  )
}

