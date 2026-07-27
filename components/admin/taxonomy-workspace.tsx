"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowRight, ChevronDown, Edit3, Loader2, Waypoints } from "lucide-react"

type Module = { name: string; questionCount: number; disciplines: Array<{ name: string; questionCount: number }> }

export function TaxonomyWorkspace() {
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const load = useCallback(async () => { setLoading(true); const response = await fetch("/api/admin/taxonomy"); const body = await response.json(); if (response.ok) setModules(body.modules ?? []); setLoading(false) }, [])
  useEffect(() => { load() }, [load])
  async function rename(action: "rename_module" | "rename_discipline", module: string, discipline?: string) {
    const current = discipline || module
    const newName = window.prompt(`Rename “${current}” to:`, current)?.trim()
    if (!newName || newName === current || !window.confirm(`Update every affected MCQ from “${current}” to “${newName}”?`)) return
    const response = await fetch("/api/admin/taxonomy", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, module, discipline, newName, confirm: true }) })
    const body = await response.json(); setMessage(response.ok ? `${body.affected} questions updated.` : body.error); if (response.ok) await load()
  }
  async function move(module: string, discipline: string) {
    const destinationModule = window.prompt(`Move “${discipline}” to which module?`)?.trim()
    if (!destinationModule || !window.confirm(`Move all “${discipline}” questions to “${destinationModule}”?`)) return
    const response = await fetch("/api/admin/taxonomy", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "move_discipline", module, discipline, destinationModule, destinationDiscipline: discipline, confirm: true }) })
    const body = await response.json(); setMessage(response.ok ? `${body.affected} questions moved.` : body.error); if (response.ok) await load()
  }
  return <div className="max-w-5xl space-y-5">
    <div><p className="text-sm font-semibold tracking-wide text-primary">CONTENT STRUCTURE</p><h1 className="mt-2 text-3xl font-bold">Modules &amp; Disciplines</h1><p className="mt-2 text-sm text-muted-foreground">MCQ groups are derived from question metadata. Renames and moves update every affected question atomically.</p></div>
    <div className="flex flex-wrap gap-2"><Link href="/admin/mcq" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Open MCQ Bank <ArrowRight size={15} /></Link><Link href="/admin/theory" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold">Manage Theory hierarchy <ArrowRight size={15} /></Link></div>
    {message && <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{message}</p>}
    <section className="overflow-hidden rounded-xl border border-border bg-card">{loading ? <div className="flex min-h-52 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div> : modules.length === 0 ? <p className="p-12 text-center text-sm text-muted-foreground">The MCQ bank has no taxonomy groups.</p> : <div className="divide-y divide-border">{modules.map((module) => <div key={module.name}>
      <div className="flex items-center gap-3 p-4"><button onClick={() => setExpanded(expanded === module.name ? null : module.name)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Waypoints size={18} /></span><span className="min-w-0"><span className="block truncate font-semibold">{module.name}</span><span className="text-xs text-muted-foreground">{module.disciplines.length} disciplines · {module.questionCount} questions</span></span><ChevronDown className={`ml-auto transition-transform ${expanded === module.name ? "rotate-180" : ""}`} size={17} /></button><button aria-label={`Rename ${module.name}`} onClick={() => rename("rename_module", module.name)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><Edit3 size={14} /></button></div>
      {expanded === module.name && <div className="border-t border-border bg-muted/20 px-4 py-2">{module.disciplines.map((discipline) => <div key={discipline.name} className="flex items-center gap-2 border-b border-border/50 py-3 pl-4 last:border-0"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{discipline.name}</span><span className="text-xs text-muted-foreground">{discipline.questionCount} questions</span></span><button onClick={() => move(module.name, discipline.name)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Move</button><button aria-label={`Rename ${discipline.name}`} onClick={() => rename("rename_discipline", module.name, discipline.name)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border"><Edit3 size={14} /></button></div>)}</div>}
    </div>)}</div>}</section>
    <p className="text-xs text-muted-foreground">Empty MCQ groups are not stored. To remove a populated group, move its questions first. Theory retains its own publication and non-empty hierarchy safeguards.</p>
  </div>
}
