"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useApp } from "@/contexts/app-context"
import { useCurrentStudyMode } from "@/contexts/current-study-mode-context"
import { AppearanceModal } from "@/components/appearance-modal"

type Summary = { totals: Record<string, number>; collections: Array<Record<string, string | number>>; disciplines: Array<Record<string, string | number>>; sets: Array<Record<string, string | number>>; recent: Array<Record<string, string>> }
const headers = (): Record<string, string> => {
  const token = localStorage.getItem("mednexus-user-token")
  const guest = localStorage.getItem("mednexus-guest-token")
  return token ? { "x-session-token": token } : guest ? { "x-guest-token": guest } : {}
}
const pct = (done: number, total: number) => total ? Math.round(done / total * 100) : 0

export function TheoryProfile() {
  const { user, signOutUser } = useApp(); const { setCurrentStudyMode } = useCurrentStudyMode()
  const [summary, setSummary] = useState<Summary | null>(null); const [appearance, setAppearance] = useState(false); const [notification, setNotification] = useState<NotificationPermission | "unsupported">("unsupported")
  useEffect(() => { fetch("/api/theory/profile-summary", { headers: headers() }).then(r => r.ok ? r.json() : null).then(setSummary).catch(() => undefined) }, [])
  useEffect(() => { if (typeof Notification !== "undefined") setNotification(Notification.permission) }, [])
  const t = summary?.totals
  const metric = (label: string, value: number | undefined, href: string) => <Link href={href} className="rounded-xl border border-border bg-card p-4 transition hover:border-teal-500/50"><p className="text-2xl font-bold">{value ?? 0}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></Link>
  return <div className="mx-auto max-w-5xl space-y-6">
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">{(user?.name ?? "C")[0]}</div><div><p className="text-xs font-bold uppercase tracking-widest text-teal-600">Platform profile</p><h1 className="mt-1 text-2xl font-bold">{user?.name ?? "Clinician"}</h1><p className="mt-1 text-sm text-muted-foreground">{user?.role === "user" ? "Registered learner" : "Guest learner"}{user?.classLevel ? ` · ${user.classLevel}` : ""}{user?.createdAt ? ` · Joined ${new Date(user.createdAt).toLocaleDateString(undefined, { month: "short", year: "numeric" })}` : ""}</p></div></div><div className="flex gap-2"><button onClick={() => typeof Notification !== "undefined" && Notification.requestPermission().then(setNotification)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">Notifications: {notification === "granted" ? "on" : "enable"}</button><button onClick={() => setAppearance(true)} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">Appearance</button><button onClick={signOutUser} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">Sign out</button></div></div>
      <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => { setCurrentStudyMode("MCQ"); location.assign("/") }} className="rounded-lg border border-border px-3 py-2 text-sm">MCQ Q-Bank</button><span className="rounded-lg border border-teal-500/50 bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-700 dark:text-teal-300">Theory Vault · Active</span></div></section>
    <section><h2 className="mb-3 text-lg font-semibold">Theory Vault progress</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{metric("Read questions", t?.read, "/theory/browse")}{metric("Completed questions", t?.completed, "/theory/progress")}{metric("Model-answer reviews", t?.model_answer_reviews, "/theory/read")}{metric("Bookmarks", t?.bookmarks, "/theory/bookmarks")}{metric("Notes", t?.notes, "/theory/notes")}{metric("Revisions due", t?.revisions_due, "/theory/revision-queue")}{metric("Completed revisions", t?.revisions_completed, "/theory/revision-queue")}{metric("Questions available", t?.total, "/theory/browse")}</div></section>
    <section className="grid gap-4 lg:grid-cols-2"><ProgressList title="End of Rotation & End of Year" rows={summary?.collections ?? []}/><ProgressList title="Disciplines & sets" rows={[...(summary?.disciplines ?? []), ...(summary?.sets ?? [])]}/></section>
    <section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Recent Theory activity</h2><div className="mt-3 space-y-2">{summary?.recent?.length ? summary.recent.map(a => <Link key={`${a.question_id}-${a.occurred_at}`} href={`/theory/study/${a.set_id ?? ""}`} className="block rounded-lg bg-muted/50 p-3 text-sm hover:bg-muted"><span className="font-medium capitalize">{a.activity_type.replaceAll("_", " ")}</span><span className="mx-2 text-muted-foreground">·</span>{a.prompt}</Link>) : <p className="text-sm text-muted-foreground">Your recent reading, completions, and revisions will appear here.</p>}</div></section><AppearanceModal open={appearance} onClose={() => setAppearance(false)} />
  </div>
}
function ProgressList({ title, rows }: { title: string; rows: Array<Record<string, string | number>> }) { return <section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">{title}</h2><div className="mt-3 space-y-3">{rows.length ? rows.map(row => { const total=Number(row.total), completed=Number(row.completed); return <Link href="/theory/progress" key={`${row.collection_id}-${row.discipline_id ?? row.id}`} className="block"><div className="flex justify-between text-sm"><span>{row.title}</span><span className="text-muted-foreground">{completed}/{total}</span></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-teal-500" style={{width:`${pct(completed,total)}%`}} /></div></Link> }) : <p className="text-sm text-muted-foreground">Loading progress…</p>}</div></section> }
