"use client"

import { Download, Trash2, Wifi } from "lucide-react"
import { useQuestions } from "@/contexts/questions-context"

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function OfflineDownloads() {
  const { offlinePacks, removeDownloadedModule } = useQuestions()
  const totalBytes = offlinePacks.reduce((sum, pack) => sum + pack.bytes, 0)
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm" aria-labelledby="offline-downloads-title">
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Download size={18}/></span>
      <div><h2 id="offline-downloads-title" className="font-semibold">Offline downloads</h2><p className="mt-1 text-sm text-muted-foreground">Downloaded modules remain available when your connection drops.</p></div>
    </div>
    <div className="mt-4 flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground"><span>{offlinePacks.length} module{offlinePacks.length === 1 ? "" : "s"}</span><span>{sizeLabel(totalBytes)} used</span></div>
    {offlinePacks.length ? <ul className="mt-3 divide-y divide-border">{offlinePacks.map(pack => <li key={pack.id} className="flex items-center gap-3 py-3"><Wifi size={15} className="shrink-0 text-emerald-500"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{pack.title}</p><p className="text-xs text-muted-foreground">{pack.questions.length} questions · {sizeLabel(pack.bytes)}</p></div><button type="button" onClick={() => void removeDownloadedModule(pack.title)} aria-label={`Remove ${pack.title} offline download`} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={15}/></button></li>)}</ul> : <p className="mt-4 text-sm text-muted-foreground">No modules downloaded. Use “Download for offline” in the Module Library.</p>}
  </section>
}
