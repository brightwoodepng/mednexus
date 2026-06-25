"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useApp } from "@/contexts/app-context"
import { BellIcon, XIcon, InfoIcon, AlertTriangleIcon, RefreshCwIcon } from "@/components/icons"
import type { AppNotification } from "@/lib/types"

const POLL_INTERVAL = 60_000

async function fetchNotifications(): Promise<AppNotification[]> {
  try {
    const res = await fetch("/api/notifications", { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json()
    return data.notifications ?? []
  } catch {
    return []
  }
}

function typeIcon(type: AppNotification["type"]) {
  if (type === "alert") return <AlertTriangleIcon size={14} className="text-amber-500" />
  if (type === "update") return <RefreshCwIcon size={14} className="text-primary" />
  return <InfoIcon size={14} className="text-sky-500" />
}

function typeBadge(type: AppNotification["type"]) {
  if (type === "alert") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (type === "update") return "bg-primary/10 text-primary"
  return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function NotificationBell() {
  const { progress, markNotificationsRead } = useApp()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async () => {
    const data = await fetchNotifications()
    setNotifications(data)
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const lastRead = progress.notificationsLastRead ?? 0
  const unread = notifications.filter((n) => new Date(n.createdAt).getTime() > lastRead).length

  function handleOpen() {
    if (!open) {
      setOpen(true)
      if (unread > 0) markNotificationsRead()
    } else {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <BellIcon size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-11 z-50 w-80 rounded-2xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <BellIcon size={15} className="text-primary" />
              <span className="text-sm font-semibold">Notifications</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted transition-colors"
            >
              <XIcon size={15} />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <BellIcon size={28} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No notifications yet.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = new Date(n.createdAt).getTime() > lastRead
                return (
                  <div
                    key={n.id}
                    className={`border-b border-border/50 px-4 py-3 last:border-b-0 ${isUnread ? "bg-primary/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold">{n.title}</p>
                          {isUnread && (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                          {n.body}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize ${typeBadge(n.type)}`}>
                            {n.type}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{fmtTime(n.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
