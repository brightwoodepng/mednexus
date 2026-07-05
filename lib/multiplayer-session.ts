// ── Multiplayer session recovery ─────────────────────────────────────────────
// Caches enough state in sessionStorage to survive a page refresh (or a route
// bounce back to the dashboard) and silently rejoin an in-progress match
// without sending the player back through the lobby/room-select screens.
//
// Not a replacement for the server's authoritative room state — this is only
// a pointer telling the client "you were in room X, as player Y, last on
// question Z" so it can resume polling immediately.

const KEY = "mednexus-active-room"

export interface ActiveRoomSession {
  pin: string
  myId: string
  mode: "clash" | "cohort" | "wager"
  isHost: boolean
  isCohortHost: boolean
  /** id of the question that was on screen when we last persisted, for diagnostics/recovery UX */
  questionId?: string | null
}

export function saveActiveRoomSession(session: ActiveRoomSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // sessionStorage unavailable (SSR / privacy mode) — recovery simply won't work
  }
}

export function loadActiveRoomSession(): ActiveRoomSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.pin !== "string" || typeof parsed.myId !== "string") return null
    return parsed as ActiveRoomSession
  } catch {
    return null
  }
}

export function clearActiveRoomSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
