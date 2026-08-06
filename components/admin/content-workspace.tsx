"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { CheckSquare, Download, FileJson, History, Import, Loader2, RotateCcw, Trash2, X } from "lucide-react"
import { UniversalImporter } from "@/components/universal-importer"
import { TheoryBulkImporter } from "@/components/theory-bulk-importer"
import type { Question } from "@/lib/types"

type Job = { id: string; bank: "mcq" | "theory"; sourceName: string; status: string; totalCount: number; validCount: number; errorCount: number; createdAt: string; committedAt: string | null }

export function ContentWorkspace() {
  const [tab, setTab] = useState<"import" | "export" | "history">("import")
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [review, setReview] = useState<{ id: string; bank: string; sourceName: string; drafts: Array<Record<string, unknown>>; errors: Array<{ index: number; message: string }> } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [importer, setImporter] = useState<"mcq" | "theory" | null>(null)
  const [message, setMessage] = useState("")
  const load = useCallback(async () => { setLoading(true); const response = await fetch(`/api/admin/content/imports?page=${page}&pageSize=20`); const body = await response.json(); if (response.ok) { setJobs(body.jobs ?? []); setTotal(body.pagination?.total ?? 0) } setLoading(false) }, [page])
  useEffect(() => { load() }, [load])
  async function remove(job: Job) {
    if (!window.confirm(`Delete the staged job “${job.sourceName}”? This cannot be undone.`)) return
    await fetch(`/api/admin/content/imports/${job.id}?confirm=true`, { method: "DELETE" }); await load()
  }
  async function openReview(job: Job) {
    const response = await fetch(`/api/admin/content/imports/${job.id}`)
    const body = await response.json()
    if (!response.ok) return
    setReview(body.job)
    setSelected(new Set((body.job.drafts ?? []).filter((draft: Record<string, unknown>) => !(body.job.errors ?? []).some((error: { index: number }) => error.index === Number(draft.importIndex))).map((draft: Record<string, unknown>) => Number(draft.importIndex))))
  }
  async function approveSelected() {
    if (!review || review.bank !== "mcq" || !selected.size) return
    const response = await fetch(`/api/admin/content/imports/${review.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "approve", selectedIndexes: [...selected] }) })
    const body = await response.json()
    if (!response.ok) return window.alert(body.error || "Approval failed")
    setReview(null); await load()
  }
  async function stageMcqImport(questions: Question[]) {
    const response = await fetch("/api/admin/content/imports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ bank: "mcq", sourceName: "MCQ universal importer", drafts: questions }) })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) { setMessage(body.error || "Unable to stage the MCQ import."); return }
    setImporter(null); setTab("history"); setMessage(`${questions.length} MCQ drafts staged for review.`); await load()
  }
  return <div className="space-y-5">
    <div><p className="text-sm font-semibold tracking-wide text-primary">CONTENT MANAGEMENT</p><h1 className="mt-2 text-3xl font-bold">Imports &amp; Exports</h1><p className="mt-2 text-sm text-muted-foreground">Stage content for review, export filtered records, and resume durable import jobs.</p></div>
    <div className="inline-flex rounded-xl bg-muted p-1">{(["import", "export", "history"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold capitalize ${tab === item ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{item === "import" ? <Import size={15} /> : item === "export" ? <Download size={15} /> : <History size={15} />}{item}</button>)}</div>
    {tab === "import" && <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border border-border bg-card p-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600"><FileJson /></span><h2 className="mt-4 font-semibold">MCQ Import</h2><p className="mt-1 text-sm text-muted-foreground">PDF, DOCX, JSON, text, or Markdown.</p><button onClick={() => { setMessage(""); setImporter("mcq") }} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Open MCQ Importer</button></section>
      <section className="rounded-xl border border-border bg-card p-5"><span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600"><FileJson /></span><h2 className="mt-4 font-semibold">Theory Import</h2><p className="mt-1 text-sm text-muted-foreground">Structured Theory files with validation and draft placement.</p><button onClick={() => { setMessage(""); setImporter("theory") }} className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Open Theory Importer</button></section>
    </div>}
    {message && <div role="status" className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">{message}</div>}
    {tab === "export" && <div className="grid gap-4 md:grid-cols-2">{(["mcq", "theory"] as const).map((bank) => <section key={bank} className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">{bank === "mcq" ? "MCQ Bank" : "Theory Vault"}</h2><p className="mt-1 text-sm text-muted-foreground">Export server-authorized content for controlled review or transfer.</p><div className="mt-5 flex gap-2"><a href={`/api/admin/content/export?bank=${bank}&format=json`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"><Download size={15} />JSON</a><a href={`/api/admin/content/export?bank=${bank}&format=csv`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold"><Download size={15} />CSV</a></div></section>)}</div>}
    {tab === "history" && <><div className="overflow-hidden rounded-xl border border-border bg-card">{loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div> : jobs.length === 0 ? <p className="p-12 text-center text-sm text-muted-foreground">No persistent import jobs yet.</p> : <div className="divide-y divide-border">{jobs.map((job) => <div key={job.id} className="flex flex-wrap items-center gap-3 p-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${job.bank === "mcq" ? "bg-teal-500/10 text-teal-600" : "bg-indigo-500/10 text-indigo-600"}`}>{job.bank}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{job.sourceName}</span><span className="text-xs text-muted-foreground">{job.totalCount} parsed · {job.errorCount} errors · {new Date(job.createdAt).toLocaleString()}</span></span><span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{job.status.replaceAll("_", " ")}</span>{job.status !== "committed" && <button onClick={() => openReview(job)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-semibold"><CheckSquare size={14} />Review</button>}<button aria-label={`Retry ${job.sourceName}`} onClick={() => fetch(`/api/admin/content/imports/${job.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "retry" }) }).then(load)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><RotateCcw size={14} /></button><button aria-label={`Delete ${job.sourceName}`} onClick={() => remove(job)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-destructive/30 text-destructive"><Trash2 size={14} /></button></div>)}</div>}</div>{total > 20 && <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">Previous</button><button disabled={page * 20 >= total} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">Next</button></div></div>}</>}
    {review && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3"><div className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border p-4"><div><h2 className="font-semibold">{review.sourceName}</h2><p className="text-xs text-muted-foreground">{review.drafts.length} staged {review.bank.toUpperCase()} drafts</p></div><button onClick={() => setReview(null)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><X size={15} /></button></div><div className="min-h-0 flex-1 overflow-y-auto p-3">{review.bank === "theory" ? <div className="rounded-xl bg-muted/50 p-5 text-sm"><p>Theory drafts are approved and assigned from the Theory content manager so its placement and publication safeguards remain authoritative.</p><Link href="/admin/theory" className="mt-4 inline-flex rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">Review in Theory Vault</Link></div> : <div className="space-y-2">{review.drafts.map((draft) => { const index = Number(draft.importIndex); const error = review.errors.find((item) => item.index === index); return <label key={index} className={`flex gap-3 rounded-xl border p-3 ${error ? "border-destructive/30 bg-destructive/5" : "border-border"}`}><input type="checkbox" disabled={Boolean(error)} checked={selected.has(index)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next })} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{String(draft.vignette || draft.title || `Question ${index + 1}`)}</span><span className="text-xs text-muted-foreground">{String(draft.module || "Unassigned")} · {String(draft.subject || "Unassigned")}</span>{error && <span className="mt-1 block text-xs text-destructive">{error.message}</span>}</span></label> })}</div>}</div>{review.bank === "mcq" && <div className="flex items-center justify-between border-t border-border p-4"><span className="text-xs text-muted-foreground">{selected.size} selected for approval</span><button disabled={!selected.size} onClick={approveSelected} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Approve selected drafts</button></div>}</div></div>}
    {importer === "mcq" && <UniversalImporter onImport={(questions) => void stageMcqImport(questions)} onClose={() => setImporter(null)}/>}
    {importer === "theory" && <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:py-8"><div className="w-full max-w-5xl rounded-2xl border border-border bg-background p-4 shadow-2xl sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Theory Importer</h2><p className="text-xs text-muted-foreground">Close at any time to return to Imports &amp; Exports.</p></div><button onClick={() => setImporter(null)} aria-label="Close Theory importer" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><X size={15}/></button></div><TheoryBulkImporter onImported={async () => { setImporter(null); setTab("history"); setMessage("Theory drafts imported successfully."); await load() }} onReviewUnassigned={() => { setImporter(null); window.location.assign("/admin/theory?status=draft&unassigned=true") }}/></div></div>}
  </div>
}
