"use client"

import { useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, FileJson, FileText, FileUp, ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { importAuthHeaders, importError } from "@/lib/import-client"
import type { TheoryImportImage, TheoryImportItem, TheoryImportValidation } from "@/lib/theory-import"
import { TheoryQuestionMedia } from "@/components/theory-question-media"

const card = "rounded-2xl border border-border bg-card p-5 shadow-sm"
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition"

async function jsonRequest<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { ...importAuthHeaders(true), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await importError(response))
  return response.json() as Promise<T>
}

export function TheoryBulkImporter({ onImported, onReviewUnassigned }: {
  onImported: () => Promise<void> | void
  onReviewUnassigned: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [items, setItems] = useState<TheoryImportItem[]>([])
  const [errors, setErrors] = useState<TheoryImportValidation["errors"]>([])
  const [stage, setStage] = useState<"select" | "extracting" | "parsing" | "preview" | "committing" | "done">("select")
  const [message, setMessage] = useState("")
  const [failure, setFailure] = useState("")

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
        const result = await jsonRequest<TheoryImportValidation>("/api/admin/theory/import", { action: "validate", payload })
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
      const result = await jsonRequest<{
        summary: { created: number; skipped: number; modules: number; disciplines: number; unassigned: number }
      }>("/api/admin/theory/import", { action: "commit", items })
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
    return <section className={`${card} max-w-3xl py-12 text-center`}><CheckCircle2 className="mx-auto text-emerald-600" size={38}/><h2 className="mt-4 text-2xl font-bold">Theory import complete</h2><p className="mt-2 text-sm text-muted-foreground">{message}</p><p className="mt-2 text-sm text-muted-foreground">Imported questions are unassigned drafts. Place them into sets before publishing.</p><div className="mt-5 flex flex-wrap justify-center gap-3"><button onClick={onReviewUnassigned} className={`${button} bg-primary text-primary-foreground`}><CheckCircle2 size={16}/>Review unassigned questions</button><button onClick={reset} className={`${button} border border-border`}><Upload size={16}/>Import another file</button></div></section>
  }

  return <div className="space-y-5">
    <section className={card}>
      <div className="flex items-start gap-4"><span className="rounded-2xl bg-primary/10 p-3 text-primary"><FileUp size={24}/></span><div><h2 className="text-xl font-bold">Bulk Theory importer</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">Import PDF, Word, or structured JSON. Headings create collections, modules, and related disciplines. Questions remain unassigned so an administrator can divide them into sets after review.</p></div></div>
      <input ref={inputRef} type="file" accept=".pdf,.docx,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/json" className="sr-only" onChange={event => { setFile(event.target.files?.[0] ?? null); setFailure("") }}/>
      <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 text-center transition hover:bg-primary/10">
        <span className="flex gap-2 text-primary"><FileText/><FileJson/><ImageIcon/></span>
        <b className="mt-3">{file ? file.name : "Choose a PDF, Word, or JSON file"}</b>
        <span className="mt-1 text-xs text-muted-foreground">{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Maximum file size 25 MB · PNG, JPEG, and WebP images supported"}</span>
      </button>
      {failure && <div role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{failure}</div>}
      {(stage === "extracting" || stage === "parsing" || stage === "committing") && <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted px-4 py-3 text-sm"><Loader2 className="animate-spin text-primary" size={18}/>{message}</div>}
      <div className="mt-4 flex justify-end"><button disabled={!file || stage !== "select"} onClick={processFile} className={`${button} bg-primary text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50`}><FileUp size={16}/>Parse and preview</button></div>
    </section>

    <details className={card}>
      <summary className="cursor-pointer font-bold">Recommended document structure</summary>
      <div className="mt-4 grid gap-4 text-sm leading-6 text-muted-foreground md:grid-cols-2">
        <div><b className="text-foreground">PDF or Word headings</b><pre className="mt-2 overflow-x-auto rounded-xl bg-muted p-3 text-xs text-foreground">{`COLLECTION: End of Module
MODULE: Cardiovascular Medicine
DISCIPLINE: Cardiology
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
        <div><b className="text-foreground">Titles, images, and JSON</b><p className="mt-2">A question title is recommended, but the system generates one when it is absent. Place each image immediately beside or below its question. JSON may use a flat <code>questions</code> array or nested collections, modules, and disciplines. Do not include sets, marks, or references; marks are calculated as two per key point.</p></div>
      </div>
    </details>

    {stage === "preview" && <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Import preview</h2><p className="mt-1 text-sm text-muted-foreground">{items.length} valid questions across {groups.length} hierarchy paths. Review before committing.</p></div><button onClick={reset} className={`${button} border border-border`}>Start over</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{groups.map(group => <div key={group.label} className="rounded-xl border border-border bg-muted/20 p-3"><b className="text-sm">{group.label}</b><p className="mt-1 text-xs text-muted-foreground">{group.count} questions · {group.images} images</p></div>)}</div>
      {errors.length > 0 && <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200"><AlertTriangle size={17}/>{errors.length} rows need attention and will not be imported</div><ul className="mt-2 space-y-1 text-sm text-amber-900 dark:text-amber-100">{errors.slice(0, 10).map(error => <li key={`${error.row}-${error.message}`}>Row {error.row || "—"}: {error.message}</li>)}</ul></div>}
      <div className="mt-5 max-h-[42rem] space-y-3 overflow-y-auto pr-1">{items.map((item, index) => <article key={`${item.prompt}-${index}`} className="rounded-xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-primary">{[item.collectionTitle,item.moduleName,item.disciplineName].filter(Boolean).join(" / ")}</p><h3 className="mt-1 font-bold">{item.title}</h3><p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.prompt}</p><p className="mt-2 text-xs font-semibold text-primary">{item.marks} marks · {item.keyMarkingPoints.length} key points · Unassigned draft</p></div><button onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove from import" className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={16}/></button></div>{item.media.length > 0 && <div className="mt-3"><TheoryQuestionMedia media={item.media} compact/></div>}</article>)}</div>
      <div className="mt-5 flex justify-end"><button disabled={!items.length} onClick={commit} className={`${button} bg-primary text-primary-foreground disabled:opacity-50`}><CheckCircle2 size={16}/>Import {items.length} draft questions</button></div>
    </section>}
  </div>
}
