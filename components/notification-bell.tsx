"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { BellIcon, XIcon, InfoIcon, AlertTriangleIcon, RefreshCwIcon } from "@/components/icons"
import type { AppNotification } from "@/lib/types"

const POLL_INTERVAL = 60_000
const ALL_TYPES = ["info", "update", "alert"] as const
type NType = typeof ALL_TYPES[number]

async function fetchNotifications(adminToken?: string | null): Promise<AppNotification[]> {
  try {
    const headers: Record<string, string> = {}
    if (adminToken) headers["x-admin-token"] = adminToken
    const res = await fetch("/api/notifications", { cache: "no-store", headers })
    if (!res.ok) return []
    const data = await res.json()
    return data.notifications ?? []
  } catch {
    return []
  }
}

function typeIcon(type: NType, size = 16) {
  if (type === "alert") return <AlertTriangleIcon size={size} className="text-amber-500" />
  if (type === "update") return <RefreshCwIcon size={size} className="text-primary" />
  return <InfoIcon size={size} className="text-sky-500" />
}

function typeBadge(type: NType) {
  if (type === "alert") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (type === "update") return "bg-primary/10 text-primary"
  return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
}

function typePill(type: NType) {
  if (type === "alert") return "bg-amber-500"
  if (type === "update") return "bg-primary"
  return "bg-sky-500"
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function NotificationItem({ n, isUnread }: { n: AppNotification; isUnread: boolean }) {
  return (
    <div
      className={`group relative flex items-start gap-4 rounded-2xl px-5 py-4 transition-colors ${
        isUnread
          ? "bg-primary/5 ring-1 ring-primary/10"
          : "bg-muted/30 hover:bg-muted/50"
      }`}
    >
      {/* Unread dot */}
      {isUnread && (
        <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-primary" />
      )}

      {/* Icon */}
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        n.type === "alert"
          ? "bg-amber-100 dark:bg-amber-900/30"
          : n.type === "update"
          ? "bg-primary/10"
          : "bg-sky-100 dark:bg-sky-900/30"
      }`}>
        {typeIcon(n.type as NType, 17)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pr-4">
        <p className={`text-sm font-semibold leading-snug ${isUnread ? "text-foreground" : "text-foreground/80"}`}>
          {n.title}
        </p>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{n.body}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${typeBadge(n.type as NType)}`}>
            {n.type}
          </span>
          <span className="text-[11px] text-muted-foreground">{fmtTime(n.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 px-1 pb-2 pt-1">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{count}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  )
}

export function NotificationBell() {
  const { progress, markNotificationsRead, toggleMuteNotificationType } = useApp()
  const { adminToken } = useAdmin()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const muted: string[] = progress.mutedNotificationTypes ?? []
  const lastRead = progress.notificationsLastRead ?? 0

  const load = useCallback(async () => {
    const data = await fetchNotifications(adminToken)
    setNotifications(data)
  }, [adminToken])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setShowPrefs(false) }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [open])

  const visible = notifications.filter((n) => !muted.includes(n.type))
  const unreadItems = visible.filter((n) => new Date(n.createdAt).getTime() > lastRead)
  const readItems = visible.filter((n) => new Date(n.createdAt).getTime() <= lastRead)
  const unreadCount = unreadItems.length

  function handleOpen() {
    setOpen(true)
    setShowPrefs(false)
    if (unreadCount > 0) markNotificationsRead()
  }

  const modal = open && mounted ? createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { setOpen(false); setShowPrefs(false) }}
      />

      {/* Panel */}
      <div className="relative flex w-full max-w-lg flex-col rounded-3xl border border-border bg-card shadow-2xl"
        style={{ maxHeight: "min(90vh, 700px)" }}>

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <BellIcon size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">Notifications</h2>
              {unreadCount > 0 ? (
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              ) : (
                <p className="text-xs text-muted-foreground">All caught up</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowPrefs((v) => !v)}
              title="Notification preferences"
              className={`rounded-xl px-3 py-2 text-lg transition-colors ${
                showPrefs ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              ⚙
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setShowPrefs(false) }}
              className="rounded-xl p-2 text-muted-foreground hover:bg-muted transition-colors"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* ── Preferences panel ── */}
        {showPrefs && (
          <div className="shrink-0 border-b border-border bg-muted/40 px-6 py-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Visible types
            </p>
            <div className="flex flex-col gap-3">
              {ALL_TYPES.map((t) => {
                const isMuted = muted.includes(t)
                return (
                  <label key={t} className="flex cursor-pointer items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!isMuted}
                      onClick={() => toggleMuteNotificationType(t)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${!isMuted ? "bg-primary" : "bg-muted-foreground/30"}`}
                    >
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${!isMuted ? "translate-x-4" : "translate-x-0.5"}`}
                      />
                    </button>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${typePill(t)}`} />
                      <span className="text-sm font-medium capitalize">{t}</span>
                      {isMuted && <span className="text-[11px] text-muted-foreground">(muted)</span>}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Content ── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <BellIcon size={32} className="text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {notifications.length > 0 && muted.length > 0
                  ? "All notification types are muted."
                  : "No notifications yet."}
              </p>
              {notifications.length > 0 && muted.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPrefs(true)}
                  className="text-xs text-primary underline underline-offset-2"
                >
                  Manage preferences
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Unread section */}
              {unreadItems.length > 0 && (
                <div>
                  <SectionHeader label="Unread" count={unreadItems.length} />
                  <div className="flex flex-col gap-2">
                    {unreadItems.map((n) => (
                      <NotificationItem key={n.id} n={n} isUnread />
                    ))}
                  </div>
                </div>
              )}

              {/* Read section */}
              {readItems.length > 0 && (
                <div>
                  <SectionHeader
                    label={unreadItems.length > 0 ? "Earlier" : "Read"}
                    count={readItems.length}
                  />
                  <div className="flex flex-col gap-2">
                    {readItems.map((n) => (
                      <NotificationItem key={n.id} n={n} isUnread={false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white ring-2 ring-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {modal}
    </div>
  )
}
