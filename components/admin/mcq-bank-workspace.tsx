"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { LayoutGrid, ListTree } from "lucide-react"
import { QuestionEditor } from "@/components/question-editor"
import { UniversalImporter } from "@/components/universal-importer"
import { McqModernWorkspace } from "@/components/admin/mcq-modern-workspace"
import type { Question } from "@/lib/types"

type ManagerView = "modern" | "legacy"
const preferenceKey = "mednexus.admin.mcq-manager-view"

export function McqBankWorkspace() {
  const [importerOpen, setImporterOpen] = useState(false)
  const [pendingImport, setPendingImport] = useState<Question[] | null>(null)
  const [view, setView] = useState<ManagerView>("modern")
  const [ready, setReady] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const saved = window.localStorage.getItem(preferenceKey)
    if (saved === "legacy" || saved === "modern") setView(saved)
    setReady(true)
  }, [])
  useEffect(() => { if (searchParams.get("import") === "true") { setView("legacy"); setImporterOpen(true) } }, [searchParams])

  function choose(next: ManagerView) {
    setView(next)
    window.localStorage.setItem(preferenceKey, next)
  }

  return <>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">MCQ Bank</h1>
      <div className="grid grid-cols-2 rounded-xl border border-border bg-muted/60 p-1" aria-label="MCQ manager view">
        <button onClick={() => choose("modern")} aria-pressed={view === "modern"} className={"inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors " + (view === "modern" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}><LayoutGrid size={16}/>Manager</button>
        <button onClick={() => choose("legacy")} aria-pressed={view === "legacy"} title="Compatibility editor" className={"inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors " + (view === "legacy" ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}><ListTree size={16}/>Legacy</button>
      </div>
    </div>
    {!ready ? <div className="min-h-64 animate-pulse rounded-2xl bg-muted"/> : view === "modern" ? <McqModernWorkspace onOpenImporter={() => setImporterOpen(true)}/> : <QuestionEditor pendingImport={pendingImport} onPendingImportConsumed={() => setPendingImport(null)} onOpenImporter={() => setImporterOpen(true)}/>} 
    {importerOpen && (
      <UniversalImporter onImport={(questions) => { void fetch("/api/admin/content/imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bank: "mcq", sourceName: "MCQ universal importer", drafts: questions }) }); setPendingImport(questions); setImporterOpen(false); choose("legacy") }} onClose={() => setImporterOpen(false)}/>
    )} 
  </>
}
