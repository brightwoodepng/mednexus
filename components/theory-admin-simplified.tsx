"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArchiveRestore, BookOpen, ChevronDown, ChevronRight, Eye, FileUp, Folder,
  FolderOpen, MoreHorizontal, MoveRight, Pencil, Plus, RefreshCw, Search, Settings2,
  Trash2, X,
} from "lucide-react"
import { TheoryBulkImporter } from "@/components/theory-bulk-importer"
import { TheoryQuestionMedia } from "@/components/theory-question-media"
import { TheoryMarkdown } from "@/components/theory-markdown"
import type { TheoryMediaItem } from "@/lib/theory-media"

type Kind = "end_of_module" | "end_of_year"
type Status = "draft" | "review" | "published" | "archived"
type Group = { id: string; collectionId: string; name: string; description?: string; sortOrder: number }
type SetRow = { id: string; collectionId: string; moduleId: string | null; disciplineId: string | null; name: string; status: Status; questionLimit: number; questionCount: number }
type Question = {
  id: string; collectionId: string; moduleId: string | null; disciplineId: string | null; setId: string | null
  title: string; prompt: string; modelAnswer: string; keyMarkingPoints: string[]; marks: number | null
  media: TheoryMediaItem[]; tags: string[]; difficulty: number; estimatedStudyMinutes: number; status: Status
  moduleName: string | null; disciplineName: string | null; setTitle: string | null
  hasAnswer: boolean; readiness: "missing_prompt" | "missing_set" | "prompt_only" | "ready"; deletedAt?: string | null
}
type ImportJob = { id: string; sourceName: string; status: string; totalCount: number; validCount: number; errorCount: number; createdAt: string; deletedAt: string | null }
type AdminData = {
  collections: Array<{ id: string; title: string; kind: Kind }>; modules: Group[]; disciplines: Group[]; sets: SetRow[]; questions: Question[]
  total: number; counts: Record<string, number>; settings: { defaultSetSize: number }; imports: ImportJob[]
  hierarchyStats: Array<{ collectionId: string; moduleId: string | null; disciplineId: string | null; setId: string | null; total: number; draft: number; live: number; needsAttention: number }>
  trash: Array<{ type: "module" | "discipline" | "set"; id: string; label: string; deletedAt: string; count: number }>
  audit: Array<{ id: number; action: string; resourceType: string; resourceId: string | null; createdAt: string }>
}
type ApiSummary = { matched?: number; updated?: number; skipped?: number; validationDetails?: Array<{ id: string; reason: string }> }
type Tab = "editor" | "import" | "imports" | "trash" | "more"

const card = "rounded-2xl border border-border bg-card shadow-sm"
const control = "min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25"
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition"

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? "Request failed.")
  return data as T
}

