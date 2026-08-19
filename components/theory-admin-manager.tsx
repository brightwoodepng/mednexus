"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowDown, ArrowUp, BookOpen, Database, FileUp, FolderTree, Grid2X2, History, ImagePlus, LayoutList, Link2, Plus, RefreshCw, Save, Search, Settings2, Trash2, X } from "lucide-react"
import { TheoryBulkImporter } from "@/components/theory-bulk-importer"
import { TheoryQuestionMedia } from "@/components/theory-question-media"
import type { TheoryMediaItem } from "@/lib/theory-media"

type Status = "draft" | "review" | "published" | "archived"
type Collection = { id: string; title: string; slug: string; kind: "end_of_module" | "end_of_year"; status: Status; sortOrder: number }
type Group = { id: string; collectionId: string; name: string; description?: string; sortOrder: number }
type SetRow = { id: string; collectionId: string; moduleId: string | null; disciplineId: string | null; name: string; description: string; status: Status; questionLimit: number; questionCount: number }
type QuestionRow = {
  id: string; collectionId: string; moduleId: string | null; disciplineId: string | null; setId: string | null
  collectionTitle: string; moduleName: string | null; disciplineName: string | null; setTitle: string | null
  title: string; prompt: string; modelAnswer: string; keyMarkingPoints: string[]; marks: number | null
  media: TheoryMediaItem[]; tags: string[]; sourceMetadata: { sourceTitle?: string; pastPaper?: string; year?: number; reference?: string }
  difficulty: number; estimatedStudyMinutes: number; status: Status; sortOrder: number
}
type AdminData = {
  collections: Collection[]; modules: Group[]; disciplines: Group[]; sets: SetRow[]; questions: QuestionRow[]
  total: number; settings: { defaultSetSize: number }
  page: number; pageSize: number; counts: Record<Status, number>; updatedAt: string
  audit: Array<{ id: number; action: string; resourceType: string; resourceId: string | null; createdAt: string }>
}
type Tab = "hierarchy" | "questions" | "import" | "settings" | "audit"

const card = "rounded-2xl border border-border bg-card p-5 shadow-sm"
const control = "min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25"
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition"

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? "Request failed.")
  return data as T
}

