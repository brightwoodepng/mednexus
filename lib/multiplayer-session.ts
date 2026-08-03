// ── Multiplayer session recovery ─────────────────────────────────────────────
// Caches enough state in localStorage to survive refresh, tab/browser closure,
// or a route bounce and silently rejoin an in-progress match
// without sending the player back through the lobby/room-select screens.
//
// Not a replacement for the server's authoritative room state — this is only
// a pointer telling the client "you were in room X, as player Y, last on
// question Z" so it can resume polling immediately.

const KEY = "mednexus-active-room:v2"
const VERSION = 2 as const
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface ActiveRoomSession {
  version: typeof VERSION
  savedAt: number
  pin: string
  /** Authenticated account UID; reconnection metadata, never a security credential. */
  uid: string
  mode: "clash" | "cohort" | "wager" | "djmulti"
  isHost: boolean
  isCohortHost: boolean
  /** id of the question that was on screen when we last persisted, for diagnostics/recovery UX */
  questionId?: string | null
}

export function saveActiveRoomSession(session: Omit<ActiveRoomSession, "version" | "savedAt">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...session, version: VERSION, savedAt: Date.now() }))
  } catch {
    // sessionStorage unavailable (SSR / privacy mode) — recovery simply won't work
  }
}

export function loadActiveRoomSession(expectedUid?: string): ActiveRoomSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveRoomSession
    const validMode = parsed?.mode === "clash" || parsed?.mode === "cohort" || parsed?.mode === "wager" || parsed?.mode === "djmulti"
    if (!parsed || parsed.version !== VERSION || typeof parsed.pin !== "string" || !/^\d{6}$/.test(parsed.pin)
      || typeof parsed.uid !== "string" || !validMode || !Number.isFinite(parsed.savedAt)
      || Date.now() - parsed.savedAt > MAX_AGE_MS || (expectedUid && parsed.uid !== expectedUid)) {
      localStorage.removeItem(KEY)
      return null
    }
    return parsed as ActiveRoomSession
  } catch {
    return null
  }
}

export function clearActiveRoomSession(): void {
  try {
    localStorage.removeItem(KEY)
    sessionStorage.removeItem("mednexus-active-room")
  } catch {
    // ignore
  }
}