function readinessLabel(question: Question) {
  if (question.readiness === "ready") return { label: "Ready", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" }
  if (question.readiness === "prompt_only") return { label: "Prompt only", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" }
  if (question.readiness === "missing_set") return { label: "Needs a set", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" }
  return { label: "Needs a prompt", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300" }
}

export function TheoryAdminSimplified({ initialTab = "editor" }: { initialTab?: Tab }) {
  const [kind, setKind] = useState<Kind>("end_of_module")
  const [tab, setTab] = useState<Tab>(initialTab)
  const [data, setData] = useState<AdminData | null>(null)
  const [groupId, setGroupId] = useState("")
  const [setId, setSetId] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [active, setActive] = useState<Question | null>(null)
  const [preview, setPreview] = useState<Question | null>(null)
  const [moveIds, setMoveIds] = useState<string[]>([])
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const groups = useMemo(() => kind === "end_of_module" ? data?.modules ?? [] : data?.disciplines ?? [], [data, kind])
  const groupSets = useMemo(() => (data?.sets ?? []).filter(item => kind === "end_of_module" ? item.moduleId === groupId : item.disciplineId === groupId), [data, groupId, kind])

  const load = useCallback(async () => {
    const params = new URLSearchParams({ kind, pageSize: "50" })
    if (groupId) params.set(kind === "end_of_module" ? "moduleId" : "disciplineId", groupId)
    if (setId) params.set("setId", setId)
    if (query.trim()) params.set("q", query.trim())
    if (status) params.set("status", status)
    if (tab === "trash") params.set("trash", "true")
    setError("")
    try { setData(await api<AdminData>(`/api/admin/theory?${params}`)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load Theory Vault.") }
  }, [groupId, kind, query, setId, status, tab])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 180); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => { setGroupId(""); setSetId(""); setSelected([]) }, [kind])

  const change = async (method: "POST" | "PATCH", body: Record<string, unknown>, success: string) => {
    setBusy(true); setError(""); setNotice("")
    try {
      const summary = await api<ApiSummary>("/api/admin/theory", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const result = summary.matched == null ? success : `${success} ${summary.updated ?? 0} changed${summary.skipped ? `; ${summary.skipped} skipped` : ""}.`
      setNotice(result); await load(); return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save."); return false }
    finally { setBusy(false) }
  }

  const trash = async (resource: string, ids: string[]) => {
    if (!window.confirm(`Move ${ids.length} ${resource}${ids.length === 1 ? "" : "s"} to Trash? You can restore them later.`)) return
    if (await change("PATCH", { action: "trash", resource, ids }, "Moved to Trash.")) setSelected([])
  }
  const publish = (ids: string[], next: "published" | "draft") => change("PATCH", { action: "bulk", operation: next, scope: { ids } }, next === "published" ? "Published." : "Returned to draft.")
  const selectedGroup = groups.find(item => item.id === groupId)

  if (!data) return <div className={`${card} p-14 text-center text-sm text-muted-foreground`}>{error || "Loading Theory Vault…"}</div>
  return <div className="space-y-4 pb-12">
    <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Content</p><h1 className="mt-1 text-3xl font-bold">Theory question editor</h1><p className="mt-1 text-sm text-muted-foreground">Open a module, choose a set, and make changes directly.</p></div>
      <div className="grid grid-cols-2 rounded-xl border border-border bg-muted/40 p-1"><button onClick={() => setKind("end_of_module")} className={`${button} ${kind === "end_of_module" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>End of Module</button><button onClick={() => setKind("end_of_year")} className={`${button} ${kind === "end_of_year" ? "bg-background shadow-sm" : "text-muted-foreground"}`}>End of Year</button></div>
    </header>
    <nav className="flex gap-2 overflow-x-auto rounded-xl border border-border bg-card p-2">{([
      ["editor","Questions",BookOpen],["import","Import file",FileUp],["imports","Import history",FolderOpen],["trash","Trash",Trash2],["more","More tools",MoreHorizontal],
    ] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setTab(id)} className={`${button} shrink-0 ${tab === id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Icon size={16}/>{label}</button>)}</nav>
    {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    {notice ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">{notice}</div> : null}

    {tab === "editor" ? <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
      <aside className={`${card} h-fit overflow-hidden`}>
        <div className="flex items-start justify-between gap-2 border-b border-border p-4"><div><h2 className="font-bold">{kind === "end_of_module" ? "Modules" : "Disciplines"}</h2><p className="text-xs text-muted-foreground">Choose a folder to see its sets.</p></div><button onClick={async()=>{const name=window.prompt(`New ${kind === "end_of_module" ? "module" : "discipline"} name`);const collectionId=data.collections[0]?.id;if(name&&collectionId)await change("POST",{resource:kind === "end_of_module" ? "module" : "discipline",collectionId,name},"Folder created.")}} aria-label="Add folder" className="rounded-lg border border-border p-2 text-primary"><Plus size={15}/></button></div>
        <div className="max-h-[70dvh] overflow-y-auto p-2">{groups.map(group => {
          const stat = data.hierarchyStats.find(item => kind === "end_of_module" ? item.moduleId === group.id && !item.setId : item.disciplineId === group.id && !item.setId)
          const open = group.id === groupId
          return <div key={group.id} className="mb-1"><div className={`flex items-center rounded-xl ${open ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}><button onClick={() => {setGroupId(open ? "" : group.id);setSetId("");setSelected([])}} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left"><span className="shrink-0">{open ? <FolderOpen size={17}/> : <Folder size={17}/>}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{group.name}</b><span className="text-[11px] text-muted-foreground">{stat?.total ?? 0} questions · {stat?.live ?? 0} live</span></span>{open ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}</button><button onClick={async()=>{const name=window.prompt("Rename folder",group.name);if(name)await change("PATCH",{resource:kind === "end_of_module" ? "module" : "discipline",id:group.id,name},"Folder renamed.")}} aria-label={`Rename ${group.name}`} className="rounded-lg p-2 text-muted-foreground hover:text-primary"><Pencil size={13}/></button><button onClick={() => void trash(kind === "end_of_module" ? "module" : "discipline", [group.id])} aria-label={`Trash ${group.name}`} className="mr-2 rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14}/></button></div>
            {open ? <div className="ml-5 border-l border-border py-1 pl-2"><button onClick={() => setSetId("")} className={`mb-1 block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold ${!setId ? "bg-muted" : "hover:bg-muted"}`}>All questions</button>{groupSets.map(set => <div key={set.id} className="flex items-center"><button onClick={() => {setSetId(set.id);setSelected([])}} className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-xs ${setId === set.id ? "bg-muted font-bold text-primary" : "hover:bg-muted"}`}><span className="block truncate">{set.name}</span><span className="text-[10px] text-muted-foreground">{set.questionCount}/{set.questionLimit}</span></button><button onClick={async()=>{const name=window.prompt("Rename set",set.name);if(name)await change("PATCH",{resource:"set",id:set.id,name},"Set renamed.")}} aria-label={`Rename ${set.name}`} className="rounded-lg p-2 text-muted-foreground hover:text-primary"><Pencil size={13}/></button><button onClick={() => void trash("set", [set.id])} aria-label={`Trash ${set.name}`} className="rounded-lg p-2 text-muted-foreground hover:text-destructive"><Trash2 size={13}/></button></div>)}</div> : null}
          </div>
        })}</div>
      </aside>
      <main className="min-w-0 space-y-3">
        <section className={`${card} p-4`}><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border px-3"><Search size={16}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search questions" className="w-full bg-transparent text-sm outline-none"/></label><select value={status} onChange={event => setStatus(event.target.value)} className={control}><option value="">All statuses</option><option value="draft">Draft</option><option value="review">In review</option><option value="published">Live</option><option value="archived">Archived</option></select><button onClick={() => void load()} className={`${button} border border-border`}><RefreshCw size={15}/>Refresh</button></div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><b className="mr-auto text-sm">{selectedGroup?.name ?? "Choose a folder"}{setId ? ` · ${groupSets.find(item => item.id === setId)?.name}` : ""}</b>{selected.length ? <><span className="text-xs text-muted-foreground">{selected.length} selected</span><button onClick={() => void publish(selected,"published")} className={`${button} bg-emerald-600 text-white`}>Publish</button><button onClick={() => setMoveIds(selected)} className={`${button} border border-border`}><MoveRight size={14}/>Move</button><button onClick={() => void trash("question",selected)} className={`${button} bg-destructive/10 text-destructive`}><Trash2 size={14}/>Trash</button></> : null}</div>
        </section>
        {!groupId ? <div className={`${card} p-12 text-center`}><FolderOpen className="mx-auto text-primary" size={34}/><h2 className="mt-4 font-bold">Choose a {kind === "end_of_module" ? "module" : "discipline"}</h2><p className="mt-1 text-sm text-muted-foreground">Its sets and questions will appear here.</p></div> : data.questions.length ? <section className={`${card} overflow-hidden`}><div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-3 text-xs font-bold"><input type="checkbox" checked={selected.length === data.questions.length} onChange={event => setSelected(event.target.checked ? data.questions.map(item => item.id) : [])}/><span>{data.questions.length} shown</span></div><div className="divide-y divide-border">{data.questions.map(question => {
          const readiness = readinessLabel(question)
          return <article key={question.id} className="p-4"><div className="flex items-start gap-3"><input type="checkbox" checked={selected.includes(question.id)} onChange={event => setSelected(current => event.target.checked ? [...new Set([...current,question.id])] : current.filter(id => id !== question.id))} className="mt-1"/><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${question.status === "published" ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{question.status === "published" ? "Live" : question.status}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${readiness.className}`}>{readiness.label}</span></div><h3 className="mt-2 font-semibold">{question.title || question.prompt}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{question.prompt}</p><p className="mt-2 text-xs text-muted-foreground">{question.setTitle ?? "Unassigned"} · {question.marks ?? 0} marks</p></div></div><div className="mt-3 flex flex-wrap gap-2 pl-7"><button onClick={() => setActive(question)} className={`${button} bg-primary text-primary-foreground`}><Pencil size={14}/>Edit</button><button onClick={() => setPreview(question)} className={`${button} border border-border`}><Eye size={14}/>Preview</button><button onClick={() => setMoveIds([question.id])} className={`${button} border border-border`}><MoveRight size={14}/>Move</button><button onClick={() => void publish([question.id],question.status === "published" ? "draft" : "published")} className={`${button} border border-border`}>{question.status === "published" ? "Unpublish" : "Publish"}</button><button onClick={() => void trash("question",[question.id])} className={`${button} text-destructive hover:bg-destructive/10`}><Trash2 size={14}/>Trash</button></div></article>
        })}</div></section> : <div className={`${card} p-12 text-center text-sm text-muted-foreground`}>No questions match this folder and filter.</div>}
      </main>
    </div> : null}

    {tab === "import" ? <TheoryBulkImporter collectionKind={kind} defaultSetSize={data.settings.defaultSetSize} onImported={load} onReviewImported={() => setTab("editor")}/> : null}
    {tab === "imports" ? <ImportHistory jobs={data.imports} onChange={async (id,action) => { await api(`/api/admin/content/imports/${id}`, { method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action}) }); setNotice(action === "trash" ? "Import moved to Trash." : "Import restored."); await load() }}/> : null}
    {tab === "trash" ? <TrashView data={data} busy={busy} change={change} reload={load}/> : null}
    {tab === "more" ? <MoreTools data={data} change={change}/> : null}
    {active ? <QuestionPanel question={active} data={data} onClose={() => setActive(null)} onSaved={async body => { if(await change("PATCH",{resource:"question",id:active.id,...body},"Question saved."))setActive(null) }}/> : null}
    {preview ? <PreviewPanel question={preview} onClose={() => setPreview(null)}/> : null}
    {moveIds.length ? <MovePanel ids={moveIds} groups={groups} sets={data.sets} kind={kind} onClose={() => setMoveIds([])} onMove={async destination => { if(await change("PATCH",{action:"move",questionIds:moveIds,...destination},"Questions moved.")){setMoveIds([]);setSelected([])} }}/> : null}
  </div>
}

function QuestionPanel({ question, data, onClose, onSaved }: { question: Question; data: AdminData; onClose: () => void; onSaved: (body: Record<string,unknown>) => Promise<void> }) {
  const [title,setTitle]=useState(question.title),[prompt,setPrompt]=useState(question.prompt),[answer,setAnswer]=useState(question.modelAnswer),[points,setPoints]=useState(question.keyMarkingPoints.join("\n")),[setId,setSetId]=useState(question.setId??""),[status,setStatus]=useState<Status>(question.status)
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/45" onClick={onClose}><aside role="dialog" aria-modal="true" aria-label="Edit Theory question" onClick={event=>event.stopPropagation()} className="h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-background p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">Edit question</p><h2 className="mt-1 text-xl font-bold">Quick editor</h2></div><button onClick={onClose} aria-label="Close editor" className="rounded-lg p-2 hover:bg-muted"><X/></button></div><div className="mt-5 space-y-4"><label className="block text-xs font-bold text-muted-foreground">Title<input value={title} onChange={e=>setTitle(e.target.value)} className={`${control} mt-1 w-full text-foreground`}/></label><label className="block text-xs font-bold text-muted-foreground">Set<select value={setId} onChange={e=>setSetId(e.target.value)} className={`${control} mt-1 w-full text-foreground`}><option value="">Unassigned</option>{data.sets.map(set=><option key={set.id} value={set.id}>{set.name}</option>)}</select></label><label className="block text-xs font-bold text-muted-foreground">Status<select value={status} onChange={e=>setStatus(e.target.value as Status)} className={`${control} mt-1 w-full text-foreground`}><option value="draft">Draft</option><option value="review">In review</option><option value="published">Live</option><option value="archived">Archived</option></select></label><label className="block text-xs font-bold text-muted-foreground">Question prompt<textarea rows={6} value={prompt} onChange={e=>setPrompt(e.target.value)} className={`${control} mt-1 w-full py-3 text-foreground`}/></label><label className="block text-xs font-bold text-muted-foreground">Model answer <span className="font-normal">(optional for prompt-only publishing)</span><textarea rows={10} value={answer} onChange={e=>setAnswer(e.target.value)} className={`${control} mt-1 w-full py-3 text-foreground`}/></label><label className="block text-xs font-bold text-muted-foreground">Marking points, one per line<textarea rows={5} value={points} onChange={e=>setPoints(e.target.value)} className={`${control} mt-1 w-full py-3 text-foreground`}/></label><TheoryQuestionMedia media={question.media}/><button onClick={()=>void onSaved({title,prompt,modelAnswer:answer,keyMarkingPoints:points.split("\n").map(v=>v.trim()).filter(Boolean),setId,status})} className={`${button} w-full bg-primary text-primary-foreground`}>Save changes</button></div></aside></div>
}

function PreviewPanel({question,onClose}:{question:Question;onClose:()=>void}) { return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3" onClick={onClose}><section role="dialog" aria-modal="true" aria-label="Question preview" onClick={e=>e.stopPropagation()} className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-2xl"><div className="flex justify-between"><h2 className="text-xl font-bold">Learner preview</h2><button onClick={onClose} aria-label="Close preview"><X/></button></div><h3 className="mt-5 font-bold">{question.title}</h3><p className="mt-3 leading-7">{question.prompt}</p>{question.media.length?<TheoryQuestionMedia media={question.media}/>:null}<div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">{question.hasAnswer?<><TheoryMarkdown children={question.modelAnswer}/></>:<p className="text-sm text-amber-700">Model answer coming soon. Learners can practise this prompt but cannot self-mark.</p>}</div></section></div> }

function MovePanel({ids,groups,sets,kind,onClose,onMove}:{ids:string[];groups:Group[];sets:SetRow[];kind:Kind;onClose:()=>void;onMove:(destination:Record<string,unknown>)=>Promise<void>}) { const [group,setGroup]=useState(""),[setId,setSetId]=useState(""); const available=sets.filter(item=>kind==="end_of_module"?item.moduleId===group:item.disciplineId===group); return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3" onClick={onClose}><section role="dialog" aria-modal="true" aria-label="Move questions" onClick={e=>e.stopPropagation()} className={`${card} w-full max-w-md p-5`}><div className="flex justify-between"><div><h2 className="font-bold">Move {ids.length} question{ids.length===1?"":"s"}</h2><p className="text-sm text-muted-foreground">Choose a folder and optionally a set.</p></div><button onClick={onClose}><X/></button></div><select value={group} onChange={e=>{setGroup(e.target.value);setSetId("")}} className={`${control} mt-5 w-full`}><option value="">Choose {kind==="end_of_module"?"module":"discipline"}</option>{groups.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={setId} onChange={e=>setSetId(e.target.value)} disabled={!group} className={`${control} mt-3 w-full disabled:opacity-50`}><option value="">Use next available set automatically</option>{available.map(item=><option key={item.id} value={item.id}>{item.name} ({item.questionCount}/{item.questionLimit})</option>)}</select><button disabled={!group} onClick={()=>void onMove({setId,...(kind==="end_of_module"?{moduleId:group}:{disciplineId:group})})} className={`${button} mt-4 w-full bg-primary text-primary-foreground disabled:opacity-50`}>Move questions</button></section></div> }

function ImportHistory({jobs,onChange}:{jobs:ImportJob[];onChange:(id:string,action:"trash"|"restore")=>Promise<void>}) { return <section className={`${card} overflow-hidden`}><div className="border-b border-border p-5"><h2 className="text-xl font-bold">Uploaded files</h2><p className="text-sm text-muted-foreground">Import history does not control questions already created from a file.</p></div><div className="divide-y divide-border">{jobs.filter(job=>!job.deletedAt).map(job=><article key={job.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><FileUp className="text-primary"/><div className="min-w-0 flex-1"><b className="block truncate">{job.sourceName}</b><span className="text-xs text-muted-foreground">{job.totalCount} questions · {job.status} · {new Date(job.createdAt).toLocaleDateString()}</span></div><button onClick={()=>void onChange(job.id,"trash")} className={`${button} text-destructive hover:bg-destructive/10`}><Trash2 size={14}/>Trash file</button></article>)}</div></section> }

function TrashView({data,busy,change,reload}:{data:AdminData;busy:boolean;change:(method:"POST"|"PATCH",body:Record<string,unknown>,success:string)=>Promise<boolean>;reload:()=>Promise<void>}) {
  const questions=data.questions.filter(q=>q.deletedAt)
  const items=[...data.trash,...questions.map(q=>({type:"question" as const,id:q.id,label:q.title||q.prompt,deletedAt:q.deletedAt!,count:1}))]
  const imports=data.imports.filter(job=>job.deletedAt)
  const totalItems=items.length+imports.length
  const act=async(action:"restore"|"purge",item:typeof items[number])=>{if(action==="purge"&&window.prompt(`Type DELETE to permanently remove ${item.label}`)!=="DELETE")return;await change("PATCH",{action,resource:item.type,ids:[item.id]},action==="restore"?"Restored.":"Permanently deleted.")}
  const actImport=async(action:"restore"|"purge",job:ImportJob)=>{if(action==="purge"&&window.prompt(`Type DELETE to permanently remove ${job.sourceName}`)!=="DELETE")return;await api(`/api/admin/content/imports/${job.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,confirmation:action==="purge"?"DELETE":undefined})});await reload()}
  const emptyTrash=async()=>{if(window.prompt("Type DELETE to permanently empty Theory Trash")!=="DELETE")return;await Promise.all(imports.map(job=>api(`/api/admin/content/imports/${job.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"purge",confirmation:"DELETE"})})));await change("PATCH",{action:"empty_trash"},"Trash emptied.")}
  return <section className={`${card} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5"><div><h2 className="text-xl font-bold">Trash</h2><p className="text-sm text-muted-foreground">Items stay here until you permanently delete them.</p></div><button disabled={busy||!totalItems} onClick={()=>void emptyTrash()} className={`${button} bg-destructive text-destructive-foreground disabled:opacity-40`}>Empty trash</button></div><div className="divide-y divide-border">{items.map(item=><article key={`${item.type}-${item.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><Trash2 className="text-muted-foreground"/><div className="min-w-0 flex-1"><b className="block truncate">{item.label}</b><span className="text-xs capitalize text-muted-foreground">{item.type} · {item.count} contained question{item.count===1?"":"s"}</span></div><button onClick={()=>void act("restore",item)} className={`${button} border border-border`}><ArchiveRestore size={14}/>Restore</button><button onClick={()=>void act("purge",item)} className={`${button} text-destructive hover:bg-destructive/10`}><Trash2 size={14}/>Delete forever</button></article>)}{imports.map(job=><article key={`import-${job.id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><FileUp className="text-muted-foreground"/><div className="min-w-0 flex-1"><b className="block truncate">{job.sourceName}</b><span className="text-xs text-muted-foreground">Import file · created questions are unaffected</span></div><button onClick={()=>void actImport("restore",job)} className={`${button} border border-border`}><ArchiveRestore size={14}/>Restore</button><button onClick={()=>void actImport("purge",job)} className={`${button} text-destructive hover:bg-destructive/10`}><Trash2 size={14}/>Delete forever</button></article>)}{!totalItems?<p className="p-12 text-center text-sm text-muted-foreground">Trash is empty.</p>:null}</div></section>
}

function MoreTools({data,change}:{data:AdminData;change:(method:"POST"|"PATCH",body:Record<string,unknown>,success:string)=>Promise<boolean>}) { const [size,setSize]=useState(data.settings.defaultSetSize); return <div className="grid gap-4 lg:grid-cols-2"><section className={`${card} p-5`}><div className="flex items-center gap-2"><Settings2 className="text-primary"/><h2 className="font-bold">Set size</h2></div><p className="mt-2 text-sm text-muted-foreground">Used when moving questions into a folder without available capacity.</p><select value={size} onChange={e=>setSize(Number(e.target.value))} className={`${control} mt-4 w-full`}>{[15,16,17,18,19,20].map(value=><option key={value}>{value}</option>)}</select><button onClick={()=>void change("PATCH",{action:"settings",defaultSetSize:size},"Settings saved.")} className={`${button} mt-3 w-full bg-primary text-primary-foreground`}>Save setting</button></section><section className={`${card} p-5`}><h2 className="font-bold">Recent changes</h2><div className="mt-3 space-y-2">{data.audit.slice(0,12).map(item=><div key={item.id} className="rounded-lg bg-muted/40 px-3 py-2 text-xs"><b className="capitalize">{item.action.replaceAll("_"," ")}</b><span className="ml-2 text-muted-foreground">{item.resourceType} · {new Date(item.createdAt).toLocaleString()}</span></div>)}</div></section></div> }