export function TheoryAdminManager({ initialTab = "questions" }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [data, setData] = useState<AdminData | null>(null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [collectionFilter, setCollectionFilter] = useState("")
  const [unassigned, setUnassigned] = useState(false)
  const [collectionKind, setCollectionKind] = useState<Collection["kind"]>("end_of_module")
  const [moduleFilter, setModuleFilter] = useState("")
  const [disciplineFilter, setDisciplineFilter] = useState("")
  const [setFilter, setSetFilter] = useState("")
  const [sort, setSort] = useState("updated")
  const [page, setPage] = useState(1)
  const [layout, setLayout] = useState<"list" | "grid">("list")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("kind") === "end_of_year") setCollectionKind("end_of_year")
    if (params.get("status")) setStatus(params.get("status") ?? "")
    if (params.get("unassigned") === "true") setUnassigned(true)
    const saved = window.localStorage.getItem("mednexus-admin-theory-layout")
    if (saved === "grid" || saved === "list") setLayout(saved)
  }, [])
  useEffect(() => { window.localStorage.setItem("mednexus-admin-theory-layout", layout) }, [layout])

  const load = useCallback(async (signal?: AbortSignal) => {
    setError("")
    const params = new URLSearchParams({ q: query, kind: collectionKind })
    if (status) params.set("status", status)
    if (collectionFilter) params.set("collectionId", collectionFilter)
    if (moduleFilter) params.set("moduleId", moduleFilter)
    if (disciplineFilter) params.set("disciplineId", disciplineFilter)
    if (setFilter) params.set("setId", setFilter)
    params.set("sort", sort); params.set("page", String(page)); params.set("pageSize", "25")
    if (unassigned) params.set("unassigned", "true")
    try { setData(await request<AdminData>(`/api/admin/theory?${params}`, { signal })) }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Unable to load Theory administration.") }
  }, [collectionFilter, collectionKind, disciplineFilter, moduleFilter, page, query, setFilter, sort, status, unassigned])

  const chooseKind = (next: Collection["kind"]) => {
    setCollectionKind(next); setCollectionFilter(""); setModuleFilter(""); setDisciplineFilter(""); setSetFilter(""); setUnassigned(false); setPage(1)
    const url = new URL(window.location.href); url.searchParams.set("kind", next); url.searchParams.delete("unassigned"); window.history.replaceState({}, "", url)
  }

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => void load(controller.signal), 200)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [load])

  const change = async (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) => {
    setError(""); setNotice("")
    try {
      await request("/api/admin/theory", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      setNotice(success); await load(); return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save."); return false }
  }

  if (!data) return <div className={`${card} py-16 text-center text-sm text-muted-foreground`}>{error || "Loading Theory administrationâ€¦"}</div>
  const tabs: Array<[Tab, string, typeof BookOpen]> = [["hierarchy","Curriculum",FolderTree],["questions","Questions",BookOpen],["import","Import",FileUp],["settings","Settings",Settings2],["audit","Audit",History]]
  return <div className="space-y-5 pb-12">
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Content</p><h1 className="mt-1 text-3xl font-bold">Theory Vault</h1><p className="mt-1 text-sm text-muted-foreground">Manage the authoritative long-answer question bank.</p></div><div className="grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1" aria-label="Theory category"><button onClick={() => chooseKind("end_of_module")} aria-pressed={collectionKind==="end_of_module"} className={`${button} min-h-9 px-4 ${collectionKind==="end_of_module"?"bg-background shadow-sm":"text-muted-foreground"}`}>End of Module</button><button onClick={() => chooseKind("end_of_year")} aria-pressed={collectionKind==="end_of_year"} className={`${button} min-h-9 px-4 ${collectionKind==="end_of_year"?"bg-background shadow-sm":"text-muted-foreground"}`}>End of Year</button></div></header>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[["All",Object.values(data.counts).reduce((a,b)=>a+b,0)],["Draft",data.counts.draft||0],["In review",data.counts.review||0],["Published",data.counts.published||0],["Archived",data.counts.archived||0]].map(([label,value]) => <button key={label} onClick={() => {setStatus(label==="All"?"":label==="In review"?"review":String(label).toLowerCase());setPage(1)}} className={`${card} p-4 text-left ${status===(label==="All"?"":label==="In review"?"review":String(label).toLowerCase())?"border-primary ring-1 ring-primary/20":""}`}><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></button>)}</section>
    <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2">{tabs.map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`${button} shrink-0 ${tab===id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Icon size={16}/>{label}</button>)}</nav>
    {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">{notice}</div>}
    {tab === "questions" && <QuestionAdmin data={data} query={query} setQuery={value=>{setQuery(value);setPage(1)}} status={status} setStatus={setStatus} collectionFilter={collectionFilter} setCollectionFilter={setCollectionFilter} unassigned={unassigned} setUnassigned={setUnassigned} moduleFilter={moduleFilter} setModuleFilter={setModuleFilter} disciplineFilter={disciplineFilter} setDisciplineFilter={setDisciplineFilter} setFilter={setFilter} setSetFilter={setSetFilter} sort={sort} setSort={setSort} page={page} setPage={setPage} layout={layout} setLayout={setLayout} refresh={()=>load()} change={change}/>}
    {tab === "hierarchy" && <HierarchyAdmin data={data} change={change}/>}
    {tab === "import" && (
      <TheoryBulkImporter collectionKind={collectionKind} defaultSetSize={data.settings.defaultSetSize} onImported={load} onReviewImported={() => { setStatus("draft"); setTab("questions") }}/>
    )}
    {tab === "settings" && <SettingsAdmin value={data.settings.defaultSetSize} change={change}/>}
    {tab === "audit" && <Audit items={data.audit}/>}
  </div>
}

function HierarchyAdmin({ data, change }: { data: AdminData; change: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [collectionId, setCollectionId] = useState(data.collections[0]?.id ?? "")
  const collection = data.collections.find(item => item.id === collectionId)
  const groups = collection?.kind === "end_of_module" ? data.modules : data.disciplines
  const collectionGroups = groups.filter(item => item.collectionId === collectionId)
  const [groupId, setGroupId] = useState(collectionGroups[0]?.id ?? "")
  const [groupName, setGroupName] = useState("")
  const sets = data.sets.filter(item => item.collectionId === collectionId && (item.moduleId === groupId || item.disciplineId === groupId))
  useEffect(() => {
    const nextCollection = data.collections.find(item => item.id === collectionId)
    const nextGroups = (nextCollection?.kind === "end_of_module" ? data.modules : data.disciplines).filter(item => item.collectionId === collectionId)
    if (!nextGroups.some(item => item.id === groupId)) setGroupId(nextGroups[0]?.id ?? "")
  }, [collectionId, data.collections, data.disciplines, data.modules, groupId])
  return <div className="grid gap-5 xl:grid-cols-[360px_1fr]"><aside className={`${card} space-y-5`}><div><p className="text-xs font-bold uppercase tracking-wider text-primary">{collection?.title}</p><h2 className="mt-1 font-bold">Add {collection?.kind === "end_of_module" ? "module" : "discipline"}</h2><p className="mt-2 text-sm text-muted-foreground">Top-level Theory categories and numbered sets are controlled by the system.</p><input value={groupName} onChange={event => setGroupName(event.target.value)} placeholder={collection?.kind === "end_of_module" ? "Module name" : "Discipline name"} className={`${control} mt-3 w-full`}/><button onClick={async () => { const resource=collection?.kind === "end_of_module" ? "module" : "discipline"; if(await change("POST",{resource,collectionId,name:groupName},"Study group created.")) setGroupName("") }} className={`${button} mt-2 w-full border border-border`}><Plus size={16}/>Add group</button></div></aside>
    <section className="space-y-5"><div className={card}><h2 className="font-bold">Curriculum tree</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={collectionId} onChange={event => setCollectionId(event.target.value)} className={control}>{data.collections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><select value={groupId} onChange={event => setGroupId(event.target.value)} className={control}>{collectionGroups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
      {sets.length ? <div className="grid gap-3 md:grid-cols-2">{sets.map((set,index) => <article key={set.id} className={card}><p className="text-xs font-semibold text-primary">System-managed set {index+1}</p><h3 className="mt-2 font-bold">Set {index+1}</h3><p className="mt-1 text-sm text-muted-foreground">{set.questionCount}/{set.questionLimit} questions · {set.status}</p></article>)}</div> : <div className={`${card} text-sm text-muted-foreground`}>Sets will be created automatically when questions are imported into this study group.</div>}
    </section></div>
}

function QuestionAdmin({ data, query, setQuery, status, setStatus, collectionFilter, setCollectionFilter, unassigned, setUnassigned, moduleFilter, setModuleFilter, disciplineFilter, setDisciplineFilter, setFilter, setSetFilter, sort, setSort, page, setPage, layout, setLayout, refresh, change }: {
  data: AdminData; query: string; setQuery: (value: string) => void; status: string; setStatus: (value: string) => void
  collectionFilter: string; setCollectionFilter: (value: string) => void
  unassigned: boolean; setUnassigned: (value: boolean) => void
  moduleFilter: string; setModuleFilter: (value: string) => void; disciplineFilter: string; setDisciplineFilter: (value: string) => void
  setFilter: string; setSetFilter: (value: string) => void; sort: string; setSort: (value: string) => void
  page: number; setPage: (value: number) => void; layout: "list" | "grid"; setLayout: (value: "list" | "grid") => void; refresh: () => void
  change: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) => Promise<boolean>
}) {
  const [active, setActive] = useState<QuestionRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [destinationSetId, setDestinationSetId] = useState("")
  const [bulkStatus, setBulkStatus] = useState("")
  const [scope, setScope] = useState<"page" | "filtered">("page")
  const move = async (question: QuestionRow, direction: -1 | 1) => {
    const siblings = data.questions.filter(item => item.setId === question.setId).sort((a,b) => a.sortOrder-b.sortOrder)
    const index = siblings.findIndex(item => item.id === question.id), target = siblings[index+direction]
    if (!target) return
    const ordered = [...siblings]; [ordered[index],ordered[index+direction]]=[ordered[index+direction],ordered[index]]
    await change("PATCH",{action:"reorder",orderedIds:ordered.map(item=>item.id)},"Question order updated.")
  }
  const assignSelected = async () => {
    if (!destinationSetId || !selected.length) return
    if (await change("PATCH",{action:"move",questionIds:selected,setId:destinationSetId},`${selected.length} questions assigned to a set.`)) {
      setSelected([])
      setDestinationSetId("")
    }
  }
  const applyBulk = async () => {
    const selectedScope = scope === "page" ? { ids: selected } : { all:true, query, status, collectionId:collectionFilter, moduleId:moduleFilter, disciplineId:disciplineFilter, setId:setFilter }
    if (await change("PATCH", { action:"bulk", operation:bulkStatus, scope:selectedScope }, "Bulk action completed.")) { setSelected([]); setBulkStatus("") }
  }
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize))
  return <div className="space-y-5"><section className={card}><div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4"><label className="flex items-center gap-2 rounded-xl border border-border px-3 lg:col-span-2"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search title or question text" className="min-h-11 w-full bg-transparent text-sm outline-none"/></label><select value={collectionFilter} onChange={event => {setCollectionFilter(event.target.value);setModuleFilter("");setDisciplineFilter("");setSetFilter("")}} className={control}><option value="">All collections</option>{data.collections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value)} className={control}><option value="">All statuses</option><option value="draft">Draft</option><option value="review">In review</option><option value="published">Published</option><option value="archived">Archived</option></select><select value={moduleFilter} onChange={event => setModuleFilter(event.target.value)} className={control}><option value="">All modules</option>{data.modules.filter(item=>!collectionFilter||item.collectionId===collectionFilter).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={disciplineFilter} onChange={event => setDisciplineFilter(event.target.value)} className={control}><option value="">All disciplines</option>{data.disciplines.filter(item=>!collectionFilter||item.collectionId===collectionFilter).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={setFilter} onChange={event => setSetFilter(event.target.value)} className={control}><option value="">All sets</option>{data.sets.filter(item=>!collectionFilter||item.collectionId===collectionFilter).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={sort} onChange={event => setSort(event.target.value)} className={control}><option value="updated">Recently updated</option><option value="oldest">Oldest updated</option><option value="title">Title A-Z</option></select></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{data.total} matching · Updated {new Date(data.updatedAt).toLocaleTimeString()}</p><div className="flex gap-2"><button onClick={refresh} aria-label="Refresh questions" className="rounded-lg border border-border p-2"><RefreshCw size={16}/></button><button onClick={()=>setLayout("list")} aria-label="List view" className={`rounded-lg border p-2 ${layout==="list"?"border-primary text-primary":"border-border"}`}><LayoutList size={16}/></button><button onClick={()=>setLayout("grid")} aria-label="Grid view" className={`rounded-lg border p-2 ${layout==="grid"?"border-primary text-primary":"border-border"}`}><Grid2X2 size={16}/></button><button onClick={() => { setCreating(true); setActive(null) }} className={`${button} bg-primary text-primary-foreground`}><Plus size={16}/>New question</button></div></div></section>
    <section className={`${card} flex flex-wrap items-center gap-3`}><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={data.questions.length > 0 && selected.length === data.questions.length} onChange={event => setSelected(event.target.checked ? data.questions.map(item => item.id) : [])} className="size-4 accent-primary"/>Select page</label><select value={scope} onChange={event=>setScope(event.target.value as "page"|"filtered")} className={control}><option value="page">Selected page ({selected.length})</option><option value="filtered">All filtered results ({data.total})</option></select><select value={bulkStatus} onChange={event=>setBulkStatus(event.target.value)} className={control}><option value="">Bulk status</option><option value="draft">Draft</option><option value="review">In review</option><option value="published">Published / restore</option><option value="archived">Archive</option></select><button disabled={!bulkStatus||(scope==="page"&&!selected.length)} onClick={applyBulk} className={`${button} border border-border disabled:opacity-40`}>Apply</button><select value={destinationSetId} onChange={event => setDestinationSetId(event.target.value)} className={`${control} min-w-56 flex-1`}><option value="">Destination set</option>{data.sets.filter(item => item.status !== "archived").map(item => <option key={item.id} value={item.id}>{item.name} ({item.questionCount}/{item.questionLimit})</option>)}</select><button disabled={!selected.length || !destinationSetId} onClick={assignSelected} className={`${button} bg-primary text-primary-foreground disabled:opacity-50`}>Assign selected to set</button></section>
    {(creating || active) && <QuestionForm question={active} data={data} onClose={() => {setActive(null);setCreating(false)}} change={change}/>}
    <section className={`overflow-hidden rounded-2xl border border-border bg-card ${layout==="grid"?"p-3":""}`}><div className={layout==="list"?"hidden grid-cols-[36px_1fr_150px_110px_100px] gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground lg:grid":"hidden"}><span/><span>Question</span><span>Set</span><span>Status</span><span>Order</span></div><div className={layout==="grid"?"grid gap-3 sm:grid-cols-2 xl:grid-cols-3":"divide-y divide-border"}>{data.questions.map(question => <article key={question.id} className={layout==="grid"?"grid gap-3 rounded-xl border border-border p-4":"grid gap-3 px-4 py-4 lg:grid-cols-[36px_1fr_150px_110px_100px] lg:items-center"}><input type="checkbox" aria-label={`Select ${question.title}`} checked={selected.includes(question.id)} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current, question.id])] : current.filter(id => id !== question.id))} className="size-4 accent-primary"/><button onClick={() => { setActive(question); setCreating(false) }} className="text-left"><p className="font-semibold">{question.title}</p><p className="mt-1 text-xs text-muted-foreground">{question.collectionTitle} · {[question.moduleName,question.disciplineName].filter(Boolean).join(" · ")} · {question.marks ?? 0} marks</p></button><span className="text-sm text-muted-foreground">{question.setTitle ?? "Unassigned"}</span><span className="w-fit rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{question.status}</span><span className="flex gap-1"><button onClick={() => move(question,-1)} aria-label="Move up" className="rounded-lg border border-border p-2"><ArrowUp size={15}/></button><button onClick={() => move(question,1)} aria-label="Move down" className="rounded-lg border border-border p-2"><ArrowDown size={15}/></button></span></article>)}</div></section>
    <nav aria-label="Question pages" className="flex items-center justify-between"><button disabled={page<=1} onClick={()=>setPage(page-1)} className={`${button} border border-border disabled:opacity-40`}>Previous</button><span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(page+1)} className={`${button} border border-border disabled:opacity-40`}>Next</button></nav>
  </div>
}

