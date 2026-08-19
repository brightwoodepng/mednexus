"use client"

import { useMemo, useRef, useState, type DragEvent } from "react"
import { AlertTriangle, CheckCircle2, FileJson, FileText, FileUp, ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { importAuthHeaders, importError } from "@/lib/import-client"
import type { TheoryCollectionKind, TheoryImportImage, TheoryImportItem, TheoryImportValidation } from "@/lib/theory-import"
import { TheoryQuestionMedia } from "@/components/theory-question-media"
import { plainTextImportFileType, readPlainTextImportFile } from "@/lib/plain-text-import"

const card = "rounded-2xl border border-border bg-card p-5 shadow-sm"
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition"

function supportedTheoryImportFile(fileName: string) {
  const name = fileName.trim().toLowerCase()
  return name.endsWith(".json") || name.endsWith(".pdf") || name.endsWith(".docx") || plainTextImportFileType(name) !== null
}

async function jsonRequest<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...importAuthHeaders(true), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await importError(response))
  return response.json() as Promise<T>
}

export function TheoryBulkImporter({ collectionKind, defaultSetSize = 20, onImported, onReviewImported }: {
  collectionKind: TheoryCollectionKind
  defaultSetSize?: number
  onImported: () => Promise<void> | void
  onReviewImported: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<TheoryImportItem[]>([])
  const [errors, setErrors] = useState<TheoryImportValidation["errors"]>([])
  const [stage, setStage] = useState<"select" | "extracting" | "parsing" | "preview" | "committing" | "done">("select")
  const [message, setMessage] = useState("")
  const [failure, setFailure] = useState("")
  const kindLabel = collectionKind === "end_of_module" ? "End of Module" : "End of Year"

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; count: number; images: number }>()
    for (const item of items) {
      const label = [item.collectionTitle, item.moduleName, item.disciplineName].filter(Boolean).join(" / ")
      const current = map.get(label) ?? { label, count: 0, images: 0 }
      current.count++
      current.images += item.media.length
      map.set(label, current)
    }
    return [...map.values()]
  }, [items])

  const selectFile = (selected: File | null) => {
    setFailure("")
    if (selected && !supportedTheoryImportFile(selected.name)) {
      setFile(null)
      setFailure("Unsupported file type. Choose a .pdf, .docx, .json, .txt, or .md file.")
      return
    }
    setFile(selected)
  }

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (stage !== "select") return
    selectFile(event.dataTransfer.files?.[0] ?? null)
  }

  const processFile = async () => {
    if (!file) return
    setFailure("")
    setErrors([])
    setItems([])
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        setStage("parsing")
        setMessage("Validating Theory hierarchy and questions…")
        const payload = JSON.parse(await file.text()) as unknown
        const result = await jsonRequest<TheoryImportValidation>("/api/admin/theory/import", { action: "validate", collectionKind, payload })
        setItems(result.items)
        setErrors(result.errors)
      } else if (plainTextImportFileType(file.name)) {
        setStage("parsing")
        setMessage("Reading text and building Theory questions…")
        const text = await readPlainTextImportFile(file)
        const result = await jsonRequest<TheoryImportValidation>("/api/admin/theory/import", {
          action: "parse",
          collectionKind,
          text,
          images: [],
        })
        setItems(result.items)
        setErrors(result.errors)
      } else {
        setStage("extracting")
        setMessage("Extracting document text and embedded images…")
        const form = new FormData()
        form.append("file", file)
        const endpoint = file.name.toLowerCase().endsWith(".pdf") ? "/api/parse-pdf-file" : "/api/parse-docx"
        const extractedResponse = await fetch(endpoint, { method: "POST", body: form, headers: importAuthHeaders() })
        if (!extractedResponse.ok) throw new Error(await importError(extractedResponse))
        const extracted = await extractedResponse.json() as { text: string; images?: TheoryImportImage[] }
        setStage("parsing")
        setMessage(`Building modules, disciplines, and questions${extracted.images?.length ? ` from ${extracted.images.length} embedded images` : ""}…`)
        const result = await jsonRequest<TheoryImportValidation>("/api/admin/theory/import", {
          action: "parse",
          collectionKind,
          text: extracted.text,
          images: extracted.images ?? [],
        })
        setItems(result.items)
        setErrors(result.errors)
      }
      setStage("preview")
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Unable to parse this Theory file.")
      setStage("select")
    }
  }

  const commit = async () => {
    if (!items.length) return
    setFailure("")
    setStage("committing")
    setMessage("Creating hierarchy and saving imported questions as drafts…")
    try {
      const staged = await jsonRequest<{ id: string }>("/api/admin/content/imports", {
        bank: "theory", sourceName: file?.name || "Theory bulk importer", drafts: items, errors,
      })
      const result = await jsonRequest<{
        summary: { created: number; skipped: number; modules: number; disciplines: number; unassigned: number }
      }>("/api/admin/theory/import", { action: "commit", collectionKind, items })
      await fetch(`/api/admin/content/imports/${staged.id}`, {
        method: "PATCH",
        headers: { ...importAuthHeaders(true), "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_committed" }),
      })
      setMessage(`${result.summary.created} draft questions imported; ${result.summary.skipped} existing questions skipped.`)
      setStage("done")
      await onImported()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : "Unable to commit this Theory import.")
      setStage("preview")
    }
  }

  const reset = () => {
    setFile(null)
    setItems([])
    setErrors([])
    setFailure("")
    setMessage("")
    setStage("select")
    if (inputRef.current) inputRef.current.value = ""
  }

  if (stage === "done") {
    return <section className={`${card} max-w-3xl py-12 text-center`}><CheckCircle2 className="mx-auto text-emerald-600" size={38}/><h2 className="mt-4 text-2xl font-bold">{kindLabel} import complete</h2><p className="mt-2 text-sm text-muted-foreground">{message}</p><p className="mt-2 text-sm text-muted-foreground">The system placed every imported draft into its numbered set. Review and publish when ready.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button onClick={onReviewImported} className={`${button} bg-primary text-primary-foreground`}><CheckCircle2 size={16}/>Review imported questions</button><button onClick={reset} className={`${button} border border-border`}><Upload size={16}/>Import another file</button></div></section>
  }

  return <div className="space-y-5">
    <section className={card}>
      <div className="flex items-start gap-4"><span className="rounded-2xl bg-primary/10 p-3 text-primary"><FileUp size={24}/></span><div><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Importing into {kindLabel}</p><h2 className="mt-1 text-xl font-bold">Bulk Theory importer</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Import PDF, Word, plain text, Markdown, or structured JSON. {collectionKind === "end_of_module" ? "Module headings are required; a related discipline is optional." : "Discipline headings are required."} Questions keep their source order and are automatically divided into numbered sets of up to {defaultSetSize}.</p></div></div>
      <input ref={inputRef} type="file" accept=".pdf,.docx,.json,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json,text/plain,text/markdown" className="sr-only" onChange={event => selectFile(event.target.files?.[0] ?? null)}/>
      <button type="button" onClick={() => inputRef.current?.click()} onDragOver={event => event.preventDefault()} onDrop={handleDrop} className="mt-5 flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center transition hover:bg-primary/10">
        <span className="flex gap-2 text-primary"><FileText/><FileJson/><ImageIcon/></span>
        <b className="mt-3">{file ? file.name : "Choose or drop a PDF, Word, text, Markdown, or JSON file"}</b>
        <span className="mt-1 text-xs text-muted-foreground">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Maximum file size 25 MB · PNG, JPEG, and WebP images supported"}</span>
      </button>
      {failure && <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{failure}</div>}
      {(stage === "extracting" || stage === "parsing" || stage === "committing") && <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm"><Loader2 className="animate-spin text-primary" size={18}/>{message}</div>}
      <div className="mt-4 flex justify-end"><button disabled={!file || stage !== "select"} onClick={processFile} className={`${button} bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50`}><FileUp size={16}/>Parse and preview</button></div>
    </section>

    <details className={card}>
      <summary className="cursor-pointer font-bold">Recommended document structure</summary>
      <div className="mt-4 grid gap-4 text-sm leading-6 text-muted-foreground md:grid-cols-2">
        <div><b className="text-foreground">Recommended {kindLabel} headings</b><pre className="mt-2 overflow-x-auto rounded-xl bg-muted p-3 text-xs text-foreground">{`${collectionKind === "end_of_module" ? "MODULE: Cardiovascular Medicine\nDISCIPLINE: Cardiology" : "DISCIPLINE: Internal Medicine"}
QUESTION TITLE: Acute pulmonary oedema management

QUESTION:
Discuss the assessment and management...

MODEL ANSWER:
## Assessment
...

KEY POINTS:
- Performs an ABCDE assessment
- Identifies likely precipitants
- Describes appropriate initial management`}</pre></div>
        <div><b className="text-foreground">Titles, images, and automatic sets</b><p className="mt-2">A question title is recommended, but the system generates one when it is absent. Place each image immediately beside or below its question. Do not include collections, sets, or marks. The destination is fixed as {kindLabel}, sets are generated by the system, and marks are calculated as two per key point.</p></div>
      </div>
    </details>

    {stage === "preview" && <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Import preview</h2><p className="mt-1 text-sm text-muted-foreground">{items.length} valid questions across {groups.length} hierarchy paths. Review before committing.</p></div><button onClick={reset} className={`${button} border border-border`}>Start over</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{groups.map(group => <div key={group.label} className="rounded-xl border border-border bg-muted/20 p-3"><b className="text-sm">{group.label}</b><p className="mt-1 text-xs text-muted-foreground">{group.count} questions · {Math.ceil(group.count/defaultSetSize)} set allocation{Math.ceil(group.count/defaultSetSize) === 1 ? "" : "s"} · {group.images} images</p></div>)}</div>
      {errors.length > 0 && <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200"><AlertTriangle size={17}/>{errors.length} rows need attention and will not be imported</div><ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-100">{errors.slice(0, 10).map(error => <li key={`${error.row}-${error.message}`}>Row {error.row || "—"}: {error.message}</li>)}</ul></div>}
      <div className="mt-5 max-h-[42rem] space-y-3 overflow-y-auto pr-1">{items.map((item, index) => <article key={`${item.prompt}-${index}`} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">{[item.collectionTitle,item.moduleName,item.disciplineName].filter(Boolean).join(" / ")}</p><h3 className="mt-1 font-bold">{item.title}</h3><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.prompt}</p><p className="mt-2 text-xs font-semibold text-primary">{item.marks} marks · {item.keyMarkingPoints.length} key points · Automatically allocated draft</p></div><button onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove from import" className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={16}/></button></div>{item.media.length > 0 && <div className="mt-3"><TheoryQuestionMedia media={item.media} compact/></div>}</article>)}</div>
      <div className="mt-5 flex justify-end"><button disabled={!items.length} onClick={commit} className={`${button} bg-primary text-primary-foreground disabled:opacity-50`}><CheckCircle2 size={16}/>Import and allocate {items.length} drafts</button></div>
    </section>}
  </div>
}
