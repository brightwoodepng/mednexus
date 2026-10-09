"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowRight, ChevronDown, Loader2, MoveRight, Pencil, RefreshCw, Search, Waypoints, X } from "lucide-react"
import { TheoryTaxonomyWorkspace } from "@/components/admin/theory-taxonomy-workspace"

type Module = { name: string; questionCount: number; disciplines: Array<{ name: string; questionCount: number }> }
type Dialog = { kind: "rename-module" | "rename-discipline" | "move-discipline"; module: string; discipline?: string }

async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown>>
}

export function TaxonomyWorkspace({ canManageMcq = true, canManageTheory = true }: { canManageMcq?: boolean; canManageTheory?: boolean }) {
  const [bank, setBank] = useState<"mcq" | "theory">(canManageMcq ? "mcq" : "theory")
  return <div className="mx-auto min-w-0 max-w-6xl space-y-5 [overflow-wrap:anywhere]">
    <header><h1 className="text-2xl font-bold">Modules &amp; Disciplines</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Organise your question banks: edit group names, review their content, and manage where questions belong.</p></header>
    <nav aria-label="Question bank" className="flex flex-wrap gap-2">
      {canManageMcq && <button aria-pressed={bank === "mcq"} onClick={() => setBank("mcq")} className={`min-h-11 rounded-xl border px-5 text-sm font-semibold ${bank === "mcq" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>MCQ Bank</button>}
      {canManageTheory && <button aria-pressed={bank === "theory"} onClick={() => setBank("theory")} className={`min-h-11 rounded-xl border px-5 text-sm font-semibold ${bank === "theory" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>Theory Vault</button>}
    </nav>
    {bank === "mcq" && canManageMcq ? <McqTaxonomyWorkspace /> : canManageTheory ? <TheoryTaxonomyWorkspace /> : null}
  </div>
}

function McqTaxonomyWorkspace() {
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
  const [allowMerge, setAllowMerge] = useState(false)
  const [requiresMerge, setRequiresMerge] = useState(false)

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
    return modules.map(module => ({ ...module, disciplines: module.name.toLowerCase().includes(needle) ? module.disciplines : module.disciplines.filter(item => item.name.toLowerCase().includes(needle)) }))
      .filter(module => module.name.toLowerCase().includes(needle) || module.disciplines.length)
  }, [modules, query])
  const totals = useMemo(() => ({ questions: modules.reduce((sum, item) => sum + item.questionCount, 0), disciplines: modules.reduce((sum, item) => sum + item.disciplines.length, 0) }), [modules])

  const openDialog = (next: Dialog) => { setDialog(next); setName(next.discipline ?? next.module); setDestination(""); setAllowMerge(false); setRequiresMerge(false); setError(""); setMessage("") }
  const sourceModule = modules.find(item => item.name === dialog?.module)
  const affected = dialog?.kind === "rename-module" ? sourceModule?.questionCount ?? 0 : sourceModule?.disciplines.find(item => item.name === dialog?.discipline)?.questionCount ?? 0
  const targetExists = dialog?.kind === "rename-module"
    ? name.trim() !== dialog.module && modules.some(item => item.name === name.trim())
    : dialog?.kind === "rename-discipline"
      ? name.trim() !== dialog.discipline && Boolean(sourceModule?.disciplines.some(item => item.name === name.trim()))
      : Boolean(modules.find(item => item.name === destination)?.disciplines.some(item => item.name === dialog?.discipline))
  const closeDialog = () => { if (!saving) setDialog(null) }
  async function submit() {
    if (!dialog) return
    const action = dialog.kind === "rename-module" ? "rename_module" : dialog.kind === "rename-discipline" ? "rename_discipline" : "move_discipline"
    if (action !== "move_discipline" && !name.trim()) return setError("Enter a new name.")
    if (action === "move_discipline" && !destination) return setError("Choose a destination module.")
    if ((targetExists || requiresMerge) && !allowMerge) return setError("Confirm combining these groups first.")
    setSaving(true); setError("")
    try {
    const response = await fetch("/api/admin/taxonomy", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, module: dialog.module, discipline: dialog.discipline, newName: name.trim(), destinationModule: destination, destinationDiscipline: dialog.discipline, allowMerge, confirm: true }) })
    const body = await readJson(response)
    if (!response.ok) { setError(String(body.error || "Taxonomy was not changed.")); setRequiresMerge(body.requiresMerge === true) }
    else { setMessage(`${Number(body.affected ?? 0)} questions updated.`); setDialog(null); await load() }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Update failed. Refresh to check the current names, then retry.") }
    finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-primary">MCQ organisation</p><h2 className="mt-1 text-xl font-bold">Manage MCQ groups</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Modules contain disciplines. Rename a group or move a discipline to update its questions together. Create new groups when adding or importing MCQs.</p></div><div className="flex flex-wrap gap-2"><Link href="/admin/mcq" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">MCQ Bank <ArrowRight size={15}/></Link><Link href="/admin/theory" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold">Theory editor <ArrowRight size={15}/></Link></div></header>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[["Modules", modules.length], ["Disciplines", totals.disciplines], ["Questions", totals.questions]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{Number(value).toLocaleString()}</p></div>)}</section>
    <div className="flex gap-2"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3"><Search size={16} className="text-muted-foreground"/><input value={query} onChange={event => setQuery(event.target.value)} aria-label="Search MCQ modules or disciplines" placeholder="Search modules or disciplines" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label><button onClick={() => void load()} aria-label="Refresh taxonomy" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border"><RefreshCw size={16}/></button></div>
    {message && <div role="status" className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</div>}
    {error && !dialog && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}<button onClick={() => void load()} className="ml-3 font-semibold underline">Retry</button></div>}
    <section className="overflow-hidden rounded-xl border border-border bg-card">{loading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-primary"/></div> : filtered.length ? <div className="divide-y divide-border">{filtered.map(module => { const open = expanded.has(module.name) || Boolean(query); return <article key={module.name}><div className="flex items-center gap-2 p-3 sm:p-4"><button onClick={() => setExpanded(current => { const next = new Set(current); if (next.has(module.name)) next.delete(module.name); else next.add(module.name); return next })} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Waypoints size={17}/></span><span className="min-w-0 flex-1"><b className="block break-words text-sm">{module.name}</b><span className="text-xs text-muted-foreground">{module.disciplines.length} disciplines · {module.questionCount} questions</span></span><ChevronDown size={17} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}/></button><button onClick={() => openDialog({ kind: "rename-module", module: module.name })} aria-label={`Rename ${module.name}`} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold"><Pencil size={15}/><span className="hidden sm:inline">Rename</span></button></div>{open && <div className="border-t border-border bg-muted/20 p-2 sm:p-3">{module.disciplines.map(discipline => <div key={discipline.name} className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2.5 hover:bg-card"><span className="min-w-0 basis-full flex-1 sm:basis-auto"><b className="block break-words text-sm font-medium">{discipline.name}</b><span className="text-xs text-muted-foreground">{discipline.questionCount} questions</span></span><button onClick={() => openDialog({ kind: "rename-discipline", module: module.name, discipline: discipline.name })} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold"><Pencil size={13}/>Rename</button><button onClick={() => openDialog({ kind: "move-discipline", module: module.name, discipline: discipline.name })} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold"><MoveRight size={13}/>Move</button></div>)}</div>}</article> })}</div> : <p className="p-12 text-center text-sm text-muted-foreground">No matching taxonomy groups.</p>}</section>
    {dialog && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3" onMouseDown={event => { if (event.currentTarget === event.target) closeDialog() }}><div role="dialog" aria-modal="true" aria-label={dialog.kind.replaceAll("-", " ")} className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="font-bold capitalize">{dialog.kind.replaceAll("-", " ")}</h2><p className="mt-1 text-sm text-muted-foreground">{dialog.discipline ?? dialog.module} · {affected.toLocaleString()} questions will update together</p></div><button onClick={closeDialog} aria-label="Close" className="rounded-lg p-2 hover:bg-muted"><X size={17}/></button></div>{dialog.kind === "move-discipline" ? <label className="mt-5 block text-sm font-semibold">Destination module<select value={destination} onChange={event => { setDestination(event.target.value); setAllowMerge(false); setRequiresMerge(false) }} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"><option value="">Choose a module</option>{modules.filter(item => item.name !== dialog.module).map(item => <option key={item.name}>{item.name}</option>)}</select></label> : <label className="mt-5 block text-sm font-semibold">New name<input autoFocus value={name} maxLength={160} onChange={event => { setName(event.target.value); setAllowMerge(false); setRequiresMerge(false) }} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"/></label>}{(targetExists || requiresMerge) && <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><input type="checkbox" checked={allowMerge} onChange={event => setAllowMerge(event.target.checked)} className="mt-1"/><span>A group with this name already exists. Combine these questions into that group.</span></label>}{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={closeDialog} disabled={saving} className="min-h-10 rounded-lg border border-border px-4 text-sm font-semibold">Cancel</button><button onClick={() => void submit()} disabled={saving} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving && <Loader2 className="animate-spin" size={15}/>}Confirm update</button></div></div></div>}
  </div>
}