function QuestionForm({ question, data, onClose, change }: { question: QuestionRow | null; data: AdminData; onClose: () => void; change: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [collectionId, setCollectionId] = useState(question?.collectionId ?? data.collections[0]?.id ?? "")
  const collection = data.collections.find(item => item.id === collectionId)
  const groups = (collection?.kind === "end_of_module" ? data.modules : data.disciplines).filter(item => item.collectionId === collectionId)
  const relatedDisciplines = data.disciplines.filter(item => item.collectionId === collectionId)
  const [groupId, setGroupId] = useState(question?.moduleId ?? question?.disciplineId ?? groups[0]?.id ?? "")
  const [relatedDisciplineId, setRelatedDisciplineId] = useState(question?.moduleId ? question.disciplineId ?? "" : "")
  const sets = data.sets.filter(item => item.collectionId === collectionId && (item.moduleId === groupId || item.disciplineId === groupId))
  const [setId, setSetId] = useState(question?.setId ?? "")
  const [title, setTitle] = useState(question?.title ?? "")
  const [prompt, setPrompt] = useState(question?.prompt ?? "")
  const [modelAnswer, setModelAnswer] = useState(question?.modelAnswer ?? "")
  const [points, setPoints] = useState(question?.keyMarkingPoints.join("\n") ?? "")
  const [tags, setTags] = useState(question?.tags.join(", ") ?? "")
  const [media, setMedia] = useState<TheoryMediaItem[]>(question?.media ?? [])
  const [difficulty, setDifficulty] = useState(question?.difficulty ?? 3)
  const [estimatedStudyMinutes, setEstimatedStudyMinutes] = useState(question?.estimatedStudyMinutes ?? 8)
  const [sourceTitle, setSourceTitle] = useState(question?.sourceMetadata?.sourceTitle ?? "")
  const [pastPaper, setPastPaper] = useState(question?.sourceMetadata?.pastPaper ?? "")
  const [sourceYear, setSourceYear] = useState(question?.sourceMetadata?.year ? String(question.sourceMetadata.year) : "")
  const [status, setStatus] = useState<Status>(question?.status ?? "draft")
  useEffect(() => { if (!groups.some(item => item.id === groupId)) setGroupId(groups[0]?.id ?? "") }, [collectionId, groupId, groups])
  const save = async () => {
    const payload = { collectionId, moduleId:collection?.kind==="end_of_module"?groupId:null, disciplineId:collection?.kind==="end_of_year"?groupId:relatedDisciplineId||null, setId:setId||null, title,prompt,modelAnswer,keyMarkingPoints:points.split("\n").map(x=>x.trim()).filter(Boolean),tags:tags.split(",").map(x=>x.trim()).filter(Boolean),media,difficulty,estimatedStudyMinutes,sourceMetadata:{sourceTitle,pastPaper,year:sourceYear?Number(sourceYear):undefined},status }
    const ok = question ? await change("PATCH",{resource:"question",id:question.id,...payload},"Question updated.") : await change("POST",{resource:"question",...payload},"Question created.")
    if (ok) onClose()
  }
  return <section className={card}><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">{question ? "Edit question" : "New question"}</p><h2 className="mt-1 text-xl font-bold">{question?.title || "Create Theory question"}</h2></div><button onClick={onClose} className="text-sm font-bold text-muted-foreground">Close</button></div><div className={`mt-5 grid gap-4 ${collection?.kind==="end_of_module" ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}><label className="text-xs font-bold text-muted-foreground">Category<select value={collectionId} onChange={event => { setCollectionId(event.target.value); setRelatedDisciplineId("") }} className={`${control} mt-1 w-full text-foreground`}>{data.collections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="text-xs font-bold text-muted-foreground">{collection?.kind==="end_of_module"?"Module":"Discipline"}<select value={groupId} onChange={event => setGroupId(event.target.value)} className={`${control} mt-1 w-full text-foreground`}>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{collection?.kind==="end_of_module" && <label className="text-xs font-bold text-muted-foreground">Related discipline (optional)<select value={relatedDisciplineId} onChange={event => setRelatedDisciplineId(event.target.value)} className={`${control} mt-1 w-full text-foreground`}><option value="">No related discipline</option>{relatedDisciplines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label className="text-xs font-bold text-muted-foreground">Set<select value={setId} onChange={event => setSetId(event.target.value)} className={`${control} mt-1 w-full text-foreground`}><option value="">Unassigned</option>{sets.map(item => <option key={item.id} value={item.id}>{item.name} ({item.questionCount}/{item.questionLimit})</option>)}</select></label></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_180px]"><label className="text-xs font-bold text-muted-foreground">Short title<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Generated from the prompt when blank" className={`${control} mt-1 w-full text-foreground`}/></label><label className="text-xs font-bold text-muted-foreground">Status<select value={status} onChange={event => setStatus(event.target.value as Status)} className={`${control} mt-1 w-full text-foreground`}><option value="draft">Draft</option><option value="review">In review</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
    <label className="mt-4 block text-xs font-bold text-muted-foreground">Question prompt<textarea rows={4} value={prompt} onChange={event => setPrompt(event.target.value)} className={`${control} mt-1 w-full py-3 font-normal text-foreground`}/></label><label className="mt-4 block text-xs font-bold text-muted-foreground">Model answer (Markdown)<textarea rows={10} value={modelAnswer} onChange={event => setModelAnswer(event.target.value)} className={`${control} mt-1 w-full py-3 font-mono font-normal text-foreground`}/></label><label className="mt-4 block text-xs font-bold text-muted-foreground">Key points (one per line)<textarea rows={5} value={points} onChange={event => setPoints(event.target.value)} className={`${control} mt-1 w-full py-3 font-normal text-foreground`}/><span className="mt-2 block text-xs text-primary">{points.split("\n").filter(point => point.trim()).length * 2} marks calculated by the system</span></label><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-bold text-muted-foreground">Difficulty<select value={difficulty} onChange={event=>setDifficulty(Number(event.target.value))} className={`${control} mt-1 w-full text-foreground`}>{[1,2,3,4,5].map(value=><option key={value} value={value}>{value}</option>)}</select></label><label className="text-xs font-bold text-muted-foreground">Estimated study time (minutes)<input type="number" min={1} max={180} value={estimatedStudyMinutes} onChange={event=>setEstimatedStudyMinutes(Number(event.target.value))} className={`${control} mt-1 w-full text-foreground`}/></label></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><label className="text-xs font-bold text-muted-foreground">Source title<input value={sourceTitle} onChange={event=>setSourceTitle(event.target.value)} className={`${control} mt-1 w-full text-foreground`}/></label><label className="text-xs font-bold text-muted-foreground">Past paper<input value={pastPaper} onChange={event=>setPastPaper(event.target.value)} className={`${control} mt-1 w-full text-foreground`}/></label><label className="text-xs font-bold text-muted-foreground">Year<input type="number" value={sourceYear} onChange={event=>setSourceYear(event.target.value)} className={`${control} mt-1 w-full text-foreground`}/></label></div><label className="mt-4 block text-xs font-bold text-muted-foreground">Tags (comma separated)<input value={tags} onChange={event => setTags(event.target.value)} className={`${control} mt-1 w-full text-foreground`}/></label><TheoryMediaEditor media={media} onChange={setMedia}/><div className="mt-5 flex flex-wrap justify-between gap-3">{question?.status==="draft" ? <button onClick={async()=>{if(await change("DELETE",{resource:"question",id:question.id},"Draft deleted."))onClose()}} className={`${button} border border-destructive/30 text-destructive`}><Trash2 size={16}/>Delete draft</button>:<span/>}<button onClick={save} className={`${button} bg-primary text-primary-foreground`}><Save size={16}/>{question?"Save changes":"Create question"}</button></div>
  </section>
}

function TheoryMediaEditor({ media, onChange }: { media: TheoryMediaItem[]; onChange: (media: TheoryMediaItem[]) => void }) {
  const [url, setUrl] = useState("")
  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).slice(0, Math.max(0, 6 - media.length))
    if (valid.some(file => !["image/png","image/jpeg","image/webp"].includes(file.type))) {
      window.alert("Theory images must be PNG, JPEG, or WebP.")
      return
    }
    if (valid.some(file => file.size > 4 * 1024 * 1024)) {
      window.alert("Each Theory image must be 4 MB or smaller.")
      return
    }
    const uploaded = await Promise.all(valid.map(file => new Promise<TheoryMediaItem>((resolve, reject) => {
      const reader = new FileReader()
      reader.onerror = () => reject(new Error(`Unable to read ${file.name}.`))
      reader.onload = () => resolve({ type: "image", url: String(reader.result), alt: file.name.replace(/\.[^.]+$/, "") })
      reader.readAsDataURL(file)
    })))
    onChange([...media, ...uploaded].slice(0, 6))
  }
  const addUrl = () => {
    const next = url.trim()
    if (!/^https:\/\//i.test(next) && !next.startsWith("/")) {
      window.alert("Use an HTTPS image URL or an internal image path.")
      return
    }
    onChange([...media, { type: "image" as const, url: next, alt: "" }].slice(0, 6))
    setUrl("")
  }
  return <section className="mt-4 rounded-xl border border-border bg-muted/15 p-4"><div className="flex items-center gap-2"><ImagePlus size={17} className="text-primary"/><h3 className="text-sm font-bold">Question images</h3><span className="text-xs text-muted-foreground">{media.length}/6</span></div><p className="mt-1 text-xs text-muted-foreground">Images appear with the prompt in both Review and Practice modes.</p>{media.length > 0 && <div className="mt-4"><TheoryQuestionMedia media={media} compact/><div className="mt-3 space-y-2">{media.map((item,index) => <div key={`${item.url.slice(0,30)}-${index}`} className="flex items-center gap-2"><input value={item.alt ?? ""} onChange={event => onChange(media.map((entry,itemIndex) => itemIndex===index ? {...entry,alt:event.target.value} : entry))} placeholder={`Alt text for image ${index+1}`} className={`${control} min-w-0 flex-1`}/><button type="button" onClick={() => onChange(media.filter((_,itemIndex) => itemIndex!==index))} aria-label={`Remove image ${index+1}`} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><X size={16}/></button></div>)}</div></div>}<div className="mt-4 flex flex-col gap-3 sm:flex-row"><label className={`${button} cursor-pointer border border-border ${media.length>=6 ? "pointer-events-none opacity-40" : ""}`}><ImagePlus size={16}/>Upload images<input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={media.length>=6} onChange={event => { void addFiles(event.target.files); event.currentTarget.value="" }}/></label><div className="flex min-w-0 flex-1 gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3"><Link2 size={15} className="shrink-0 text-muted-foreground"/><input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://… image URL" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"/></label><button type="button" onClick={addUrl} disabled={!url.trim()||media.length>=6} className={`${button} border border-border disabled:opacity-40`}>Add</button></div></div></section>
}

