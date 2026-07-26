"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowDown, ArrowUp, BookOpen, Database, FileUp, FolderTree, History, ImagePlus, Link2, Plus, Save, Search, Settings2, Trash2, X } from "lucide-react"
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
  referencesMd: string; media: TheoryMediaItem[]; tags: string[]; status: Status; sortOrder: number
}
type AdminData = {
  collections: Collection[]; modules: Group[]; disciplines: Group[]; sets: SetRow[]; questions: QuestionRow[]
  total: number; settings: { defaultSetSize: number }
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
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setError("")
    const params = new URLSearchParams({ q: query })
    if (status) params.set("status", status)
    if (collectionFilter) params.set("collectionId", collectionFilter)
    try { setData(await request<AdminData>(`/api/admin/theory?${params}`)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load Theory administration.") }
  }, [collectionFilter, query, status])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200)
    return () => window.clearTimeout(timer)
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
    <header className="rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-700 to-emerald-800 p-6 text-white shadow-lg sm:p-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-teal-100">Theory Vault Administration</p><h1 className="mt-2 text-3xl font-bold">Build the long-answer curriculum.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-teal-50/90">Manage categories, modules, disciplines, sets, Markdown answers, publishing, ordering, and migration-safe placement.</p></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{[["Collections",data.collections.length],["Modules",data.modules.length],["Disciplines",data.disciplines.length],["Sets",data.sets.length],["Questions",data.total]].map(([label,value]) => <div key={label} className={card}><p className="text-2xl font-bold text-primary">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></div>)}</section>
    <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-card p-2">{tabs.map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`${button} shrink-0 ${tab===id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Icon size={16}/>{label}</button>)}</nav>
    {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    {notice && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">{notice}</div>}
    {tab === "hierarchy" && <HierarchyAdmin data={data} change={change}/>}
    {tab === "questions" && <QuestionAdmin data={data} query={query} setQuery={setQuery} status={status} setStatus={setStatus} collectionFilter={collectionFilter} setCollectionFilter={setCollectionFilter} change={change}/>}
    {tab === "import" && <TheoryBulkImporter onImported={load}/>}
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
  const [collectionTitle, setCollectionTitle] = useState("")
  const [collectionKind, setCollectionKind] = useState<Collection["kind"]>("end_of_module")
  const [groupName, setGroupName] = useState("")
  const [setName, setSetName] = useState("")
  const [setDescription, setSetDescription] = useState("")
  const sets = data.sets.filter(item => item.collectionId === collectionId && (item.moduleId === groupId || item.disciplineId === groupId))
  useEffect(() => {
    const nextCollection = data.collections.find(item => item.id === collectionId)
    const nextGroups = (nextCollection?.kind === "end_of_module" ? data.modules : data.disciplines).filter(item => item.collectionId === collectionId)
    if (!nextGroups.some(item => item.id === groupId)) setGroupId(nextGroups[0]?.id ?? "")
  }, [collectionId, data.collections, data.disciplines, data.modules, groupId])
  return <div className="grid gap-5 xl:grid-cols-[360px_1fr]"><aside className={`${card} space-y-5`}><div><h2 className="font-bold">Add category</h2><input value={collectionTitle} onChange={event => setCollectionTitle(event.target.value)} placeholder="Category title" className={`${control} mt-3 w-full`}/><select value={collectionKind} onChange={event => setCollectionKind(event.target.value as Collection["kind"])} className={`${control} mt-2 w-full`}><option value="end_of_module">End of Module</option><option value="end_of_year">End of Year</option></select><button onClick={async () => { if (await change("POST",{resource:"collection",title:collectionTitle,kind:collectionKind,status:"published"},"Category created.")) setCollectionTitle("") }} className={`${button} mt-2 w-full bg-primary text-primary-foreground`}><Plus size={16}/>Add category</button></div>
    <div className="border-t border-border pt-5"><h2 className="font-bold">Add {collection?.kind === "end_of_module" ? "module" : "discipline"}</h2><select value={collectionId} onChange={event => setCollectionId(event.target.value)} className={`${control} mt-3 w-full`}>{data.collections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input value={groupName} onChange={event => setGroupName(event.target.value)} placeholder={collection?.kind === "end_of_module" ? "Module name" : "Discipline name"} className={`${control} mt-2 w-full`}/><button onClick={async () => { const resource=collection?.kind === "end_of_module" ? "module" : "discipline"; if(await change("POST",{resource,collectionId,name:groupName},"Study group created.")) setGroupName("") }} className={`${button} mt-2 w-full border border-border`}><Plus size={16}/>Add group</button></div></aside>
    <section className="space-y-5"><div className={card}><h2 className="font-bold">Curriculum tree</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={collectionId} onChange={event => setCollectionId(event.target.value)} className={control}>{data.collections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><select value={groupId} onChange={event => setGroupId(event.target.value)} className={control}>{collectionGroups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
      <div className={card}><h2 className="font-bold">Add set</h2><div className="mt-3 grid gap-3 lg:grid-cols-2"><input value={setName} onChange={event => setSetName(event.target.value)} placeholder="Set title" className={control}/><input value={setDescription} onChange={event => setSetDescription(event.target.value)} placeholder="Short description" className={control}/></div><button onClick={async () => { const body={resource:"set",collectionId,name:setName,description:setDescription,status:"published",moduleId:collection?.kind==="end_of_module"?groupId:null,disciplineId:collection?.kind==="end_of_year"?groupId:null}; if(await change("POST",body,"Set created.")){setSetName("");setSetDescription("")} }} className={`${button} mt-3 bg-primary text-primary-foreground`}><Plus size={16}/>Create set</button></div>
      {sets.length ? <div className="grid gap-3 md:grid-cols-2">{sets.map(set => <SetEditor key={set.id} set={set} change={change}/>)}</div> : <div className={`${card} text-sm text-muted-foreground`}>No sets exist in this study group yet.</div>}
    </section></div>
}

function SetEditor({ set, change }: { set: SetRow; change: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) => Promise<boolean> }) {
  const [name, setName] = useState(set.name)
  const [description, setDescription] = useState(set.description)
  const [status, setStatus] = useState(set.status)
  return <article className={card}><p className="text-xs font-semibold text-primary">{set.questionCount} questions</p><input value={name} onChange={event => setName(event.target.value)} className={`${control} mt-3 w-full font-bold`}/><textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} className={`${control} mt-2 w-full py-3`}/><select value={status} onChange={event => setStatus(event.target.value as Status)} className={`${control} mt-2 w-full`}><option value="draft">Draft</option><option value="review">In review</option><option value="published">Published</option><option value="archived">Archived</option></select><button onClick={() => change("PATCH",{resource:"set",id:set.id,name,description,status},"Set updated.")} className={`${button} mt-3 w-full border border-border`}><Save size={16}/>Save set</button></article>
}

function QuestionAdmin({ data, query, setQuery, status, setStatus, collectionFilter, setCollectionFilter, change }: {
  data: AdminData; query: string; setQuery: (value: string) => void; status: string; setStatus: (value: string) => void
  collectionFilter: string; setCollectionFilter: (value: string) => void
  change: (method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, success: string) => Promise<boolean>
}) {
  const [active, setActive] = useState<QuestionRow | null>(null)
  const [creating, setCreating] = useState(false)
  const move = async (question: QuestionRow, direction: -1 | 1) => {
    const siblings = data.questions.filter(item => item.setId === question.setId).sort((a,b) => a.sortOrder-b.sortOrder)
    const index = siblings.findIndex(item => item.id === question.id), target = siblings[index+direction]
    if (!target) return
    const ordered = [...siblings]; [ordered[index],ordered[index+direction]]=[ordered[index+direction],ordered[index]]
    await change("PATCH",{action:"reorder",orderedIds:ordered.map(item=>item.id)},"Question order updated.")
  }
  return <div className="space-y-5"><section className={card}><div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_auto]"><label className="flex items-center gap-2 rounded-xl border border-border px-3"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search questions" className="min-h-11 w-full bg-transparent text-sm outline-none"/></label><select value={collectionFilter} onChange={event => setCollectionFilter(event.target.value)} className={control}><option value="">All categories</option>{data.collections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><select value={status} onChange={event => setStatus(event.target.value)} className={control}><option value="">All statuses</option><option value="draft">Draft</option><option value="review">In review</option><option value="published">Published</option><option value="archived">Archived</option></select><button onClick={() => { setCreating(true); setActive(null) }} className={`${button} bg-primary text-primary-foreground`}><Plus size={16}/>New question</button></div></section>
    {(creating || active) && <QuestionForm question={active} data={data} onClose={() => {setActive(null);setCreating(false)}} change={change}/>}
    <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="hidden grid-cols-[1fr_150px_110px_100px] gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground lg:grid"><span>Question</span><span>Set</span><span>Status</span><span>Order</span></div><div className="divide-y divide-border">{data.questions.map(question => <article key={question.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_150px_110px_100px] lg:items-center"><button onClick={() => { setActive(question); setCreating(false) }} className="text-left"><p className="font-semibold">{question.title || question.prompt}</p><p className="mt-1 text-xs text-muted-foreground">{question.collectionTitle} Â· {question.moduleName ?? question.disciplineName}</p></button><span className="text-sm text-muted-foreground">{question.setTitle ?? "Unassigned"}</span><span className="w-fit rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{question.status}</span><span className="flex gap-1"><button onClick={() => move(question,-1)} aria-label="Move up" className="rounded-lg border border-border p-2"><ArrowUp size={15}/></button><button onClick={() => move(question,1)} aria-label="Move down" className="rounded-lg border border-border p-2"><ArrowDown size={15}/></button></span></article>)}</div></section>
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
  const [referencesMd, setReferences] = useState(question?.referencesMd ?? "")
  const [media, setMedia] = useState<TheoryMediaItem[]>(question?.media ?? [])
  const [marks, setMarks] = useState(question?.marks?.toString() ?? "")
  const [status, setStatus] = useState<Status>(question?.status ?? "draft")
  useEffect(() => { if (!groups.some(item => item.id === groupId)) setGroupId(groups[0]?.id ?? "") }, [collectionId, groupId, groups])
  const save = async () => {
    const payload = { collectionId, moduleId:collection?.kind==="end_of_module"?groupId:null, disciplineId:collection?.kind==="end_of_year"?groupId:relatedDisciplineId||null, setId:setId||null, autoAssign:!setId, title,prompt,modelAnswer,keyMarkingPoints:points.split("\n").map(x=>x.trim()).filter(Boolean),tags:tags.split(",").map(x=>x.trim()).filter(Boolean),referencesMd,media,marks:marks?Number(marks):null,status }
    const ok = question ? await change("PATCH",{resource:"question",id:question.id,...payload},"Question updated.") : await change("POST",{resource:"question",...payload},"Question created.")
    if (ok) onClose()
  }
  return <section className={card}><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">{question ? "Edit question" : "New question"}</p><h2 className="mt-1 text-xl font-bold">{question?.title || "Create Theory question"}</h2></div><button onClick={onClose} className="text-sm font-bold text-muted-foreground">Close</button></div><div className={`mt-5 grid gap-4 ${collection?.kind==="end_of_module" ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}><label className="text-xs font-bold text-muted-foreground">Category<select value={collectionId} onChange={event => { setCollectionId(event.target.value); setRelatedDisciplineId("") }} className={`${control} mt-1 w-full text-foreground`}>{data.collections.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="text-xs font-bold text-muted-foreground">{collection?.kind==="end_of_module"?"Module":"Discipline"}<select value={groupId} onChange={event => setGroupId(event.target.value)} className={`${control} mt-1 w-full text-foreground`}>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{collection?.kind==="end_of_module" && <label className="text-xs font-bold text-muted-foreground">Related discipline (optional)<select value={relatedDisciplineId} onChange={event => setRelatedDisciplineId(event.target.value)} className={`${control} mt-1 w-full text-foreground`}><option value="">No related discipline</option>{relatedDisciplines.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<label className="text-xs font-bold text-muted-foreground">Set<select value={setId} onChange={event => setSetId(event.target.value)} className={`${control} mt-1 w-full text-foreground`}><option value="">Auto-assign next available set</option>{sets.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_140px_180px]"><label className="text-xs font-bold text-muted-foreground">Short title<input value={title} onChange={event => setTitle(event.target.value)} className={`${control} mt-1 w-full text-foreground`}/></label><label className="text-xs font-bold text-muted-foreground">Marks<input type="number" min="0" value={marks} onChange={event => setMarks(event.target.value)} className={`${control} mt-1 w-full text-foreground`}/></label><label className="text-xs font-bold text-muted-foreground">Status<select value={status} onChange={event => setStatus(event.target.value as Status)} className={`${control} mt-1 w-full text-foreground`}><option value="draft">Draft</option><option value="review">In review</option><option value="published">Published</option><option value="archived">Archived</option></select></label></div>
    <label className="mt-4 block text-xs font-bold text-muted-foreground">Question prompt<textarea rows={4} value={prompt} onChange={event => setPrompt(event.target.value)} className={`${control} mt-1 w-full py-3 font-normal text-foreground`}/></label><label className="mt-4 block text-xs font-bold text-muted-foreground">Model answer (Markdown)<textarea rows={10} value={modelAnswer} onChange={event => setModelAnswer(event.target.value)} className={`${control} mt-1 w-full py-3 font-mono font-normal text-foreground`}/></label><div className="mt-4 grid gap-4 lg:grid-cols-2"><label className="text-xs font-bold text-muted-foreground">Key points (one per line)<textarea rows={5} value={points} onChange={event => setPoints(event.target.value)} className={`${control} mt-1 w-full py-3 font-normal text-foreground`}/></label><label className="text-xs font-bold text-muted-foreground">References (Markdown)<textarea rows={5} value={referencesMd} onChange={event => setReferences(event.target.value)} className={`${control} mt-1 w-full py-3 font-normal text-foreground`}/></label></div><label className="mt-4 block text-xs font-bold text-muted-foreground">Tags (comma separated)<input value={tags} onChange={event => setTags(event.target.value)} className={`${control} mt-1 w-full text-foreground`}/></label><TheoryMediaEditor media={media} onChange={setMedia}/><div className="mt-5 flex flex-wrap justify-between gap-3">{question?.status==="draft" ? <button onClick={async()=>{if(await change("DELETE",{resource:"question",id:question.id},"Draft deleted."))onClose()}} className={`${button} border border-destructive/30 text-destructive`}><Trash2 size={16}/>Delete draft</button>:<span/>}<button onClick={save} className={`${button} bg-primary text-primary-foreground`}><Save size={16}/>{question?"Save changes":"Create question"}</button></div>
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

