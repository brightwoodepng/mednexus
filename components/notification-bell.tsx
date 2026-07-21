"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdmin } from "@/contexts/admin-context"
import { BellIcon } from "@/components/icons"
import { NotificationOverlay } from "@/components/notification-overlay"
import type { AppNotification } from "@/lib/types"

const POLL_INTERVAL = 60_000

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

export function NotificationBell() {
  const { adminToken } = useAdmin()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const load = useCallback(async () => {
    const data = await fetchNotifications(adminToken)
    setNotifications(data)
  }, [adminToken])

  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_INTERVAL)
    return () => clearInterval(timer)
  }, [load])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  function handleOpen() {
    // Optimistically zero out badge — overlay will mark all read on the server
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    setIsOpen(true)
  }

  function handleClose() {
    setIsOpen(false)
    // Re-fetch so the badge reflects the actual server state after the overlay ran its PATCH calls
    load()
  }

  return (
    <>
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

      <NotificationOverlay
        open={isOpen}
        onClose={handleClose}
        onUnreadCountChange={(count) =>
          setNotifications((prev) =>
            count === 0 ? prev.map((n) => ({ ...n, isRead: true })) : prev
          )
        }
      />
    </>
  )
}
