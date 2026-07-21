"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdmin } from "@/contexts/admin-context"
import type { AppNotification } from "@/lib/types"

// ─── Icons ────────────────────────────────────────────────────────────────────
function BellIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
function InfoIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  )
}
function AlertIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
function RefreshIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  )
}
function TrashIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}
function XIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function CheckIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type NType = "info" | "update" | "alert"

function typeIcon(type: NType, size = 16) {
  if (type === "alert") return <AlertIcon size={size} className="text-amber-500" />
  if (type === "update") return <RefreshIcon size={size} className="text-primary" />
  return <InfoIcon size={size} className="text-sky-500" />
}

function typeBadgeClass(type: NType) {
  if (type === "alert") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (type === "update") return "bg-primary/10 text-primary"
  return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
}

function typeIconBg(type: NType) {
  if (type === "alert") return "bg-amber-100 dark:bg-amber-900/30"
  if (type === "update") return "bg-primary/10"
  return "bg-sky-100 dark:bg-sky-900/30"
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

// ─── Notification Row ─────────────────────────────────────────────────────────
function NotificationRow({
  n,
  onMarkRead,
  onDelete,
}: {
  n: AppNotification
  onMarkRead: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [marking, setMarking] = useState(false)

  async function handleMarkRead() {
    if (n.isRead || marking) return
    setMarking(true)
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      })
      onMarkRead(n.id)
    } finally {
      setMarking(false)
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    try {
      await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      })
      onDelete(n.id)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div
      onClick={handleMarkRead}
      className={`group relative flex items-start gap-4 rounded-2xl px-4 py-4 transition-all duration-200 ${
        n.isRead
          ? "bg-transparent hover:bg-muted/40 cursor-default"
          : "bg-blue-50/70 dark:bg-blue-950/30 ring-1 ring-blue-200/60 dark:ring-blue-800/40 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/50"
      } ${deleting ? "opacity-0 scale-95 pointer-events-none" : ""}`}
      style={{ transition: deleting ? "opacity 200ms, transform 200ms" : undefined }}
    >
      {/* Unread dot */}
      {!n.isRead && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
      )}

      {/* Type icon */}
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${typeIconBg(n.type as NType)} ${!n.isRead ? "ml-1" : ""}`}>
        {typeIcon(n.type as NType, 16)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${n.isRead ? "font-medium text-foreground/70" : "font-bold text-foreground"}`}>
          {n.title}
        </p>
        <p className={`mt-1 text-xs leading-relaxed ${n.isRead ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
          {n.body}
        </p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${typeBadgeClass(n.type as NType)}`}>
            {n.type}
          </span>
          <span className="text-[10px] text-muted-foreground">{fmtTime(n.createdAt)}</span>
          {n.isRead && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <CheckIcon size={9} />
              Read
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 self-start pt-0.5">
        {!n.isRead && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleMarkRead() }}
            disabled={marking}
            title="Mark as read"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100"
          >
            <CheckIcon size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          title="Delete"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 opacity-0 group-hover:opacity-100"
        >
          <TrashIcon size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
interface NotificationOverlayProps {
  open: boolean
  onClose: () => void
  /** Called after the overlay fetches fresh data, so the bell badge can sync. */
  onUnreadCountChange?: (count: number) => void
}

export function NotificationOverlay({ open, onClose, onUnreadCountChange }: NotificationOverlayProps) {
  const { adminToken } = useAdmin()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers: Record<string, string> = {}
      if (adminToken) headers["x-admin-token"] = adminToken
      const res = await fetch("/api/notifications", { cache: "no-store", headers })
      if (res.ok) {
        const data = await res.json()
        const list: AppNotification[] = data.notifications ?? []
        setNotifications(list)
        onUnreadCountChange?.(list.filter((n) => !n.isRead).length)
      }
    } finally {
      setLoading(false)
    }
  }, [adminToken, onUnreadCountChange])

  // Fetch fresh data and mark all unread as read each time the overlay opens
  useEffect(() => {
    if (!open) return
    setFilter("all")

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const headers: Record<string, string> = {}
        if (adminToken) headers["x-admin-token"] = adminToken
        const res = await fetch("/api/notifications", { cache: "no-store", headers })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const list: AppNotification[] = data.notifications ?? []
        if (cancelled) return
        setNotifications(list)

        // Mark all unread as read on the server
        const unread = list.filter((n) => !n.isRead)
        if (unread.length > 0) {
          await Promise.all(
            unread.map((n) =>
              fetch("/api/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: n.id }),
              })
            )
          )
          if (!cancelled) {
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
            onUnreadCountChange?.(0)
          }
        } else {
          onUnreadCountChange?.(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [open, adminToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  function handleMarkRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
  }

  function handleDelete(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const displayed =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : filter === "read"
      ? notifications.filter((n) => n.isRead)
      : notifications

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close notifications"
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Drawer panel — slides in from the right */}
      <div className="relative ml-auto flex h-full w-full max-w-sm flex-col bg-background shadow-2xl sm:max-w-md">

        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <BellIcon size={18} className="text-primary" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="text-base font-bold leading-tight">Notifications</h2>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading…" : unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="border-b border-border px-4 py-2.5">
          <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
            {(["all", "unread", "read"] as const).map((f) => {
              const count =
                f === "all"
                  ? notifications.length
                  : f === "unread"
                  ? notifications.filter((n) => !n.isRead).length
                  : notifications.filter((n) => n.isRead).length
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors capitalize ${
                    filter === f
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    filter === f ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <BellIcon size={32} className="text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {filter === "unread"
                  ? "No unread notifications."
                  : filter === "read"
                  ? "No read notifications yet."
                  : "No notifications yet."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {displayed.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
