"use client"

import { useEffect, useMemo, useState } from "react"
import { CloudOff, Database, Download, HardDriveDownload, Share, Trash2, Wifi } from "lucide-react"
import { useQuestions } from "@/contexts/questions-context"
import { useApp } from "@/contexts/app-context"
import { downloadTheorySet, offlineTheoryFetch } from "@/lib/offline-storage"

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
type InstallWindow = Window & { __mednexusInstallPrompt?: InstallPrompt }
type TheoryCatalog = { sets: Array<{ id: string; setLabel?: string; name: string; totalQuestions: number }> }

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
      packs: catalog.length + (theoryCatalog?.sets.length ?? 0),
    }
  }, [catalog, theoryCatalog])

  const install = async () => {
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
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setInstallHelp(ios
      ? "On iPhone or iPad: tap Share, then choose Add to Home Screen."
      : "Open your browser menu and choose Install app or Add to Home screen. If MedNexus is already installed, open it from your apps.")
  }

  const downloadEverything = async () => {
    if (!user) return
    if (!navigator.onLine) { setMessage("Connect to the internet before downloading all content."); return }
    setDownloading(true)
    setMessage("")
    setProgress({ done: 0, total: summary.packs })
    let done = 0
    try {
      for (const module of catalog) {
        const result = await downloadModule(module.name)
        if (!result.ok) throw new Error(result.error ?? `Unable to download ${module.name}.`)
        setProgress({ done: ++done, total: summary.packs })
      }
      const latestTheory = theoryCatalog ?? await offlineTheoryFetch<TheoryCatalog>("/api/theory?mode=catalog")
      for (const set of latestTheory.sets) {
        await downloadTheorySet(user.uid, set.id, set.setLabel ?? set.name)
        setProgress({ done: ++done, total: summary.packs })
      }
      await refreshOfflinePacks()
      setShowConfirmation(false)
      setMessage("All available MCQs and Theory sets are ready for offline study.")
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The download was interrupted. Completed items remain available.")
    } finally { setDownloading(false) }
  }

  const totalBytes = offlinePacks.reduce((sum, pack) => sum + pack.bytes, 0)
  return <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5" aria-labelledby="offline-downloads-title">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><HardDriveDownload size={19}/></span><div><h2 id="offline-downloads-title" className="font-semibold">Install &amp; Study Offline</h2><p className="mt-1 text-xs text-muted-foreground sm:text-sm">Get the full MedNexus experience on your device. Study anytime, anywhere — no internet required.</p></div></div>
    <div className="grid shrink-0 gap-2 sm:grid-cols-2">
      <button type="button" onClick={() => void install()} className="flex min-h-12 items-center justify-center gap-3 rounded-xl bg-cyan-500 px-5 text-sm font-bold text-white shadow-sm hover:bg-cyan-400"><Download size={18}/><span className="text-left">{installReady ? "Install MedNexus" : "Install MedNexus"}<small className="block text-[10px] font-medium text-white/75">Get the desktop app</small></span></button>
      <button type="button" disabled={!catalog.length || downloading} onClick={() => setShowConfirmation(true)} className="flex min-h-12 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-50"><Database size={18}/><span className="text-left">Download Everything<small className="block text-[10px] font-medium text-white/75">Full library for offline use</small></span></button>
    </div></div>
    {installHelp && <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-muted/55 p-3 text-sm text-muted-foreground"><Share size={16} className="mt-0.5 shrink-0"/>{installHelp}</p>}
    {showConfirmation && <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-4"><h3 className="font-bold">Download all offline content?</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><Summary label="MCQ modules" value={catalog.length}/><Summary label="Theory sets" value={theoryCatalog?.sets.length ?? 0}/><Summary label="Questions" value={summary.questions}/><Summary label="Estimated size" value={sizeLabel(summary.estimatedBytes)}/></div><p className="mt-3 text-xs text-muted-foreground">The estimate includes app data and question content. Clinical images may increase the final storage used.</p>{downloading && <div className="mt-3"><div className="mb-1 flex justify-between text-xs font-semibold"><span>Downloading…</span><span>{progress.done}/{progress.total}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.total ? progress.done / progress.total * 100 : 0}%` }}/></div></div>}<div className="mt-4 flex gap-2"><button type="button" disabled={downloading} onClick={() => setShowConfirmation(false)} className="min-h-10 flex-1 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-50">Cancel</button><button type="button" disabled={downloading} onClick={() => void downloadEverything()} className="min-h-10 flex-1 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50">Confirm download</button></div></div>}
    {message && <p role="status" className="mt-3 rounded-xl bg-muted/55 p-3 text-sm text-muted-foreground">{message}</p>}
    <div className="mt-4 grid gap-2 rounded-xl border border-border bg-background/35 px-4 py-3 text-xs text-muted-foreground sm:grid-cols-3"><span className="flex items-center gap-3"><Download size={17}/><b className="text-foreground">{offlinePacks.length}<small className="block font-normal text-muted-foreground">Downloads</small></b></span><span className="flex items-center gap-3 border-border sm:border-l sm:pl-6"><Database size={17}/><b className="text-foreground">{offlinePacks.length ? sizeLabel(totalBytes) : sizeLabel(summary.estimatedBytes)}<small className="block font-normal text-muted-foreground">{offlinePacks.length ? "Storage used" : "Estimated full library"}</small></b></span><span className="flex items-center gap-3 border-border sm:border-l sm:pl-6"><CloudOff size={17}/><span>Offline access includes MCQs, Theory answers, images, notes and saved progress.</span></span></div>
    {offlinePacks.length ? <ul className="mt-3 divide-y divide-border">{offlinePacks.map(pack => <li key={pack.id} className="flex items-center gap-3 py-3"><Wifi size={15} className="shrink-0 text-emerald-500"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{pack.title}</p><p className="text-xs text-muted-foreground">{pack.itemCount ?? pack.questions.length} questions · {sizeLabel(pack.bytes)}</p></div><button type="button" onClick={() => void removeOfflinePack(pack.id)} aria-label={`Remove ${pack.title} offline download`} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15}/></button></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">Nothing downloaded yet. Download everything here or choose individual modules and Theory sets.</p>}
  </section>
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-background/70 p-2.5"><p className="font-bold tabular-nums">{value}</p><p className="text-[11px] text-muted-foreground">{label}</p></div>
}
