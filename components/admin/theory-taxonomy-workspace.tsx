"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, Pencil, Plus, RefreshCw, Search, X } from "lucide-react"

type Kind = "end_of_module" | "end_of_year"
type Group = { id: string; collectionId: string; name: string; description?: string }
type Collection = { id: string; title: string; kind: Kind }
type SetRow = { id: string; moduleId: string | null; disciplineId: string | null; questionCount: number }
type Stat = { setGrouping: number; moduleGrouping: number; disciplineGrouping: number; collectionId: string; moduleId: string | null; disciplineId: string | null; setId: string | null; total: number; draft: number; live: number }
type Data = { collections: Collection[]; modules: Group[]; disciplines: Group[]; sets: SetRow[]; hierarchyStats: Stat[] }
type Edit = { resource: "module" | "discipline"; group?: Group }
const empty: Data = { collections: [], modules: [], disciplines: [], sets: [], hierarchyStats: [] }
const control = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm"
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50"

export function TheoryTaxonomyWorkspace() {
  const [kind, setKind] = useState<Kind>("end_of_module")
  const [data, setData] = useState<Data>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [edit, setEdit] = useState<Edit | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [collectionId, setCollectionId] = useState("")
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const id = ++requestId.current
    setLoading(true); setError("")
    try {
      const response = await fetch(`/api/admin/theory?kind=${kind}&view=taxonomy`, { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Unable to load Theory groups.")
      if (id === requestId.current) setData(body)
    } catch (cause) {
      if (id === requestId.current) setError(cause instanceof Error ? cause.message : "Unable to load Theory groups.")
    } finally { if (id === requestId.current) setLoading(false) }
  }, [kind])
  useEffect(() => { setData(empty); setQuery(""); setMessage(""); void load(); return () => { requestId.current++ } }, [load])

  // GROUPING SETS returns detailed rows and subtotals. Count only the
  // module/discipline subtotal rows, never add them to set-level rows.
  const counts = (group: Group, resource: Edit["resource"]) => {
    const stats = data.hierarchyStats.filter(row => row.collectionId === group.collectionId && row.setGrouping === 1 && row.moduleGrouping === 0 && row.disciplineGrouping === 0
      && (resource === "module" ? row.moduleId === group.id : row.disciplineId === group.id))
    return {
      questions: stats.reduce((sum, row) => sum + Number(row.total), 0),
      draft: stats.reduce((sum, row) => sum + Number(row.draft), 0),
      live: stats.reduce((sum, row) => sum + Number(row.live), 0),
      sets: data.sets.filter(row => resource === "module" ? row.moduleId === group.id : row.disciplineId === group.id).length,
    }
  }
  const needle = query.trim().toLowerCase()
  const sections = useMemo(() => [
    { resource: "module" as const, label: "Modules", groups: data.modules },
    { resource: "discipline" as const, label: "Disciplines", groups: data.disciplines },
  ], [data])
  const totalQuestions = data.hierarchyStats.filter(row => row.moduleGrouping === 1 && row.disciplineGrouping === 1 && row.setGrouping === 1).reduce((sum, row) => sum + Number(row.total), 0)
  const open = (resource: Edit["resource"], group?: Group) => {
    setEdit({ resource, group }); setName(group?.name ?? ""); setDescription(group?.description ?? "")
    setCollectionId(group?.collectionId ?? data.collections[0]?.id ?? ""); setError(""); setMessage("")
  }
  const close = () => { if (!saving) setEdit(null) }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!edit || saving) return
    if (!name.trim() || !collectionId) { setError("Enter a name and choose a collection."); return }
    const peers = edit.resource === "module" ? data.modules : data.disciplines
    if (peers.some(group => group.collectionId === collectionId && group.id !== edit.group?.id && group.name.toLowerCase() === name.trim().toLowerCase())) {
      setError("This name already exists in this collection. Choose a different name."); return
    }
    setSaving(true); setError("")
    try {
      const response = await fetch("/api/admin/theory", {
        method: edit.group ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resource: edit.resource, id: edit.group?.id, collectionId, name: name.trim(), ...(edit.resource === "module" ? { description: description.trim() } : {}) }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Unable to save this group.")
      setMessage(`${edit.resource === "module" ? "Module" : "Discipline"} ${edit.group ? "updated" : "created"}.`)
      setEdit(null); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save this group.") }
    finally { setSaving(false) }
  }
  return <div className="min-w-0 space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1"><h2 className="text-xl font-bold">Manage Theory groups</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Create and rename groups within each collection. End of Module uses modules; End of Year uses disciplines. Related disciplines can also organise module questions.</p></div>
      <Link href={`/admin/theory?kind=${kind}`} className={button}>Open Theory editor</Link>
    </header>
    <nav aria-label="Theory category" className="flex flex-wrap gap-2">
      {(["end_of_module", "end_of_year"] as const).map(value => <button key={value} onClick={() => setKind(value)} aria-pressed={kind === value} className={`${button} ${kind === value ? "border-primary bg-primary/10 text-primary" : ""}`}>{value === "end_of_module" ? "End of Module" : "End of Year"}</button>)}
    </nav>
    <div className="grid gap-3 sm:grid-cols-3">{[["Modules", data.modules.length], ["Disciplines", data.disciplines.length], ["Questions", totalQuestions]].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{Number(value).toLocaleString()}</p></div>)}</div>
    <div className="flex min-w-0 gap-2"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3"><Search size={16} className="shrink-0 text-muted-foreground"/><input aria-label="Search Theory modules or disciplines" placeholder="Search modules or disciplines" value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label><button className={button} onClick={() => void load()} aria-label="Refresh Theory groups" disabled={saving || loading}><RefreshCw size={16}/></button></div>
    {message && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm">{message}</p>}
    {error && !edit && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {loading ? <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin" aria-label="Loading Theory groups"/></div> : sections.map(section => <section key={section.resource} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-4"><h3 className="font-semibold">{section.label}</h3><button className={button} disabled={!data.collections.length || Boolean(error)} onClick={() => open(section.resource)}><Plus size={16}/>Add {section.resource}</button></div>
      {section.groups.filter(group => group.name.toLowerCase().includes(needle) || data.collections.find(collection => collection.id === group.collectionId)?.title.toLowerCase().includes(needle)).map(group => {
        const count = counts(group, section.resource)
        const isPrimary = kind === "end_of_module" ? section.resource === "module" : section.resource === "discipline"
        const href = `/admin/theory?kind=${kind}${isPrimary ? `&${section.resource === "module" ? "moduleId" : "disciplineId"}=${encodeURIComponent(group.id)}` : ""}`
        return <article key={group.id} className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border p-4 last:border-0">
          <div className="min-w-0 basis-full flex-1 sm:basis-auto"><h4 className="break-words font-semibold">{group.name}</h4><p className="mt-1 text-xs text-muted-foreground">{data.collections.find(collection => collection.id === group.collectionId)?.title} · {count.questions} questions · {count.sets} sets</p><p className="mt-1 text-xs text-muted-foreground">{count.live} published · {count.draft} drafts</p>{group.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{group.description}</p>}</div>
          <Link href={href} className={button}>{isPrimary ? "View content" : "Open editor"}</Link><button className={button} onClick={() => open(section.resource, group)} aria-label={`Edit ${group.name}`}><Pencil size={14}/>Edit</button>
        </article>
      })}
      {!section.groups.some(group => group.name.toLowerCase().includes(needle) || data.collections.find(collection => collection.id === group.collectionId)?.title.toLowerCase().includes(needle)) && <p className="p-5 text-sm text-muted-foreground">{needle ? "No matching groups." : `No ${section.label.toLowerCase()} yet. Add one to start organising this category.`}</p>}
    </section>)}
    {edit && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3" onMouseDown={event => { if (event.target === event.currentTarget) close() }}><form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="theory-group-edit-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
      <div className="flex items-center justify-between gap-2"><h2 id="theory-group-edit-title" className="font-bold">{edit.group ? "Edit" : "Add"} Theory {edit.resource}</h2><button type="button" onClick={close} disabled={saving} aria-label="Close group editor" className={button}><X size={17}/></button></div>
      {edit.group && <p className="mt-2 text-sm text-muted-foreground">Renaming keeps existing questions, sets and learner progress attached to this group.</p>}
      <label className="mt-4 block text-sm font-semibold">Collection<select required disabled={Boolean(edit.group) || saving} className={control} value={collectionId} onChange={event => setCollectionId(event.target.value)}>{data.collections.map(collection => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</select></label>
      <label className="mt-4 block text-sm font-semibold">Name<input required autoFocus maxLength={160} disabled={saving} value={name} onChange={event => setName(event.target.value)} className={control}/></label>
      {edit.resource === "module" && <label className="mt-4 block text-sm font-semibold">Description (optional)<textarea maxLength={5000} rows={3} disabled={saving} value={description} onChange={event => setDescription(event.target.value)} className={`${control} py-2`}/></label>}
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={close} disabled={saving} className={button}>Cancel</button><button type="submit" disabled={saving || !name.trim()} className={`${button} bg-primary text-primary-foreground`}>{saving && <Loader2 size={15} className="animate-spin"/>}Save {edit.resource}</button></div>
    </form></div>}
  </div>
}
