"use client"

import { useEffect, useCallback, useRef } from "react"
import { BellIcon } from "@/components/icons"
import { NotificationOverlay } from "@/components/notification-overlay"
import { useApplicationShell } from "@/components/authenticated-application-shell"

// Mutations in the overlay update the badge optimistically, so polling is only a
// fallback for notifications created outside this browser session.
const POLL_INTERVAL = 900_000
const UNREAD_STALE_TIME = 15_000

/** Read the stored auth token from localStorage (same keys as app-context). */
function getStoredAuthHeader(): { key: string; value: string } | null {
  if (typeof window === "undefined") return null
  try {
    const guestToken = localStorage.getItem("mednexus-guest-token")
    if (guestToken) return { key: "x-guest-token", value: guestToken }
    const userToken = localStorage.getItem("mednexus-user-token")
    if (userToken) return { key: "x-session-token", value: userToken }
  } catch { /* ignore */ }
  return null
}

async function fetchUnreadCount(): Promise<number> {
  try {
    const headers: Record<string, string> = {}
    const authHeader = getStoredAuthHeader()
    if (authHeader) headers[authHeader.key] = authHeader.value

    const response = await fetch("/api/notifications/unread-summary", {
      cache: "no-store",
      headers,
    })
    if (!response.ok) return 0
    const data = await response.json()
    return Number(data.total ?? 0)
  } catch {
    return 0
  }
}

export function NotificationBell() {
  const { notificationOpen: isOpen, setNotificationOpen: setIsOpen, notificationUnreadCount: unreadCount, setNotificationUnreadCount: setUnreadCount } = useApplicationShell()

  const lastRefreshAt = useRef(0)
  const refreshInFlight = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async (force = false) => {
    if (!force && Date.now() - lastRefreshAt.current < UNREAD_STALE_TIME) return
    if (refreshInFlight.current) return refreshInFlight.current

    const request = fetchUnreadCount().then((count) => {
      lastRefreshAt.current = Date.now()
      setUnreadCount(count)
    }).finally(() => {
      refreshInFlight.current = null
    })
    refreshInFlight.current = request
    return request
  }, [setUnreadCount])

  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return
      await refresh()
    }
    void check()
    const timer = setInterval(() => { void check() }, POLL_INTERVAL)
    const onVisibility = () => { if (document.visibilityState === "visible") void check() }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [refresh])

  function handleOpen() {
    setUnreadCount(0) // optimistic — overlay marks all read server-side
    setIsOpen(true)
  }

  function handleClose() {
    setIsOpen(false)
    void refresh() // reconcile unless a visibility/interval refresh just did so
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
        onUnreadCountChange={(count) => setUnreadCount(count)}
      />
    </>
  )
}
