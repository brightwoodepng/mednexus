"use client"

import { useEffect, useCallback } from "react"
import { BellIcon } from "@/components/icons"
import { NotificationOverlay } from "@/components/notification-overlay"
import { useApplicationShell } from "@/components/authenticated-application-shell"

const POLL_INTERVAL = 300_000

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
    const broadcastHeaders: Record<string, string> = {}
    const authHeader = getStoredAuthHeader()
    if (authHeader) broadcastHeaders[authHeader.key] = authHeader.value


    const personalHeaders: Record<string, string> = {}
    if (authHeader) personalHeaders[authHeader.key] = authHeader.value

    const [broadcastRes, personalRes] = await Promise.all([
      fetch("/api/notifications?view=count", { cache: "no-store", headers: broadcastHeaders }),
      fetch("/api/user-notifications?view=count", { cache: "no-store", headers: personalHeaders }),
    ])

    const broadcastData = broadcastRes.ok ? await broadcastRes.json() : { unread: 0 }
    const personalData  = personalRes.ok  ? await personalRes.json()  : { unread: 0 }
    return Number(broadcastData.unread ?? 0) + Number(personalData.unread ?? 0)
  } catch {
    return 0
  }
}

export function NotificationBell() {
  const { notificationOpen: isOpen, setNotificationOpen: setIsOpen, notificationUnreadCount: unreadCount, setNotificationUnreadCount: setUnreadCount } = useApplicationShell()

  const refresh = useCallback(async () => {
    const count = await fetchUnreadCount()
    setUnreadCount(count)
  }, [setUnreadCount])

  useEffect(() => {
    let running = false
    const check = async () => {
      if (running || document.visibilityState !== "visible") return
      running = true
      try { await refresh() } finally { running = false }
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
    refresh() // reconcile badge with actual server state
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
