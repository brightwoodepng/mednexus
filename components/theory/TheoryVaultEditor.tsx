"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, FileUp, Plus, ShieldAlert } from "lucide-react"
import { useAdmin } from "@/contexts/admin-context"

type Row = { id: string; title?: string; collection_id?: string; discipline_id?: string; set_id?: string; prompt?: string; publication_status?: string; sort_order?: number }
const adminHeaders = (token: string | null) => ({ "Content-Type": "application/json", ...(token ? { "x-admin-token": token } : {}) })

export function TheoryVaultEditor() {
  const { isAdmin, adminReady, adminToken } = useAdmin()
  const [collections, setCollections] = useState<Row[]>([])
  const [disciplines, setDisciplines] = useState<Row[]>([])
  const [sets, setSets] = useState<Row[]>([])
  const [questions, setQuestions] = useState<Row[]>([])
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [question, setQuestion] = useState({ collectionId: "", disciplineId: "", setId: "", prompt: "", modelAnswer: "", markingPoints: "", tags: "", difficulty: "medium", estimatedStudyMinutes: "5", publicationStatus: "draft" })

  const reload = async () => {
    if (!adminToken) return
    const headers = adminHeaders(adminToken)
    const fetchRows = async (resource: string) => {
      const response = await fetch(`/api/theory/admin/${resource}`, { headers })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || `Could not load ${resource}`)
      return body[resource] as Row[]
    }
    try {
      const [c, d, s, q] = await Promise.all(["collections", "disciplines", "sets", "questions"].map(fetchRows))
      setCollections(c); setDisciplines(d); setSets(s); setQuestions(q)
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to load Theory content.") }
  }
  useEffect(() => { reload() }, [adminToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDisciplines = useMemo(() => disciplines.filter(x => x.collection_id === question.collectionId), [disciplines, question.collectionId])
  const filteredSets = useMemo(() => sets.filter(x => x.discipline_id === question.disciplineId), [sets, question.disciplineId])
  const createHierarchy = async (resource: "collections" | "disciplines" | "sets") => {
    const title = window.prompt(`Name this Theory ${resource.slice(0, -1)}:`)?.trim()
    if (!title) return
    const body = resource === "collections" ? { title } : resource === "disciplines" ? { title, collectionId: question.collectionId } : { title, collectionId: question.collectionId, disciplineId: question.disciplineId }
    if (resource !== "collections" && !(resource === "disciplines" ? question.collectionId : question.disciplineId)) { setNotice("Select its parent first."); return }
    setBusy(true)
    try { const r = await fetch(`/api/theory/admin/${resource}`, { method: "POST", headers: adminHeaders(adminToken), body: JSON.stringify(body) }); const d = await r.json(); if (!r.ok) throw Error(d.error); await reload(); setNotice(`${title} created.`) } catch (e) { setNotice(e instanceof Error ? e.message : "Save failed.") } finally { setBusy(false) }
  }
  const createQuestion = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true)
    try {
      const r = await fetch("/api/theory/admin/questions", { method: "POST", headers: adminHeaders(adminToken), body: JSON.stringify({ ...question, markingPoints: question.markingPoints.split("\n").map(x => x.trim()).filter(Boolean), tags: question.tags.split(",").map(x => x.trim()).filter(Boolean), estimatedStudyMinutes: Number(question.estimatedStudyMinutes) }) })
      const d = await r.json(); if (!r.ok) throw Error(d.error); setQuestion(x => ({ ...x, prompt: "", modelAnswer: "", markingPoints: "", tags: "" })); await reload(); setNotice("Theory question saved.")
    } catch (e) { setNotice(e instanceof Error ? e.message : "Save failed.") } finally { setBusy(false) }
  }
  if (!adminReady) return <main className="p-8">Loading admin workspace…</main>
  if (!isAdmin) return <main className="mx-auto max-w-xl p-8"><div className="rounded-2xl border border-amber-500/30 bg-card p-6"><ShieldAlert className="text-amber-600"/><h1 className="mt-3 text-xl font-bold">Verified admin access required</h1><p className="mt-2 text-sm text-muted-foreground">Theory collections, questions, imports, and publication controls are only available to verified administrators.</p><Link href="/theory" className="mt-5 inline-flex text-sm font-bold text-primary">Return to Theory Vault</Link></div></main>
  return <main className="min-h-screen bg-background p-4 text-foreground md:p-8"><div className="mx-auto max-w-7xl space-y-6"><header className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/theory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15}/>Theory Vault</Link><h1 className="mt-2 text-3xl font-bold">Theory Vault Editor</h1><p className="mt-1 text-sm text-muted-foreground">Manage the collection → discipline → optional set → theory question hierarchy.</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border bg-card px-4 py-2 text-sm font-bold"><FileUp size={16}/>Import JSON<input className="hidden" type="file" accept="application/json" onChange={() => setNotice("Import preview is available through the verified Theory import API. Select a hierarchy, then upload through your import workflow.")}/></label></header>{notice && <p role="status" className="rounded-xl border bg-card px-4 py-3 text-sm">{notice}</p>}
  <section className="grid gap-4 md:grid-cols-3">{([ ["Collections", collections, "collections"], ["Disciplines", filteredDisciplines, "disciplines"], ["Sets (optional)", filteredSets, "sets"] ] as const).map(([title, rows, resource]) => <div key={title} className="rounded-2xl border bg-card p-4"><div className="flex items-center justify-between"><h2 className="font-bold">{title}</h2><button disabled={busy} onClick={() => createHierarchy(resource)} className="rounded-lg p-1.5 text-primary hover:bg-primary/10" aria-label={`Add ${title}`}><Plus size={18}/></button></div><div className="mt-3 space-y-2">{rows.map(row => <button key={row.id} onClick={() => resource === "collections" ? setQuestion(x => ({ ...x, collectionId: row.id, disciplineId: "", setId: "" })) : resource === "disciplines" ? setQuestion(x => ({ ...x, disciplineId: row.id, setId: "" })) : setQuestion(x => ({ ...x, setId: row.id }))} className="block w-full rounded-lg bg-muted/50 px-3 py-2 text-left text-sm hover:bg-muted">{row.title}</button>)}{!rows.length && <p className="py-3 text-sm text-muted-foreground">None yet.</p>}</div></div>)}</section>
  <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]"><form onSubmit={createQuestion} className="space-y-4 rounded-2xl border bg-card p-5"><div><h2 className="font-bold">New Theory question</h2><p className="text-sm text-muted-foreground">Questions may be attached directly to a discipline when no set is needed.</p></div><div className="grid gap-3 sm:grid-cols-3"><Select label="Collection" value={question.collectionId} onChange={collectionId => setQuestion(x => ({ ...x, collectionId, disciplineId: "", setId: "" }))} rows={collections}/><Select label="Discipline" value={question.disciplineId} onChange={disciplineId => setQuestion(x => ({ ...x, disciplineId, setId: "" }))} rows={filteredDisciplines}/><Select label="Set (optional)" value={question.setId} onChange={setId => setQuestion(x => ({ ...x, setId }))} rows={filteredSets} optional/></div><Field label="Prompt" area value={question.prompt} onChange={prompt => setQuestion(x => ({ ...x, prompt }))}/><Field label="Model answer" area value={question.modelAnswer} onChange={modelAnswer => setQuestion(x => ({ ...x, modelAnswer }))}/><Field label="Marking points (one per line)" area value={question.markingPoints} onChange={markingPoints => setQuestion(x => ({ ...x, markingPoints }))}/><div className="grid gap-3 sm:grid-cols-3"><Field label="Tags (comma-separated)" value={question.tags} onChange={tags => setQuestion(x => ({ ...x, tags }))}/><Field label="Minutes" value={question.estimatedStudyMinutes} onChange={estimatedStudyMinutes => setQuestion(x => ({ ...x, estimatedStudyMinutes }))}/><label className="text-sm font-medium">Status<select value={question.publicationStatus} onChange={e => setQuestion(x => ({ ...x, publicationStatus: e.target.value }))} className="mt-1 w-full rounded-lg border bg-background px-3 py-2"><option value="draft">Draft</option><option value="published">Published</option><option value="unpublished">Review</option></select></label></div><button disabled={busy} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">Save Theory question</button></form><section className="rounded-2xl border bg-card p-5"><h2 className="font-bold">Questions</h2><p className="mt-1 text-sm text-muted-foreground">{questions.length} total records. Use publishing and archiving workflows to preserve an audit trail.</p><div className="mt-4 max-h-96 space-y-2 overflow-auto">{questions.slice(0, 30).map(q => <div key={q.id} className="rounded-lg border p-3"><p className="line-clamp-2 text-sm font-medium">{q.prompt}</p><p className="mt-1 text-xs text-muted-foreground">{q.publication_status || "draft"} · order {q.sort_order ?? 0}</p></div>)}</div></section></section></div></main>
}
function Select({ label, value, onChange, rows, optional = false }: { label: string; value: string; onChange: (x: string) => void; rows: Row[]; optional?: boolean }) { return <label className="text-sm font-medium">{label}<select required={!optional} value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2"><option value="">{optional ? "No set" : "Select"}</option>{rows.map(x => <option value={x.id} key={x.id}>{x.title}</option>)}</select></label> }
function Field({ label, value, onChange, area = false }: { label: string; value: string; onChange: (x: string) => void; area?: boolean }) { return <label className="block text-sm font-medium">{label}{area ? <textarea required={label === "Prompt" || label === "Model answer"} value={value} onChange={e => onChange(e.target.value)} className="mt-1 min-h-24 w-full rounded-lg border bg-background px-3 py-2"/> : <input value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2"/>}</label> }
