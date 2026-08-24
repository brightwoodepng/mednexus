"use client"

import { useState, useEffect, useCallback } from "react"

// ─── Unified item type ────────────────────────────────────────────────────────
// Both admin broadcasts and personal notifications are normalised into this
// shape before rendering.  `source` is used to route PATCH/DELETE calls to
// the correct endpoint.
interface OverlayItem {
  id: string
  title: string
  body: string
  /** Visual category — personal types fall back to info styling */
  type: "info" | "update" | "alert" | "reward" | "reminder" | "module_complete" | "discipline_mastery" | "qbank_milestone" | "streak" | "economy" | "store" | "leaderboard"
  createdAt: string
  isRead: boolean
  source: "broadcast" | "personal"
  actionUrl?: string | null
  actionLabel?: string | null
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function BellIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
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
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
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
function TrophyIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  )
}
function CheckCircleIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
function TrendingUpIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  )
}
function FireIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  )
}
function ShoppingCartIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}
function CoinsIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
      <path d="M7 6h1v4" /><path d="m16.71 13.88.7.71-2.82 2.82" />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
type ItemType = OverlayItem["type"]

function typeIcon(type: ItemType, size = 16) {
  if (type === "alert")             return <AlertIcon size={size} className="text-amber-500" />
  if (type === "update")            return <RefreshIcon size={size} className="text-primary" />
  if (type === "module_complete")   return <CheckCircleIcon size={size} className="text-emerald-600" />
  if (type === "discipline_mastery")return <TrophyIcon size={size} className="text-violet-600" />
  if (type === "qbank_milestone")   return <TrendingUpIcon size={size} className="text-sky-600" />
  if (type === "streak")            return <FireIcon size={size} className="text-orange-500" />
  if (type === "leaderboard")       return <TrophyIcon size={size} className="text-yellow-500" />
  if (type === "economy")           return <CoinsIcon size={size} className="text-green-600" />
  if (type === "store")             return <ShoppingCartIcon size={size} className="text-purple-600" />
  return <InfoIcon size={size} className="text-sky-500" />
}

function typeBadgeClass(type: ItemType) {
  if (type === "alert")             return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (type === "update")            return "bg-primary/10 text-primary"
  if (type === "module_complete")   return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  if (type === "discipline_mastery")return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
  if (type === "qbank_milestone")   return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
  if (type === "streak")            return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
  if (type === "leaderboard")       return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500"
  if (type === "economy")           return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  if (type === "store")             return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
  return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
}

function typeIconBg(type: ItemType) {
  if (type === "alert")             return "bg-amber-100 dark:bg-amber-900/30"
  if (type === "update")            return "bg-primary/10"
  if (type === "module_complete")   return "bg-emerald-100 dark:bg-emerald-900/30"
  if (type === "discipline_mastery")return "bg-violet-100 dark:bg-violet-900/30"
  if (type === "qbank_milestone")   return "bg-sky-100 dark:bg-sky-900/30"
  if (type === "streak")            return "bg-orange-100 dark:bg-orange-900/30"
  if (type === "leaderboard")       return "bg-yellow-100 dark:bg-yellow-900/30"
  if (type === "economy")           return "bg-green-100 dark:bg-green-900/30"
  if (type === "store")             return "bg-purple-100 dark:bg-purple-900/30"
  return "bg-sky-100 dark:bg-sky-900/30"
}

