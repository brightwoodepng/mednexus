"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, ChevronDown, Loader2, MoveRight, Pencil, RefreshCw, Search, Waypoints, X } from "lucide-react"

type Module = { name: string; questionCount: number; disciplines: Array<{ name: string; questionCount: number }> }
type Dialog = { kind: "rename-module" | "rename-discipline" | "move-discipline"; module: string; discipline?: string }

async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>
}

export function TaxonomyWorkspace() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [name, setName] = useState("")
  const [destination, setDestination] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const response = await fetch("/api/admin/taxonomy", { cache: "no-store" })
      const body = await readJson(response)
      if (!response.ok) throw new Error(String(body.error || "Unable to load modules and disciplines."))
      setModules((body.modules as Module[]) ?? [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load modules and disciplines.") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return modules
    return modules.map(module => ({ ...module, disciplines: module.disciplines.filter(item => item.name.toLowerCase().includes(needle)) }))
      .filter(module => module.name.toLowerCase().includes(needle) || module.disciplines.length)
  }, [modules, query])
  const totals = useMemo(() => ({ questions: modules.reduce((sum, item) => sum + item.questionCount, 0), disciplines: modules.reduce((sum, item) => sum + item.disciplines.length, 0) }), [modules])

  const openDialog = (next: Dialog) => { setDialog(next); setName(next.discipline ?? next.module); setDestination(""); setError("") }
  const closeDialog = () => { if (!saving) setDialog(null) }
  async function submit() {
    if (!dialog) return
    const action = dialog.kind === "rename-module" ? "rename_module" : dialog.kind === "rename-discipline" ? "rename_discipline" : "move_discipline"
    if (action !== "move_discipline" && !name.trim()) return setError("Enter a new name.")
    if (action === "move_discipline" && !destination) return setError("Choose a destination module.")
    setSaving(true); setError("")
    const response = await fetch("/api/admin/taxonomy", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, module: dialog.module, discipline: dialog.discipline, newName: name.trim(), destinationModule: destination, destinationDiscipline: dialog.discipline, confirm: true }) })
    const body = await readJson(response)
    if (!response.ok) setError(String(body.error || "Taxonomy was not changed."))
    else { setMessage(`${Number(body.affected ?? 0)} questions updated.`); setDialog(null); await load() }
    setSaving(false)
  }

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">MCQ taxonomy</p><h1 className="mt-1 text-2xl font-bold">Modules &amp; Disciplines</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">These groups come from MCQ metadata. Renaming or moving a group updates every matching question.</p></div><div className="flex gap-2"><Link href="/admin/mcq" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">MCQ Bank <ArrowRight size={15}/></Link><Link href="/admin/theory" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold">Theory hierarchy <ArrowRight size={15}/></Link></div></header>
    <section className="grid grid-cols-3 gap-3">{[["Modules", modules.length], ["Disciplines", totals.disciplines], ["Questions", totals.questions]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{Number(value).toLocaleString()}</p></div>)}</section>
    <div className="flex gap-2"><label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3"><Search size={16} className="text-muted-foreground"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search modules or disciplines" className="w-full bg-transparent text-sm outline-none"/></label><button onClick={() => void load()} aria-label="Refresh taxonomy" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border"><RefreshCw size={16}/></button></div>
    {message && <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</div>}
    {error && !dialog && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}<button onClick={() => void load()} className="ml-3 font-semibold underline">Retry</button></div>}
    <section className="overflow-hidden rounded-xl border border-border bg-card">{loading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-primary"/></div> : filtered.length ? <div className="divide-y divide-border">{filtered.map(module => { const open = expanded.has(module.name) || Boolean(query); return <article key={module.name}><div className="flex items-center gap-2 p-3 sm:p-4"><button onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(module.name)) next.delete(module.name); else next.add(module.name); return next })} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Waypoints size={17}/></span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{module.name}</b><span className="text-xs text-muted-foreground">{module.disciplines.length} disciplines · {module.questionCount} questions</span></span><ChevronDown size={17} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}/></button><button onClick={() => openDialog({ kind: "rename-module", module: module.name })} aria-label={`Rename ${module.name}`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><Pencil size={15}/></button></div>{open && <div className="border-t border-border bg-muted/20 p-2 sm:p-3">{module.disciplines.map(discipline => <div key={discipline.name} className="flex items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-card"><span className="min-w-0 flex-1"><b className="block truncate text-sm font-medium">{discipline.name}</b><span className="text-xs text-muted-foreground">{discipline.questionCount} questions</span></span><button onClick={() => openDialog({ kind: "rename-discipline", module: module.name, discipline: discipline.name })} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold"><Pencil size={13}/>Rename</button><button onClick={() => openDialog({ kind: "move-discipline", module: module.name, discipline: discipline.name })} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold"><MoveRight size={13}/>Move</button></div>)}</div>}</article> })}</div> : <p className="p-12 text-center text-sm text-muted-foreground">No matching taxonomy groups.</p>}</section>
    {dialog && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3" onMouseDown={event => { if (event.currentTarget === event.target) closeDialog() }}><div role="dialog" aria-modal="true" aria-label={dialog.kind.replaceAll("-", " ")} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="font-bold capitalize">{dialog.kind.replaceAll("-", " ")}</h2><p className="mt-1 text-sm text-muted-foreground">{dialog.discipline ?? dialog.module} · affected questions will update together</p></div><button onClick={closeDialog} aria-label="Close" className="rounded-lg p-2 hover:bg-muted"><X size={17}/></button></div>{dialog.kind === "move-discipline" ? <label className="mt-5 block text-sm font-semibold">Destination module<select value={destination} onChange={event => setDestination(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="">Choose a module</option>{modules.filter(item => item.name !== dialog.module).map(item => <option key={item.name}>{item.name}</option>)}</select></label> : <label className="mt-5 block text-sm font-semibold">New name<input autoFocus value={name} onChange={event => setName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"/></label>}{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={closeDialog} disabled={saving} className="min-h-10 rounded-lg border border-border px-4 text-sm font-semibold">Cancel</button><button onClick={() => void submit()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving && <Loader2 className="animate-spin" size={15}/>}Confirm update</button></div></div></div>}
  </div>
}
