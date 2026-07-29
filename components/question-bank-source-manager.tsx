"use client"

import { useEffect, useRef, useState } from "react"

type Status = { source: string; count: number; updatedAt: string | null; confirmation: string; postgres: { available: boolean; rowPresent: boolean; count: number; updatedAt: string | null }; firestore: { configured: boolean; available: boolean; count: number; updatedAt: string | null }; static: { count: number } }
type Action = "replace" | "clear-postgres" | "restore-demo" | "clear-firestore"

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"

export function QuestionBankSourceManager() {
  const [status, setStatus] = useState<Status | null>(null)
  const [confirmation, setConfirmation] = useState("")
  const [pending, setPending] = useState<Action | null>(null)
  const [reviewedImport, setReviewedImport] = useState<unknown[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const load = async () => { const response = await fetch("/api/admin/question-bank", { cache: "no-store" }); if (response.ok) setStatus(await response.json()) }
  useEffect(() => { void load() }, [])

  const exportBank = async () => {
    const response = await fetch("/api/admin/question-bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "export" }) })
    if (!response.ok) return setMessage("Export failed.")
    const data = await response.json()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data.questions, null, 2)], { type: "application/json" }))
    const link = document.createElement("a"); link.href = url; link.download = `mednexus-question-bank-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url)
    setMessage(`Exported ${data.count} questions.`)
  }
  const run = async () => {
    if (!pending || !status) return
    const response = await fetch("/api/admin/question-bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: pending, confirmation, questions: pending === "replace" ? reviewedImport : undefined }) })
    const data = await response.json()
    if (!response.ok) return setMessage(data.error ?? "Action failed.")
    window.dispatchEvent(new Event("mednexus:questions-invalidated"))
    setMessage(`Completed. ${data.count ?? ""} question${data.count === 1 ? "" : "s"} now active.`); setPending(null); setConfirmation(""); await load()
  }
  const ask = (action: Action) => { if (action === "replace" && !reviewedImport) return fileRef.current?.click(); setPending(action); setMessage(null) }

  if (!status) return <p className="rounded-xl border border-border bg-card p-6 text-muted-foreground">Loading question-bank diagnostics…</p>
  const cards = [
    ["PostgreSQL", status.postgres.available ? "Available" : "Unavailable", `Row: ${status.postgres.rowPresent ? "present" : "empty"} · ${status.postgres.count} questions · ${formatDate(status.postgres.updatedAt)}`],
    ["Firestore fallback", status.firestore.configured ? (status.firestore.available ? "Available" : "Unavailable") : "Not configured", `${status.firestore.count} questions · ${formatDate(status.firestore.updatedAt)}`],
    ["Bundled demo fallback", "Available", `${status.static.count} questions in lib/questions-database.ts`],
  ]
  return <section className="max-w-5xl space-y-6">
    <div><p className="text-sm font-semibold tracking-wide text-primary">SYSTEM · SUPER ADMIN</p><h1 className="mt-2 text-3xl font-bold">Question Bank Source</h1><p className="mt-3 max-w-3xl text-muted-foreground">Inspect and safely control the live MCQ source. A present, empty PostgreSQL row intentionally gives learners an empty bank; it never falls back to the bundled demo.</p></div>
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5"><p className="text-sm font-semibold text-primary">Currently returned by /api/questions</p><p className="mt-1 text-2xl font-bold capitalize">{status.source}</p><p className="text-sm text-muted-foreground">{status.count} questions · last updated {formatDate(status.updatedAt)}</p></div>
    <div className="grid gap-4 md:grid-cols-3">{cards.map(([name, state, detail]) => <div key={name} className="rounded-xl border border-border bg-card p-5"><p className="font-semibold">{name}</p><p className={`mt-2 text-sm font-bold ${state === "Available" ? "text-primary" : "text-warning"}`}>{state}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p></div>)}</div>
    <div className="rounded-xl border border-border bg-card p-6"><h2 className="font-semibold">Safe bank actions</h2><p className="mt-1 text-sm text-muted-foreground">Every destructive operation saves an audit-log backup before it changes data and invalidates question caches afterward.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={exportBank} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Export current bank</button><button onClick={() => ask("replace")} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Replace current bank from reviewed import</button><button onClick={() => ask("restore-demo")} className="rounded-xl border border-warning/60 px-4 py-2 text-sm font-semibold text-warning transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Restore bundled demo bank</button><button onClick={() => ask("clear-postgres")} className="rounded-xl border border-destructive/60 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Clear database question bank</button>{status.firestore.configured && <button onClick={() => ask("clear-firestore")} className="rounded-xl border border-destructive/60 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Clear Firestore fallback bank</button>}<button onClick={() => { void fetch("/api/admin/question-bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) }); window.dispatchEvent(new Event("mednexus:questions-invalidated")); setMessage("Question cache refresh requested.") }} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Refresh question cache</button></div><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { const parsed: unknown = JSON.parse(await file.text()); if (!Array.isArray(parsed)) throw new Error(); setReviewedImport(parsed); setPending("replace") } catch { setMessage("Choose a reviewed JSON array of questions.") } }} />{message && <p className="mt-4 text-sm text-primary">{message}</p>}</div>
    {pending && <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6"><h2 className="font-semibold text-destructive">Confirm destructive action</h2><p className="mt-2 text-sm text-muted-foreground">Current source: <b>{status.source}</b> · {status.count} questions · {formatDate(status.updatedAt)}. An automatic backup and audit entry will be created first.</p><label className="mt-4 block text-sm text-muted-foreground">Type <b>{status.confirmation}</b><input value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" /></label><div className="mt-4 flex gap-3"><button onClick={run} disabled={confirmation !== status.confirmation} className="rounded-xl bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40">Confirm action</button><button onClick={() => { setPending(null); setConfirmation("") }} className="rounded-xl border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Cancel</button></div></div>}
  </section>
}
