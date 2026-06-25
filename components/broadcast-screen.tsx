"use client"

import { useState, useEffect } from "react"
import { useAdmin } from "@/contexts/admin-context"
import { MegaphoneIcon, SendIcon, TrashIcon, XIcon } from "@/components/icons"
import type { AppNotification } from "@/lib/types"

export function BroadcastScreen() {
  const { adminToken } = useAdmin()

  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [type, setType] = useState<"info" | "update" | "alert">("info")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loadingList, setLoadingList] = useState(true)

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications ?? [])
      }
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => { fetchNotifications() }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !adminToken) return
    setStatus("sending")
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), type }),
      })
      if (!res.ok) throw new Error()
      setStatus("sent")
      setTitle("")
      setBody("")
      setType("info")
      await fetchNotifications()
      setTimeout(() => setStatus("idle"), 2500)
    } catch {
      setStatus("error")
      setTimeout(() => setStatus("idle"), 3000)
    }
  }

  async function handleDelete(id: string) {
    if (!adminToken) return
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
      body: JSON.stringify({ id }),
    })
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const TYPE_CONFIG = {
    info:   { label: "Info",   ring: "ring-sky-400/40",     bg: "bg-sky-500/10",   text: "text-sky-700 dark:text-sky-400",   dot: "bg-sky-500"   },
    update: { label: "Update", ring: "ring-violet-400/40",  bg: "bg-violet-500/10",text: "text-violet-700 dark:text-violet-400", dot: "bg-violet-500"},
    alert:  { label: "Alert",  ring: "ring-rose-400/40",    bg: "bg-rose-500/10",  text: "text-rose-700 dark:text-rose-400", dot: "bg-rose-500"  },
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-sm">
          <MegaphoneIcon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Broadcast</h1>
          <p className="text-sm text-muted-foreground">Send notifications to all users in real-time</p>
        </div>
      </div>

      {/* Compose form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold">Compose Notification</h2>
        <form onSubmit={handleSend} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Type
            </label>
            <div className="flex gap-2">
              {(["info", "update", "alert"] as const).map((t) => {
                const cfg = TYPE_CONFIG[t]
                const active = type === t
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                      active
                        ? `${cfg.bg} ${cfg.text} ring-2 ${cfg.ring} border-transparent`
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${active ? cfg.dot : "bg-muted-foreground/40"}`} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Title *
            </label>
            <input
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New questions added to Level 400"
              required
            />
          </div>

          {/* Body */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Message *
            </label>
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message to all users…"
              required
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={status === "sending" || status === "sent"}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SendIcon size={15} />
            {status === "sending" ? "Sending…"
              : status === "sent" ? "✓ Sent to all users"
                : status === "error" ? "Failed — try again"
                  : "Send to All Users"}
          </button>
        </form>
      </div>

      {/* Sent notifications list */}
      <div>
        <h2 className="mb-3 text-base font-bold">Sent Notifications</h2>
        {loadingList ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
            <MegaphoneIcon size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No notifications sent yet</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            {notifications.map((n, i) => {
              const cfg = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.info
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-4 px-5 py-4 ${i !== 0 ? "border-t border-border/60" : ""} hover:bg-muted/30 transition-colors`}
                >
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${cfg.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cfg.bg} ${cfg.text}`}>
                        {n.type}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">{fmtDate(n.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(n.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    aria-label="Delete notification"
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
