"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, CheckCircle2, ChevronDown, Copy, Download, Filter, Grid2X2, ImageIcon, List, Loader2, Move, Plus, RefreshCw, Search, SquarePen, Tags, Trash2, Upload, X } from "lucide-react"
import type { Question } from "@/lib/types"

type ManagedStatus = "draft" | "review" | "live" | "offline" | "archived"
type ManagedQuestion = Question & { status: ManagedStatus; validationIssues: string[]; mediaCount: number }
type StatusCounts = Record<string, number>
type DisciplineCategory = { subject: string; count: number; statusCounts: StatusCounts }
type ModuleCategory = { module: string; count: number; statusCounts: StatusCounts; disciplines: DisciplineCategory[] }
type CategoryScope = { module: string; subject?: string; count: number; statusCounts: StatusCounts }
type ListResponse = { questions: ManagedQuestion[]; pagination: { page: number; pageSize: number; total: number; pages: number }; filters: { modules: string[]; subjects: string[]; categories: ModuleCategory[] }; counts: StatusCounts; updatedAt: string | null }
type Layout = "grid" | "list"
type Filters = { search: string; moduleName: string; subject: string; status: string; media: string; issues: boolean; sort: string }
type SavedView = { name: string; filters: Filters }

const statuses: ManagedStatus[] = ["live", "draft", "review", "offline", "archived"]
const emptyData: ListResponse = { questions: [], pagination: { page: 1, pageSize: 18, total: 0, pages: 1 }, filters: { modules: [], subjects: [], categories: [] }, counts: {}, updatedAt: null }
const emptyFilters: Filters = { search: "", moduleName: "", subject: "", status: "", media: "", issues: false, sort: "updated-desc" }
const preferenceKey = "mednexus.admin.mcq-manager-preferences.v1"
const statusStyles: Record<string, string> = { live: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", draft: "bg-amber-500/10 text-amber-700 dark:text-amber-300", review: "bg-sky-500/10 text-sky-700 dark:text-sky-300", offline: "bg-slate-500/10 text-slate-600 dark:text-slate-300", archived: "bg-rose-500/10 text-rose-700 dark:text-rose-300" }

async function responseBody(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try { return JSON.parse(text) as Record<string, unknown> }
  catch { return { error: "The server returned an unreadable response. Please retry." } }
}

export function McqModernWorkspace({ onOpenImporter }: { onOpenImporter: () => void }) {
  const router = useRouter()
  const requestRef = useRef<AbortController | null>(null)
  const [data, setData] = useState<ListResponse>(emptyData)
  const [filters, setFilters] = useState<Filters>(emptyFilters)
  const [layout, setLayout] = useState<Layout>("grid")
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scope, setScope] = useState<CategoryScope | null>(null)
  const [scopeModule, setScopeModule] = useState("")
  const [scopeSubject, setScopeSubject] = useState("")
  const [bulkOpen, setBulkOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [moveModule, setMoveModule] = useState("")
  const [moveSubject, setMoveSubject] = useState("")
  const [tagText, setTagText] = useState("")

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(preferenceKey) ?? "{}") as { layout?: Layout; views?: SavedView[] }
      if (saved.layout === "grid" || saved.layout === "list") setLayout(saved.layout)
      if (Array.isArray(saved.views)) setSavedViews(saved.views.slice(0, 8))
    } catch { /* Ignore invalid local preferences. */ }
  }, [])
  useEffect(() => { localStorage.setItem(preferenceKey, JSON.stringify({ layout, views: savedViews })) }, [layout, savedViews])

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters(current => ({ ...current, [key]: value }))
  const load = useCallback(async () => {
    requestRef.current?.abort()
    const controller = new AbortController(); requestRef.current = controller
    setLoading(true); setError("")
    const params = new URLSearchParams({ page: String(page), pageSize: "18", sort: filters.sort })
    if (filters.search.trim()) params.set("search", filters.search.trim())
    if (filters.moduleName) params.set("module", filters.moduleName)
    if (filters.subject) params.set("subject", filters.subject)
    if (filters.status) params.set("status", filters.status)
    if (filters.media) params.set("media", filters.media)
    if (filters.issues) params.set("issues", "with")
    try {
      const response = await fetch(`/api/admin/mcq/questions?${params}`, { cache: "no-store", signal: controller.signal })
      const body = await responseBody(response)
      if (!response.ok || !Array.isArray(body.questions)) throw new Error(String(body.error || "Unable to load the MCQ bank."))
      setData(body as unknown as ListResponse); setSelected(new Set())
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load the MCQ bank.") }
    finally { if (!controller.signal.aborted) setLoading(false) }
  }, [filters, page])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 220); return () => { window.clearTimeout(timer); requestRef.current?.abort() } }, [load])
  useEffect(() => { setPage(1) }, [filters])

  const allShownSelected = data.questions.length > 0 && data.questions.every(question => selected.has(question.id))
  const selectionCount = scope?.count ?? selected.size
  const activeFilterCount = Number(Boolean(filters.search)) + Number(Boolean(filters.moduleName)) + Number(Boolean(filters.subject)) + Number(Boolean(filters.status)) + Number(Boolean(filters.media)) + Number(filters.issues)
  const exportUrl = useMemo(() => {
    const params = new URLSearchParams({ bank: "mcq", format: "json" })
    if (scope) { params.set("module", scope.module); if (scope.subject) params.set("discipline", scope.subject) }
    else selected.forEach(id => params.append("id", id))
    return `/api/admin/content/export?${params}`
  }, [scope, selected])

  function toggle(id: string) { setScope(null); setSelected(current => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next }) }
  function selectShown() { setScope(null); setSelected(allShownSelected ? new Set() : new Set(data.questions.map(question => question.id))) }
  function clearFilters() { setFilters(emptyFilters); setPage(1) }
  function selectCategory() {
    const category = data.filters.categories.find(item => item.module === scopeModule)
    if (!category) return
    const discipline = category.disciplines.find(item => item.subject === scopeSubject)
    setSelected(new Set())
    setScope(discipline ? { module: category.module, subject: discipline.subject, count: discipline.count, statusCounts: discipline.statusCounts } : { module: category.module, count: category.count, statusCounts: category.statusCounts })
  }
  function saveView() {
    const name = window.prompt("Name this filter view")?.trim()
    if (name) setSavedViews(current => [...current.filter(view => view.name !== name), { name: name.slice(0, 40), filters }].slice(-8))
  }
  async function createQuestion() {
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/admin/mcq/questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ module: filters.moduleName, subject: filters.subject }) })
      const body = await responseBody(response)
      if (!response.ok || !body.question) throw new Error(String(body.error || "Unable to create a question."))
      router.push(`/admin/mcq/${(body.question as { id: string }).id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create a question."); setSaving(false) }
  }
  async function bulk(action: string, payload: Record<string, unknown> = {}) {
    if (!selectionCount) return
    if (action === "delete" && !window.confirm(`Permanently delete ${selectionCount} selected MCQs? This cannot be undone.`)) return
    setSaving(true); setError("")
    try {
      const selection = scope ? { scope: { module: scope.module, subject: scope.subject } } : { ids: [...selected] }
      const response = await fetch("/api/admin/mcq/questions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...selection, action, confirmation: action === "delete" ? "DELETE SELECTED MCQS" : undefined, ...payload }) })
      const body = await responseBody(response)
      if (!response.ok) throw new Error(String(body.error || "Bulk update failed."))
      setBulkOpen(false); setScope(null); setMoveModule(""); setMoveSubject(""); setTagText(""); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Bulk update failed.") }
    finally { setSaving(false) }
  }

  const summaryItems: Array<[string, number, () => void, boolean]> = [
    ["All", ["live", "draft", "review", "offline"].reduce((sum, key) => sum + Number(data.counts[key] ?? 0), 0), clearFilters, activeFilterCount === 0],
    ["Live", data.counts.live ?? 0, () => { clearFilters(); setFilter("status", "live") }, filters.status === "live"],
    ["Drafts", data.counts.draft ?? 0, () => { clearFilters(); setFilter("status", "draft") }, filters.status === "draft"],
    ["In review", data.counts.review ?? 0, () => { clearFilters(); setFilter("status", "review") }, filters.status === "review"],
    ["Archived", data.counts.archived ?? 0, () => { clearFilters(); setFilter("status", "archived") }, filters.status === "archived"],
    ["Needs attention", data.counts.issues ?? 0, () => { clearFilters(); setFilter("issues", true) }, filters.issues],
  ]

  const selectedCategory = data.filters.categories.find(item => item.module === scopeModule)
  const moveCategory = data.filters.categories.find(item => item.module === moveModule)

  return <div className="space-y-4">
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-6">
      {summaryItems.map(([label, count, action, active]) => <button key={label} onClick={action} aria-pressed={active} className={`rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow] ${active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card hover:border-primary/40"}`}><span className="text-xl font-bold tabular-nums">{count}</span><span className="mt-0.5 block text-xs font-medium text-muted-foreground">{label}</span></button>)}
    </section>

    <section className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16}/><input value={filters.search} onChange={event => setFilter("search", event.target.value)} placeholder="Search questions, modules, disciplines or tags" className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"/></div>
        <div className="grid grid-cols-2 gap-2 sm:flex"><button onClick={() => setFiltersOpen(open => !open)} aria-expanded={filtersOpen} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold lg:hidden"><Filter size={16}/>Filters{activeFilterCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{activeFilterCount}</span>}<ChevronDown size={14}/></button><button onClick={() => void load()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"><RefreshCw size={16}/>Refresh</button><button onClick={onOpenImporter} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"><Upload size={16}/>Import</button><button onClick={() => void createQuestion()} disabled={saving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}New question</button></div>
      </div>
      <div className={`${filtersOpen ? "grid" : "hidden"} gap-2 border-b border-border p-3 sm:grid-cols-2 lg:grid xl:grid-cols-6`}>
        <select value={filters.moduleName} onChange={event => setFilter("moduleName", event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All modules</option>{data.filters.modules.map(item => <option key={item}>{item}</option>)}</select>
        <select value={filters.subject} onChange={event => setFilter("subject", event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">All disciplines</option>{data.filters.subjects.map(item => <option key={item}>{item}</option>)}</select>
        <select value={filters.status} onChange={event => setFilter("status", event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Active statuses</option><option value="live">Live</option><option value="draft">Draft</option><option value="review">In review</option><option value="offline">Offline</option><option value="archived">Archived</option></select>
        <select value={filters.media} onChange={event => setFilter("media", event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Any media</option><option value="with">With images</option><option value="without">Without images</option></select>
        <select value={filters.sort} onChange={event => setFilter("sort", event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="updated-desc">Recently updated</option><option value="updated-asc">Oldest updated</option><option value="module">Module</option><option value="stem">Question stem</option></select>
        <button onClick={clearFilters} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border text-sm font-medium"><X size={15}/>Clear</button>
      </div>
      {(activeFilterCount > 0 || savedViews.length > 0) && <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-xs">{filters.issues && <button onClick={() => setFilter("issues", false)} className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-800 dark:text-amber-200">Needs attention ×</button>}{filters.status && <button onClick={() => setFilter("status", "")} className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{filters.status} ×</button>}{activeFilterCount > 0 && <button onClick={saveView} className="rounded-full border border-border px-2.5 py-1 font-semibold">Save view</button>}{savedViews.map(view => <span key={view.name} className="inline-flex overflow-hidden rounded-full border border-border"><button onClick={() => setFilters(view.filters)} className="px-2.5 py-1 font-semibold">{view.name}</button><button onClick={() => setSavedViews(items => items.filter(item => item.name !== view.name))} aria-label={`Delete ${view.name} view`} className="border-l border-border px-1.5"><X size={11}/></button></span>)}</div>}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={allShownSelected} onChange={selectShown}/><span>Select page</span></label><span className="text-muted-foreground">{data.pagination.total} questions · {selectionCount} selected{data.updatedAt ? ` · Updated ${new Date(data.updatedAt).toLocaleString()}` : ""}</span><div className="flex items-center gap-2"><div className="inline-flex rounded-lg border border-border p-0.5"><button onClick={() => setLayout("grid")} aria-label="Grid view" aria-pressed={layout === "grid"} className={`rounded-md p-2 ${layout === "grid" ? "bg-muted text-primary" : "text-muted-foreground"}`}><Grid2X2 size={15}/></button><button onClick={() => setLayout("list")} aria-label="List view" aria-pressed={layout === "list"} className={`rounded-md p-2 ${layout === "list" ? "bg-muted text-primary" : "text-muted-foreground"}`}><List size={15}/></button></div><button disabled={!selectionCount} onClick={() => setBulkOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-3 font-semibold disabled:opacity-40"><Filter size={15}/>Bulk actions</button></div></div>
      <div className="grid gap-2 border-t border-border p-3 sm:grid-cols-[1fr_1fr_auto]"><select value={scopeModule} onChange={event => { setScopeModule(event.target.value); setScopeSubject("") }} aria-label="Module to select" className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Select an entire module</option>{data.filters.categories.map(item => <option key={item.module} value={item.module}>{item.module} ({item.count})</option>)}</select><select value={scopeSubject} onChange={event => setScopeSubject(event.target.value)} disabled={!scopeModule} aria-label="Discipline to select" className="h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"><option value="">All disciplines in module</option>{selectedCategory?.disciplines.map(item => <option key={item.subject} value={item.subject}>{item.subject} ({item.count})</option>)}</select><button disabled={!scopeModule} onClick={selectCategory} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40">Select category</button></div>
      {scope && <div role="status" className="flex flex-wrap items-center gap-2 border-t border-primary/20 bg-primary/5 px-3 py-2 text-xs"><strong>{scope.subject ? `${scope.module} / ${scope.subject}` : scope.module}: {scope.count} questions</strong>{statuses.map(status => Number(scope.statusCounts[status] ?? 0) > 0 && <span key={status} className={`rounded-full px-2 py-0.5 capitalize ${statusStyles[status]}`}>{status}: {scope.statusCounts[status]}</span>)}<button onClick={() => setScope(null)} className="ml-auto font-semibold text-primary">Clear selection</button></div>}
    </section>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><span>{error}</span><button onClick={() => void load()} className="rounded-lg border border-destructive/30 px-3 py-1.5 font-semibold">Retry</button></div>}
    {loading ? <div role="status" className="flex min-h-72 items-center justify-center"><Loader2 className="animate-spin text-primary"/><span className="sr-only">Loading MCQ bank</span></div> : data.questions.length === 0 ? <div className="rounded-xl border border-dashed border-border p-12 text-center"><p className="font-semibold">No questions match this view.</p><p className="mt-1 text-sm text-muted-foreground">Adjust the filters, import questions, or create a draft.</p></div> : <div className={layout === "grid" ? "grid gap-3 md:grid-cols-2 2xl:grid-cols-3" : "space-y-2"}>{data.questions.map(question => <QuestionResult key={question.id} question={question} selected={selected.has(question.id)} layout={layout} onToggle={() => toggle(question.id)}/>)}</div>}
    <div className="flex items-center justify-between"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="min-h-10 rounded-lg border border-border px-4 text-sm disabled:opacity-40">Previous</button><span className="text-sm text-muted-foreground">Page {data.pagination.page} of {data.pagination.pages}</span><button disabled={page >= data.pagination.pages} onClick={() => setPage(value => value + 1)} className="min-h-10 rounded-lg border border-border px-4 text-sm disabled:opacity-40">Next</button></div>

    {bulkOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={() => setBulkOpen(false)}><div role="dialog" aria-modal="true" aria-label="MCQ bulk actions" className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between"><div><h2 className="font-bold">Bulk actions</h2><p className="text-sm text-muted-foreground">{selectionCount} selected questions{scope ? ` in ${scope.subject ?? scope.module}` : ""}</p></div><button onClick={() => setBulkOpen(false)} aria-label="Close bulk actions" className="rounded-lg p-2 hover:bg-muted"><X size={18}/></button></div><div className="mt-5 grid gap-2 sm:grid-cols-3"><button onClick={() => void bulk("status", { status: "live" })} className="min-h-11 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white">Publish</button><button onClick={() => void bulk("status", { status: "draft" })} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold">Draft</button><button onClick={() => void bulk("status", { status: "review" })} className="min-h-11 rounded-xl border border-sky-500/40 px-3 text-sm font-semibold text-sky-700 dark:text-sky-300">In review</button><button onClick={() => void bulk("status", { status: "offline" })} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold">Take offline</button><button onClick={() => void bulk("status", { status: "archived" })} className="min-h-11 rounded-xl border border-rose-500/40 px-3 text-sm font-semibold text-rose-700 dark:text-rose-300">Archive</button></div><div className="mt-4 rounded-xl border border-border p-3"><p className="flex items-center gap-2 text-sm font-semibold"><Move size={15}/>Reassign</p><div className="mt-2 grid gap-2 sm:grid-cols-2"><select value={moveModule} onChange={event => { setMoveModule(event.target.value); setMoveSubject("") }} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="">Keep current module</option>{data.filters.categories.map(item => <option key={item.module}>{item.module}</option>)}</select><select value={moveSubject} onChange={event => setMoveSubject(event.target.value)} disabled={!moveModule} className="h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-50"><option value="">Keep current discipline</option>{moveCategory?.disciplines.map(item => <option key={item.subject}>{item.subject}</option>)}</select></div><button disabled={!moveModule.trim() && !moveSubject.trim()} onClick={() => void bulk("move", { module: moveModule, subject: moveSubject })} className="mt-2 min-h-10 w-full rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">Apply destination</button></div><div className="mt-3 rounded-xl border border-border p-3"><p className="flex items-center gap-2 text-sm font-semibold"><Tags size={15}/>Replace tags</p><input value={tagText} onChange={event => setTagText(event.target.value)} placeholder="cardiology, high-yield" className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"/><button onClick={() => void bulk("tags", { tags: tagText.split(",").map(tag => tag.trim()).filter(Boolean) })} className="mt-2 min-h-10 w-full rounded-lg border border-border px-3 text-sm font-semibold">Apply tags</button></div><div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={() => void bulk("duplicate")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"><Copy size={15}/>Duplicate</button><a href={exportUrl} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold"><Download size={15}/>Export selected</a><button onClick={() => void bulk("delete")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-destructive/10 px-3 text-sm font-semibold text-destructive sm:col-span-2"><Trash2 size={15}/>Permanently delete</button></div></div></div>}
  </div>
}

function QuestionResult({ question, selected, layout, onToggle }: { question: ManagedQuestion; selected: boolean; layout: Layout; onToggle: () => void }) {
  const mediaItem = question.media?.find(asset => asset.placement === "stem")
  const preview = mediaItem?.url || question.mediaBase64 || ""
  return <article className={`overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-md ${layout === "list" ? "flex min-h-32" : ""}`}>{preview ? <div className={`${layout === "list" ? "hidden w-36 sm:block" : "h-32"} shrink-0 overflow-hidden bg-muted`}><img src={preview} alt={mediaItem?.alt || "Question image"} className="h-full w-full object-cover"/></div> : layout === "grid" && <div className="flex h-16 items-center justify-center bg-primary/5"><ImageIcon className="text-primary/40"/></div>}<div className={`flex min-w-0 flex-1 flex-col gap-2 p-3 ${layout === "list" ? "sm:flex-row sm:items-center" : ""}`}><input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${question.vignette}`} className="shrink-0"/><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusStyles[question.status]}`}>{question.status}</span>{question.mediaCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-700 dark:text-violet-300"><ImageIcon size={10}/>{question.mediaCount}</span>}</div><p className={`${layout === "grid" ? "mt-2 line-clamp-3 min-h-[3.75rem]" : "mt-1 line-clamp-2"} text-sm font-semibold leading-5`}>{question.vignette || "Untitled draft question"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{question.module || "Unassigned module"} · {question.subject || "Unassigned discipline"}</p>{question.validationIssues.length ? <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle size={13}/>{question.validationIssues.length} issue{question.validationIssues.length === 1 ? "" : "s"}: {question.validationIssues[0]}</p> : <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={13}/>Ready to publish</p>}</div><Link href={`/admin/mcq/${question.id}`} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-foreground"><SquarePen size={15}/>Open</Link></div></article>
}