function SettingsAdmin({ value, change }: { value: number; change: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [size, setSize] = useState(value)
  return <div className="grid max-w-4xl gap-5 lg:grid-cols-2"><section className={card}><h2 className="text-xl font-bold">Set assignment</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">New questions without a selected set are assigned to the next set with capacity. When every set is full, a new set is created automatically.</p><label className="mt-5 block text-sm font-bold">Default set size<select value={size} onChange={event => setSize(Number(event.target.value))} className={`${control} mt-2 w-full`}>{[15,16,17,18,19,20].map(value => <option key={value}>{value}</option>)}</select></label><button onClick={() => change("PATCH",{action:"settings",defaultSetSize:size},"Theory settings saved.")} className={`${button} mt-4 bg-primary text-primary-foreground`}><Save size={16}/>Save settings</button></section>
    <section className={card}><div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><Database size={20}/></span><div><h2 className="text-xl font-bold">Test content</h2><p className="text-xs font-semibold text-primary">24 questions Â· 6 sets</p></div></div><p className="mt-4 text-sm leading-6 text-muted-foreground">Load published End-of-Module teaching questions and End-of-Year exam questions to test search, review, practice, progress, notes, bookmarks, revision, and export. Running this again updates the same sample records without duplicates.</p><button onClick={() => { if (window.confirm("Load or refresh the 24 Theory test questions? Existing non-demo content will not be changed.")) void change("POST",{resource:"demo_seed"},"24 Theory test questions are ready.") }} className={`${button} mt-4 border border-primary/30 text-primary`}><Database size={16}/>Load test content</button></section>
  </div>
}

function Audit({ items }: { items: AdminData["audit"] }) {
  return <section className={card}><h2 className="text-xl font-bold">Recent Theory activity</h2>{items.length ? <div className="mt-4 divide-y divide-border">{items.map(item => <div key={item.id} className="grid gap-1 py-3 sm:grid-cols-[160px_1fr_auto] sm:items-center"><b className="capitalize">{item.action.replaceAll("_"," ")}</b><span className="text-sm text-muted-foreground">{item.resourceType} {item.resourceId ? `Â· ${item.resourceId}` : ""}</span><time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">No Theory administration changes have been recorded yet.</p>}</section>
}

