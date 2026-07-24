"use client"

import { useEffect, useRef, useState } from "react"

type Status = { source: string; questions: unknown[]; updatedAt: string | null; confirmation: string; postgres: { available: boolean; rowPresent: boolean; count: number; updatedAt: string | null }; firestore: { configured: boolean; available: boolean; count: number; updatedAt: string | null }; static: { count: number } }
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

  if (!status) return <p className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-400">Loading question-bank diagnostics…</p>
  const cards = [
    ["PostgreSQL", status.postgres.available ? "Available" : "Unavailable", `Row: ${status.postgres.rowPresent ? "present" : "empty"} · ${status.postgres.count} questions · ${formatDate(status.postgres.updatedAt)}`],
    ["Firestore fallback", status.firestore.configured ? (status.firestore.available ? "Available" : "Unavailable") : "Not configured", `${status.firestore.count} questions · ${formatDate(status.firestore.updatedAt)}`],
    ["Bundled demo fallback", "Available", `${status.static.count} questions in lib/questions-database.ts`],
  ]
  return <section className="max-w-5xl space-y-6">
    <div><p className="text-sm font-semibold tracking-wide text-cyan-300">SYSTEM · SUPER ADMIN</p><h1 className="mt-2 text-3xl font-bold">Question Bank Source</h1><p className="mt-3 max-w-3xl text-slate-400">Inspect and safely control the live MCQ source. A present, empty PostgreSQL row intentionally gives learners an empty bank; it never falls back to the bundled demo.</p></div>
    <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-5"><p className="text-sm font-semibold text-cyan-200">Currently returned by /api/questions</p><p className="mt-1 text-2xl font-bold capitalize">{status.source}</p><p className="text-sm text-slate-300">{status.questions.length} questions · last updated {formatDate(status.updatedAt)}</p></div>
    <div className="grid gap-4 md:grid-cols-3">{cards.map(([name, state, detail]) => <div key={name} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="font-semibold">{name}</p><p className={`mt-2 text-sm font-bold ${state === "Available" ? "text-emerald-300" : "text-amber-300"}`}>{state}</p><p className="mt-2 text-xs leading-5 text-slate-400">{detail}</p></div>)}</div>
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-semibold">Safe bank actions</h2><p className="mt-1 text-sm text-slate-400">Every destructive operation saves an audit-log backup before it changes data and invalidates question caches afterward.</p><div className="mt-5 flex flex-wrap gap-3"><button onClick={exportBank} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950">Export current bank</button><button onClick={() => ask("replace")} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold">Replace current bank from reviewed import</button><button onClick={() => ask("restore-demo")} className="rounded-lg border border-amber-500/60 px-4 py-2 text-sm font-semibold text-amber-200">Restore bundled demo bank</button><button onClick={() => ask("clear-postgres")} className="rounded-lg border border-rose-500/60 px-4 py-2 text-sm font-semibold text-rose-200">Clear database question bank</button>{status.firestore.configured && <button onClick={() => ask("clear-firestore")} className="rounded-lg border border-rose-500/60 px-4 py-2 text-sm font-semibold text-rose-200">Clear Firestore fallback bank</button>}<button onClick={() => { void fetch("/api/admin/question-bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) }); window.dispatchEvent(new Event("mednexus:questions-invalidated")); setMessage("Question cache refresh requested.") }} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold">Refresh question cache</button></div><input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { const parsed: unknown = JSON.parse(await file.text()); if (!Array.isArray(parsed)) throw new Error(); setReviewedImport(parsed); setPending("replace") } catch { setMessage("Choose a reviewed JSON array of questions.") } }} />{message && <p className="mt-4 text-sm text-cyan-200">{message}</p>}</div>
    {pending && <div className="rounded-xl border border-rose-500/50 bg-rose-950/30 p-6"><h2 className="font-semibold text-rose-100">Confirm destructive action</h2><p className="mt-2 text-sm text-slate-300">Current source: <b>{status.source}</b> · {status.questions.length} questions · {formatDate(status.updatedAt)}. An automatic backup and audit entry will be created first.</p><label className="mt-4 block text-sm text-slate-300">Type <b>{status.confirmation}</b><input value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-white" /></label><div className="mt-4 flex gap-3"><button onClick={run} disabled={confirmation !== status.confirmation} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Confirm action</button><button onClick={() => { setPending(null); setConfirmation("") }} className="rounded-lg border border-slate-600 px-4 py-2 text-sm">Cancel</button></div></div>}
  </section>
}
