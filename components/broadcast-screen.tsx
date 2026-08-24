"use client"

import { useCallback, useEffect, useState } from "react"
import { MegaphoneIcon, SendIcon, TrashIcon } from "@/components/icons"
import type { AppNotification } from "@/lib/types"

const typeConfig = {
  info: { label: "Info", active: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  update: { label: "Update", active: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  alert: { label: "Alert", active: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
} as const

export function BroadcastScreen() {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [type, setType] = useState<keyof typeof typeConfig>("info")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loadingList, setLoadingList] = useState(true)

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications")
      if (response.ok) { const data = await response.json(); setNotifications(data.notifications ?? []) }
    } finally { setLoadingList(false) }
  }, [])

  useEffect(() => { void fetchNotifications() }, [fetchNotifications])

  async function handleSend(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || !body.trim()) return
    setStatus("sending")
    try {
      const response = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), body: body.trim(), type }) })
      if (!response.ok) throw new Error()
      setStatus("sent"); setTitle(""); setBody(""); setType("info")
      await fetchNotifications()
      window.setTimeout(() => setStatus("idle"), 2500)
    } catch { setStatus("error"); window.setTimeout(() => setStatus("idle"), 3000) }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this notification permanently?")) return
    const response = await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, confirm: true }) })
    if (response.ok) setNotifications((current) => current.filter((notification) => notification.id !== id))
  }

  return <section className="max-w-7xl space-y-5">
    <header className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400"><MegaphoneIcon size={21}/></span><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Notifications</h1></header>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5"><h2 className="text-base font-bold">New notification</h2><form onSubmit={handleSend} className="mt-5 space-y-4">
        <fieldset><legend className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Type</legend><div className="grid grid-cols-3 gap-2">{(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map((option) => { const config = typeConfig[option]; const active = type === option; return <button key={option} type="button" aria-pressed={active} onClick={() => setType(option)} className={`flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${active ? config.active : "border-border hover:bg-muted"}`}><span className={`size-2 rounded-full ${active ? config.dot : "bg-muted-foreground/40"}`}/>{config.label}</button> })}</div></fieldset>
        <label className="block text-sm font-semibold">Title<input className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Notification title" required/></label>
        <label className="block text-sm font-semibold">Message<textarea className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your message" required/></label>
        {status === "error" ? <p role="alert" className="text-sm text-destructive">The notification could not be sent. Try again.</p> : null}
        {status === "sent" ? <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">Notification sent.</p> : null}
        <button type="submit" disabled={status === "sending" || !title.trim() || !body.trim()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"><SendIcon size={15}/>{status === "sending" ? "Sending…" : "Send to all users"}</button>
      </form></section>
      <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5"><h2 className="font-bold">Recent notifications</h2><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{notifications.length}</span></div>
        {loadingList ? <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">Loading…</div> : notifications.length === 0 ? <div className="grid min-h-56 place-items-center px-5 text-center"><div><MegaphoneIcon size={28} className="mx-auto text-muted-foreground/40"/><p className="mt-3 text-sm text-muted-foreground">No notifications yet.</p></div></div> : <div className="divide-y divide-border">{notifications.map((notification) => { const config = typeConfig[notification.type as keyof typeof typeConfig] ?? typeConfig.info; return <article key={notification.id} className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-muted/25 sm:px-5"><span className={`mt-1.5 size-2.5 shrink-0 rounded-full ${config.dot}`}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{notification.title}</h3><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${config.active}`}>{config.label}</span></div><p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.body}</p><time className="mt-2 block text-[11px] text-muted-foreground" dateTime={notification.createdAt}>{formatDate(notification.createdAt)}</time></div><button type="button" onClick={() => void handleDelete(notification.id)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${notification.title}`}><TrashIcon size={15}/></button></article> })}</div>}
      </section>
    </div>
  </section>
}

function formatDate(iso: string) { return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) }