function typeBadgeLabel(type: ItemType) {
  if (type === "module_complete")    return "module"
  if (type === "discipline_mastery") return "mastery"
  if (type === "qbank_milestone")    return "milestone"
  if (type === "streak")             return "streak"
  if (type === "leaderboard")        return "leaderboard"
  if (type === "economy")            return "nexus points"
  if (type === "store")              return "store"
  return type
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

export type StoredCredential =
  | { kind: "guest"; token: string }
  | { kind: "registered"; token: string }

/** Read the stored auth token from localStorage (same keys as app-context). */
function getStoredCredential(): StoredCredential | null {
  if (typeof window === "undefined") return null
  try {
    const guestToken = localStorage.getItem("mednexus-guest-token")
    if (guestToken) return { kind: "guest", token: guestToken }
    const userToken = localStorage.getItem("mednexus-user-token")
    if (userToken) return { kind: "registered", token: userToken }
  } catch { /* ignore */ }
  return null
}

function credentialHeaders(credential: StoredCredential | null): Record<string, string> {
  if (!credential) return {}
  return credential.kind === "registered"
    ? { "x-session-token": credential.token }
    : { "x-guest-token": credential.token }
}

interface BroadcastFeedData {
  notifications?: Array<{ id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string; actionUrl?: string | null; actionLabel?: string | null }>
}

interface PersonalFeedData {
  notifications?: Array<{ id: string; type: string; message: string; isRead: boolean; createdAt: string }>
}

/** Load the feeds available to this credential without calling registered-only APIs for guests. */
export async function loadNotificationFeedData(
  credential: StoredCredential | null,
  fetcher: typeof fetch = fetch,
): Promise<{ broadcastData: BroadcastFeedData; personalData: PersonalFeedData }> {
  const headers = credentialHeaders(credential)
  const broadcastRequest = fetcher("/api/notifications", { cache: "no-store", headers })
  const personalRequest = credential?.kind === "registered"
    ? fetcher("/api/user-notifications", { cache: "no-store", headers })
    : null

  const [broadcastRes, personalRes] = await Promise.all([broadcastRequest, personalRequest])
  return {
    broadcastData: broadcastRes.ok ? await broadcastRes.json() : { notifications: [] },
    personalData: personalRes?.ok ? await personalRes.json() : { notifications: [] },
  }
}

// ─── Notification Row ─────────────────────────────────────────────────────────
function NotificationRow({
  item,
  onMarkRead,
  onDelete,
}: {
  item: OverlayItem
  onMarkRead: (id: string, source: OverlayItem["source"]) => void
  onDelete: (id: string, source: OverlayItem["source"]) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [marking, setMarking] = useState(false)

  async function handleMarkRead() {
    if (item.isRead || marking) return
    setMarking(true)
    const endpoint = item.source === "personal" ? "/api/user-notifications" : "/api/notifications"
    const credential = getStoredCredential()
    if (item.source === "personal" && credential?.kind !== "registered") {
      setMarking(false)
      return
    }
    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...credentialHeaders(credential),
        },
        body: JSON.stringify({ id: item.id, isRead: true }),
      })
      onMarkRead(item.id, item.source)
    } finally {
      setMarking(false)
    }
  }

  async function handleOpen() {
    await handleMarkRead()
    if (item.actionUrl?.startsWith("/") && !item.actionUrl.startsWith("//")) window.location.assign(item.actionUrl)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (deleting) return
    setDeleting(true)
    const endpoint = item.source === "personal" ? "/api/user-notifications" : "/api/notifications"
    const credential = getStoredCredential()
    if (item.source === "personal" && credential?.kind !== "registered") {
      setDeleting(false)
      return
    }
    try {
      await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...credentialHeaders(credential),
        },
        body: JSON.stringify({ id: item.id }),
      })
      onDelete(item.id, item.source)
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div
      onClick={() => void handleOpen()}
      className={`group relative flex items-start gap-4 rounded-2xl px-4 py-4 transition-all duration-200 ${
        item.isRead
          ? "bg-transparent hover:bg-muted/40 cursor-default"
          : "bg-blue-50/70 dark:bg-blue-950/30 ring-1 ring-blue-200/60 dark:ring-blue-800/40 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/50"
      } ${deleting ? "opacity-0 scale-95 pointer-events-none" : ""}`}
      style={{ transition: deleting ? "opacity 200ms, transform 200ms" : undefined }}
    >
      {/* Unread dot */}
      {!item.isRead && (
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
      )}

      {/* Type icon */}
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${typeIconBg(item.type)} ${!item.isRead ? "ml-1" : ""}`}>
        {typeIcon(item.type, 16)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${item.isRead ? "font-medium text-foreground/70" : "font-bold text-foreground"}`}>
          {item.title}
        </p>
        {item.body && item.body !== item.title && (
          <p className={`mt-1 text-xs leading-relaxed ${item.isRead ? "text-muted-foreground/70" : "text-muted-foreground"}`}>
            {item.body}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${typeBadgeClass(item.type)}`}>
            {typeBadgeLabel(item.type)}
          </span>
          <span className="text-[10px] text-muted-foreground">{fmtTime(item.createdAt)}</span>
          {item.isRead && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <CheckIcon size={9} />
              Read
            </span>
          )}
        </div>
        {item.actionUrl ? <span className="mt-2 inline-flex text-xs font-bold text-primary">{item.actionLabel || "Open"} →</span> : null}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 self-start pt-0.5">
        {!item.isRead && (
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
        {item.source === "personal" && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          title="Delete"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 opacity-0 group-hover:opacity-100"
        >
          <TrashIcon size={14} />
        </button>
        )}
      </div>
    </div>
  )
}

// ─── Normalise raw API responses into OverlayItem ─────────────────────────────

function normaliseBroadcast(r: {
  id: string; title: string; body: string; type: string; isRead: boolean; createdAt: string; actionUrl?: string | null; actionLabel?: string | null
}): OverlayItem {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    type: r.type as OverlayItem["type"],
    createdAt: r.createdAt,
    isRead: r.isRead,
    source: "broadcast",
    actionUrl: r.actionUrl,
    actionLabel: r.actionLabel,
  }
}

const PERSONAL_TYPE_LABELS: Record<string, string> = {
  module_complete:    "Module Complete",
  discipline_mastery: "Discipline Mastered",
  qbank_milestone:    "Q-Bank Milestone",
  streak:             "Streak Reward",
  leaderboard:        "Leaderboard",
  economy:            "Nexus Points",
  store:              "Store Update",
}

function normalisePersonal(r: {
  id: string; type: string; message: string; isRead: boolean; createdAt: string
}): OverlayItem {
  const title = PERSONAL_TYPE_LABELS[r.type] ?? "Notification"
  return {
    id: r.id,
    title,
    body: r.message,
    type: r.type as OverlayItem["type"],
    createdAt: r.createdAt,
    isRead: r.isRead,
    source: "personal",
  }
}

// ─── Overlay ──────────────────────────────────────────────────────────────────
interface NotificationOverlayProps {
  open: boolean
  onClose: () => void
  onUnreadCountChange?: (count: number) => void
}

export function NotificationOverlay({ open, onClose, onUnreadCountChange }: NotificationOverlayProps) {
  const [items, setItems] = useState<OverlayItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all")

  // Fetch both feeds and merge, newest first
  useEffect(() => {
    if (!open) return
    setFilter("all")

    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const credential = getStoredCredential()
        const { broadcastData, personalData } = await loadNotificationFeedData(credential)

        if (cancelled) return

        const broadcasts: OverlayItem[] = (broadcastData.notifications ?? []).map(normaliseBroadcast)
        const personal: OverlayItem[]   = (personalData.notifications ?? []).map(normalisePersonal)

        // Merge and sort newest first
        const merged = [...broadcasts, ...personal].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )

        if (cancelled) return
        setItems(merged)

        // Mark all unread as read on the server
        const unreadBroadcasts = broadcasts.filter((n) => !n.isRead)
        const unreadPersonal   = personal.filter((n) => !n.isRead)

        const markRequests: Array<{ source: OverlayItem["source"], request: Promise<Response> }> = []
        if (unreadBroadcasts.length > 0) {
          markRequests.push({
            source: "broadcast",
            request: fetch("/api/notifications", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                ...credentialHeaders(credential),
              },
              body: JSON.stringify({ markAllRead: true }),
            }),
          })
        }
        if (credential?.kind === "registered" && unreadPersonal.length > 0) {
          markRequests.push({
            source: "personal",
            request: fetch("/api/user-notifications", {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                ...credentialHeaders(credential),
              },
              body: JSON.stringify({ markAllRead: true }),
            }),
          })
        }

        const markResults = await Promise.allSettled(markRequests.map(({ request }) => request))
        const successfulSources = new Set(
          markResults.flatMap((result, index) =>
            result.status === "fulfilled" && result.value.ok ? [markRequests[index].source] : [],
          ),
        )

        if (!cancelled) {
          setItems((prev) => {
            const next = prev.map((n) => successfulSources.has(n.source) ? { ...n, isRead: true } : n)
            onUnreadCountChange?.(next.filter((n) => !n.isRead).length)
            return next
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key closes
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [open, onClose])

  function handleMarkRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id))
  }

  const unreadCount = items.filter((n) => !n.isRead).length

  const displayed =
    filter === "unread" ? items.filter((n) => !n.isRead)
    : filter === "read"  ? items.filter((n) =>  n.isRead)
    : items

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

      {/* Drawer panel */}
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
                f === "all"    ? items.length
                : f === "unread" ? items.filter((n) => !n.isRead).length
                : items.filter((n) => n.isRead).length
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors capitalize ${
                    filter === f ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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
                {filter === "unread" ? "No unread notifications."
                  : filter === "read" ? "No read notifications yet."
                  : "No notifications yet."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {displayed.map((item) => (
                <NotificationRow
                  key={item.id}
                  item={item}
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
