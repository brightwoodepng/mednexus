"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, CloudOff, Database, Download, HardDriveDownload, Layers3, MoreVertical, Share, Trash2, Wifi, X } from "lucide-react"
import { useQuestions } from "@/contexts/questions-context"
import { useApp } from "@/contexts/app-context"
import { downloadTheorySet, offlineTheoryFetch } from "@/lib/offline-storage"

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
type InstallWindow = Window & { __mednexusInstallPrompt?: InstallPrompt }
type TheorySet = { id: string; moduleId?: string | null; disciplineId?: string | null; setLabel?: string; name: string; totalQuestions: number }
type TheoryCatalog = {
  modules: Array<{ id: string; name: string }>
  disciplines: Array<{ id: string; name: string }>
  sets: TheorySet[]
}

function theoryGroups(catalog: TheoryCatalog | null) {
  if (!catalog) return []
  const modules = new Map(catalog.modules.map(module => [module.id, module.name]))
  const disciplines = new Map(catalog.disciplines.map(discipline => [discipline.id, discipline.name]))
  const groups = new Map<string, { id: string; name: string; sets: TheorySet[] }>()
  for (const set of catalog.sets) {
    const id = set.moduleId ? `module:${set.moduleId}` : set.disciplineId ? `discipline:${set.disciplineId}` : "theory:other"
    const name = (set.moduleId && modules.get(set.moduleId)) || (set.disciplineId && disciplines.get(set.disciplineId)) || "Other Theory"
    const group = groups.get(id) ?? { id, name, sets: [] }
    group.sets.push(set)
    groups.set(id, group)
  }
  return [...groups.values()]
}

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function OfflineDownloads() {
  const { user } = useApp()
  const { catalog, offlinePacks, downloadModule, removeOfflinePack, refreshOfflinePacks } = useQuestions()
  const [theoryCatalog, setTheoryCatalog] = useState<TheoryCatalog | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [installHelp, setInstallHelp] = useState("")
  const [installReady, setInstallReady] = useState(false)
  const [showInstallGuide, setShowInstallGuide] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [message, setMessage] = useState("")

  useEffect(() => {
    const update = () => setInstallReady(Boolean((window as InstallWindow).__mednexusInstallPrompt))
    update()
    window.addEventListener("mednexus-install-ready", update)
    if (navigator.onLine) void offlineTheoryFetch<TheoryCatalog>("/api/theory?mode=catalog").then(setTheoryCatalog).catch(() => undefined)
    return () => window.removeEventListener("mednexus-install-ready", update)
  }, [])

  const summary = useMemo(() => {
    const mcqQuestions = catalog.reduce((sum, module) => sum + module.count, 0)
    const theoryQuestions = theoryCatalog?.sets.reduce((sum, set) => sum + Number(set.totalQuestions), 0) ?? 0
    return {
      questions: mcqQuestions + theoryQuestions,
      estimatedBytes: 2 * 1024 * 1024 + mcqQuestions * 12_000 + theoryQuestions * 16_000,
    }
  }, [catalog, theoryCatalog])

  const groupedTheory = useMemo(() => theoryGroups(theoryCatalog), [theoryCatalog])

  const install = async () => {
    const installed = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    if (installed) { setInstallHelp("MedNexus is already installed on this device."); return }
    const prompt = (window as InstallWindow).__mednexusInstallPrompt
    if (prompt) {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice.outcome === "accepted") {
        delete (window as InstallWindow).__mednexusInstallPrompt
        setInstallReady(false)
        setInstallHelp("MedNexus installation started.")
      }
      return
    }
    setShowInstallGuide(true)
  }

  const downloadEverything = async () => {
    if (!user) return
    if (!navigator.onLine) { setMessage("Connect to the internet before downloading all content."); return }
    setDownloading(true)
    setMessage("")
    let done = 0
    try {
      const latestTheory = theoryCatalog ?? await offlineTheoryFetch<TheoryCatalog>("/api/theory?mode=catalog")
      const latestTheoryGroups = theoryGroups(latestTheory)
      const totalGroups = catalog.length + latestTheoryGroups.length
      setTheoryCatalog(latestTheory)
      setProgress({ done: 0, total: totalGroups })
      for (const module of catalog) {
        const result = await downloadModule(module.name)
        if (!result.ok) throw new Error(result.error ?? `Unable to download ${module.name}.`)
        setProgress({ done: ++done, total: totalGroups })
      }
      for (const group of latestTheoryGroups) {
        for (const set of group.sets) await downloadTheorySet(user.uid, set.id, set.setLabel ?? set.name)
        setProgress({ done: ++done, total: totalGroups })
      }
      await refreshOfflinePacks()
      setShowConfirmation(false)
      setMessage("All available MCQ and Theory modules are ready for offline study.")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The download was interrupted. Completed items remain available.")
    } finally { setDownloading(false) }
  }

  const totalBytes = offlinePacks.reduce((sum, pack) => sum + pack.bytes, 0)
  const downloadedGroups = useMemo(() => {
    const setGroups = new Map(groupedTheory.flatMap(group => group.sets.map(set => [set.id, group] as const)))
    const groups = new Map<string, { id: string; title: string; packs: typeof offlinePacks; questions: number; bytes: number }>()
    for (const pack of offlinePacks) {
      const setId = pack.kind === "theory-set" ? pack.id.split(":").at(-1) : null
      const theoryGroup = setId ? setGroups.get(setId) : null
      const id = theoryGroup?.id ?? pack.id
      const title = theoryGroup ? `${theoryGroup.name} · Theory` : pack.title
      const group = groups.get(id) ?? { id, title, packs: [], questions: 0, bytes: 0 }
      group.packs.push(pack)
      group.questions += pack.itemCount ?? pack.questions.length
      group.bytes += pack.bytes
      groups.set(id, group)
    }
    return [...groups.values()]
  }, [groupedTheory, offlinePacks])

  const removeGroup = async (ids: string[]) => {
    if (!window.confirm("Remove this module from offline downloads? You can download it again at any time.")) return
    for (const id of ids) await removeOfflinePack(id)
  }
  return <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="offline-downloads-title">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><HardDriveDownload size={19}/></span><div><h2 id="offline-downloads-title" className="font-semibold">Install &amp; Study Offline</h2><p className="mt-1 text-xs text-muted-foreground sm:text-sm">Get the full MedNexus experience on your device. Study anytime, anywhere — no internet required.</p></div></div>
    <div className="grid shrink-0 gap-2 sm:grid-cols-2">
      <button type="button" onClick={() => void install()} className="flex min-h-12 items-center justify-center gap-3 rounded-xl bg-cyan-500 px-5 text-sm font-bold text-white shadow-sm hover:bg-cyan-400"><Download size={18}/><span className="text-left">Download for device<small className="block text-[10px] font-medium text-white/75">{installReady ? "Install prompt ready" : "Install the MedNexus app"}</small></span></button>
      <button type="button" disabled={!catalog.length || downloading} onClick={() => setShowConfirmation(true)} className="flex min-h-12 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-50"><Database size={18}/><span className="text-left">Download Everything<small className="block text-[10px] font-medium text-white/75">Full library for offline use</small></span></button>
    </div></div>
    {installHelp && <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-muted/55 p-3 text-sm text-muted-foreground"><Share size={16} className="mt-0.5 shrink-0"/>{installHelp}</p>}
    {showConfirmation && <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4"><h3 className="font-bold">Download all offline content?</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><Summary label="MCQ modules" value={catalog.length}/><Summary label="Theory modules" value={groupedTheory.length}/><Summary label="Questions" value={summary.questions}/><Summary label="Estimated size" value={sizeLabel(summary.estimatedBytes)}/></div><p className="mt-3 text-xs text-muted-foreground">Each module download automatically includes all of its sets. Clinical images may increase the final storage used.</p>{downloading && <div className="mt-3"><div className="mb-1 flex justify-between text-xs font-semibold"><span>Downloading modules…</span><span>{progress.done}/{progress.total}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.total ? progress.done / progress.total * 100 : 0}%` }}/></div></div>}<div className="mt-4 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={downloading} onClick={() => setShowConfirmation(false)} className="min-h-10 flex-1 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50">Cancel</button><button type="button" disabled={downloading} onClick={() => void downloadEverything()} className="min-h-10 flex-1 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50">Confirm download</button></div></div>}
    {message && <p role="status" className="mt-3 rounded-xl bg-muted/55 p-3 text-sm text-muted-foreground">{message}</p>}
    <div className="mt-4 grid gap-2 rounded-xl border border-border bg-background/35 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-3"><span className="flex items-center gap-3"><Download size={17}/><b className="text-foreground">{downloadedGroups.length}<small className="block font-normal text-muted-foreground">Downloaded modules</small></b></span><span className="flex items-center gap-3 border-border sm:border-l sm:pl-6"><Database size={17}/><b className="text-foreground">{offlinePacks.length ? sizeLabel(totalBytes) : sizeLabel(summary.estimatedBytes)}<small className="block font-normal text-muted-foreground">{offlinePacks.length ? "Storage used" : "Estimated full library"}</small></b></span><span className="flex items-center gap-3 border-border sm:border-l sm:pl-6"><CloudOff size={17}/><span>Offline access includes MCQs, Theory answers, images, notes and saved progress.</span></span></div>
    {downloadedGroups.length ? <details className="group mt-3 overflow-hidden rounded-xl border border-border bg-background/25"><summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-4 py-3"><Layers3 size={17} className="text-primary"/><span className="flex-1 text-sm font-semibold">Downloaded modules</span><span className="text-xs text-muted-foreground">{downloadedGroups.length} {downloadedGroups.length === 1 ? "module" : "modules"}</span><ChevronDown size={16} className="transition-transform group-open:rotate-180"/></summary><ul className="max-h-72 divide-y divide-border overflow-y-auto border-t border-border px-4">{downloadedGroups.map(group => <li key={group.id} className="flex items-center gap-3 py-3"><Wifi size={15} className="shrink-0 text-emerald-500"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{group.title}</p><p className="text-xs text-muted-foreground">{group.questions} questions · {sizeLabel(group.bytes)}{group.packs.length > 1 ? ` · ${group.packs.length} sets included` : ""}</p></div><button type="button" onClick={() => void removeGroup(group.packs.map(pack => pack.id))} aria-label={`Remove ${group.title} offline download`} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15}/></button></li>)}</ul></details> : <p className="mt-4 text-sm text-muted-foreground">Nothing downloaded yet. Download everything here or choose individual modules.</p>}
    {showInstallGuide && <div className="fixed inset-0 z-[120] flex items-end bg-black/65 p-3 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="install-guide-title" onClick={() => setShowInstallGuide(false)}><div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={event => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><h3 id="install-guide-title" className="font-bold">Install MedNexus on this device</h3><p className="mt-1 text-xs text-muted-foreground">Your browser requires one final confirmation.</p></div><button type="button" onClick={() => setShowInstallGuide(false)} aria-label="Close installation guide" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18}/></button></div><ol className="mt-4 space-y-3 text-sm"><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">1</span><span>Open the browser menu: tap <Share className="mx-1 inline" size={15}/> <b>Share</b> on iPhone/iPad, or <MoreVertical className="mx-1 inline" size={15}/> on Android or desktop.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">2</span><span>Choose <b>Add to Home Screen</b> or <b>Install app</b>.</span></li><li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">3</span><span>Confirm <b>Add</b> or <b>Install</b>.</span></li></ol><button type="button" onClick={() => setShowInstallGuide(false)} className="mt-5 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground">Got it</button></div></div>}
  </section>
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-background/70 p-2.5"><p className="font-bold tabular-nums">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
}
