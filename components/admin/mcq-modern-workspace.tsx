"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, Copy, FileDown, Filter, ImageIcon, Loader2, Plus, Search, SquarePen, Tags, Trash2, Upload, X } from "lucide-react"
import type { Question } from "@/lib/types"

type ManagedQuestion = Question & { status: "draft" | "review" | "live" | "offline" | "archived"; validationIssues: string[]; mediaCount: number }
type ListResponse = { questions: ManagedQuestion[]; pagination: { page: number; pageSize: number; total: number; pages: number }; filters: { modules: string[]; subjects: string[] }; counts: Record<string, number> }

const emptyData: ListResponse = { questions: [], pagination: { page: 1, pageSize: 18, total: 0, pages: 1 }, filters: { modules: [], subjects: [] }, counts: {} }
const statusStyles: Record<string, string> = { live: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", draft: "bg-amber-500/10 text-amber-700 dark:text-amber-300", review: "bg-sky-500/10 text-sky-700 dark:text-sky-300", offline: "bg-slate-500/10 text-slate-600 dark:text-slate-300", archived: "bg-rose-500/10 text-rose-700 dark:text-rose-300" }

export function McqModernWorkspace({ onOpenImporter }: { onOpenImporter: () => void }) {
  const router = useRouter()
  const [data, setData] = useState<ListResponse>(emptyData)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [moduleName, setModuleName] = useState("")
  const [subject, setSubject] = useState("")
  const [status, setStatus] = useState("")
  const [media, setMedia] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkOpen, setBulkOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    const params = new URLSearchParams({ page: String(page), pageSize: "18" })
    if (search.trim()) params.set("search", search.trim())
    if (moduleName) params.set("module", moduleName)
    if (subject) params.set("subject", subject)
    if (status) params.set("status", status)
    if (media) params.set("media", media)
    try {
      const response = await fetch("/api/admin/mcq/questions?" + params, { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Unable to load the MCQ bank.")
      setData(body); setSelected(new Set())
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load the MCQ bank.") }
    finally { setLoading(false) }
  }, [page, search, moduleName, subject, status, media])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => { setPage(1) }, [search, moduleName, subject, status, media])

  const allShownSelected = data.questions.length > 0 && data.questions.every((question) => selected.has(question.id))
  const selectedQuestions = useMemo(() => data.questions.filter((question) => selected.has(question.id)), [data.questions, selected])

  function toggle(id: string) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  function selectShown() { setSelected(allShownSelected ? new Set() : new Set(data.questions.map((question) => question.id))) }

  async function createQuestion() {
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/admin/mcq/questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ module: moduleName, subject }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Unable to create a question.")
      router.push("/admin/mcq/" + body.question.id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create a question."); setSaving(false) }
  }

  async function bulk(action: string, payload: Record<string, unknown> = {}) {
    if (!selected.size) return
    if (action === "delete" && !window.confirm("Permanently delete the selected MCQs? This cannot be undone.")) return
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/admin/mcq/questions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: [...selected], action, confirmation: action === "delete" ? "DELETE SELECTED MCQS" : undefined, ...payload }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Bulk update failed.")
      setBulkOpen(false); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Bulk update failed.") }
    finally { setSaving(false) }
  }

  return <div className="space-y-5">
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {[['All', data.pagination.total, ''], ['Live', data.counts.live ?? 0, 'live'], ['Drafts', data.counts.draft ?? 0, 'draft'], ['In review', data.counts.review ?? 0, 'review'], ['Needs attention', data.questions.filter((q) => q.validationIssues.length).length, 'issues']].map(([label, count, value]) => <button key={String(label)} onClick={() => value === 'issues' ? setStatus('') : setStatus(String(value))} className="rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 hover:shadow-md"><span className="text-2xl font-bold">{count}</span><span className="mt-1 block text-xs font-medium text-muted-foreground">{label}</span></button>)}
    </section>

    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stems, answers, modules, disciplines or tags" className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"/></div>
        <button onClick={onOpenImporter} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted"><Upload size={16}/>Import</button>
        <button onClick={() => void createQuestion()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}New question</button>
      </div>
      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 xl:grid-cols-5">
        <select value={moduleName} onChange={(e) => setModuleName(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All modules</option>{data.filters.modules.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All disciplines</option>{data.filters.subjects.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All statuses</option><option value="live">Live</option><option value="draft">Draft</option><option value="review">In review</option><option value="offline">Offline</option><option value="archived">Archived</option></select>
        <select value={media} onChange={(e) => setMedia(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Any media</option><option value="with">With images</option><option value="without">Without images</option></select>
        <button onClick={() => { setSearch(""); setModuleName(""); setSubject(""); setStatus(""); setMedia("") }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"><X size={15}/>Clear filters</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
        <label className="inline-flex items-center gap-2"><input type="checkbox" checked={allShownSelected} onChange={selectShown}/><span>Select page</span></label>
        <span className="text-muted-foreground">{data.pagination.total} questions · {selected.size} selected</span>
        <button disabled={!selected.size} onClick={() => setBulkOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 font-semibold disabled:opacity-40"><Filter size={15}/>Bulk actions</button>
      </div>
    </section>

    {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    {loading ? <div className="flex min-h-72 items-center justify-center"><Loader2 className="animate-spin text-primary"/></div> : data.questions.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-12 text-center"><p className="font-semibold">No questions match these filters.</p><p className="mt-1 text-sm text-muted-foreground">Clear filters or create a new draft.</p></div> : <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{data.questions.map((question) => {
      const mediaItem = question.media?.find((asset) => asset.placement === "stem")
      const preview = mediaItem?.url || question.mediaBase64 || ""
      return <article key={question.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
        {preview ? <div className="h-36 overflow-hidden bg-muted"><img src={preview} alt={mediaItem?.alt || "Question image"} className="h-full w-full object-cover"/></div> : <div className="flex h-20 items-center justify-center bg-gradient-to-br from-primary/10 via-transparent to-cyan-500/10"><ImageIcon className="text-primary/50"/></div>}
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-3"><input type="checkbox" checked={selected.has(question.id)} onChange={() => toggle(question.id)} aria-label={"Select " + question.vignette} className="mt-1"/><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><span className={"rounded-full px-2 py-0.5 text-[11px] font-bold capitalize " + (statusStyles[question.status] || statusStyles.draft)}>{question.status}</span><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{question.questionType === "STANDARD_MCQ" || !question.questionType ? (Array.isArray(question.correctAnswer) ? "SATA" : "Single best answer") : question.questionType.replaceAll("_", " ")}</span>{question.mediaCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-700 dark:text-violet-300"><ImageIcon size={10}/>{question.mediaCount}</span>}</div></div></div>
          <p className="line-clamp-3 min-h-[4.5rem] text-sm font-semibold leading-6">{question.vignette || "Untitled draft question"}</p>
          <div className="text-xs text-muted-foreground"><p className="truncate font-medium text-foreground/80">{question.module || "Unassigned module"}</p><p className="truncate">{question.subject || "Unassigned discipline"}</p></div>
          {question.validationIssues.length ? <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 shrink-0" size={13}/><span>{question.validationIssues.length} issue{question.validationIssues.length === 1 ? "" : "s"}: {question.validationIssues[0]}</span></div> : <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={14}/>Ready to publish</div>}
          <Link href={"/admin/mcq/" + question.id} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary/10 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"><SquarePen size={15}/>Open editor</Link>
        </div>
      </article>})}</div>}

    <div className="flex items-center justify-between"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-10 rounded-lg border border-border px-4 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-muted-foreground">Page {data.pagination.page} of {data.pagination.pages}</span><button disabled={page >= data.pagination.pages} onClick={() => setPage((value) => value + 1)} className="min-h-10 rounded-lg border border-border px-4 text-sm disabled:opacity-40">Next</button></div>

    {bulkOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={() => setBulkOpen(false)}><div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><div><h2 className="font-bold">Bulk actions</h2><p className="text-sm text-muted-foreground">{selected.size} selected questions</p></div><button onClick={() => setBulkOpen(false)} className="rounded-lg p-2 hover:bg-muted"><X size={18}/></button></div><div className="mt-5 grid gap-2 sm:grid-cols-2"><button onClick={() => void bulk("status", { status: "live" })} className="min-h-11 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white">Publish selected</button><button onClick={() => void bulk("status", { status: "draft" })} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold">Move to drafts</button><button onClick={() => void bulk("status", { status: "offline" })} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold">Take offline</button><button onClick={() => void bulk("duplicate")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"><Copy size={15}/>Duplicate</button><a href={"/api/admin/content/export?bank=mcq&format=json"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"><FileDown size={15}/>Export bank</a><button onClick={() => void bulk("delete")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-destructive/10 px-3 text-sm font-semibold text-destructive"><Trash2 size={15}/>Delete selected</button></div></div></div>}
  </div>
}
