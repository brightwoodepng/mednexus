import type { StudyHubId } from "@/components/study-hub-switcher"
import type { Screen } from "@/lib/view"

const HUB_QUERY_VALUES: Record<StudyHubId, string> = {
  "mcq-qbank": "mcq",
  "theory-vault": "theory",
  "osce-hub": "osce",
}

export function studyHubFromUrl(url = typeof window === "undefined" ? "http://localhost" : window.location.href): StudyHubId {
  const hub = new URL(url).searchParams.get("hub")
  return hub === "theory" ? "theory-vault" : hub === "osce" ? "osce-hub" : "mcq-qbank"
}

export function withHubContext(pathname: string, hub: StudyHubId): string {
  const url = new URL(pathname, typeof window === "undefined" ? "http://localhost" : window.location.origin)
  url.searchParams.set("hub", HUB_QUERY_VALUES[hub])
  return `${url.pathname}${url.search}`
}

export function adminScreenFromUrl(url = typeof window === "undefined" ? "http://localhost" : window.location.href): Screen | null {
  const pathname = new URL(url).pathname
  if (pathname === "/admin/users") return "user-management"
  if (pathname === "/admin/broadcasts") return "broadcast"
  return null
}

const URL_BACKED_LEARNER_SCREENS = new Set<Screen>([
  "dashboard", "modules", "weak-areas", "live-assessments", "game", "store",
  "store-supply", "store-cosmetics", "store-vault", "leaderboard",
  "theory-dashboard", "theory-browse", "theory-bookmarks", "theory-notes",
  "theory-revision", "theory-progress", "theory-search",
])

/** Resolve every learner URL emitted by learnerScreenUrl back to app state. */
export function learnerScreenFromUrl(url = typeof window === "undefined" ? "http://localhost" : window.location.href): Screen {
  const parsed = new URL(url)
  const adminScreen = adminScreenFromUrl(parsed.href)
  if (adminScreen) return adminScreen
  if (parsed.pathname === "/profile") return "profile"

  const requestedScreen = parsed.searchParams.get("screen") as Screen | null
  if (requestedScreen && URL_BACKED_LEARNER_SCREENS.has(requestedScreen)) return requestedScreen
  return studyHubFromUrl(parsed.href) === "theory-vault" ? "theory-dashboard" : "dashboard"
}

/** Return the canonical, refresh-safe URL for a learner navigation destination. */
export function learnerScreenUrl(screen: Screen, hub: StudyHubId): string {
  if (screen === "profile") return withHubContext("/profile", hub)
  if (screen === "user-management") return withHubContext("/admin/users", hub)
  if (screen === "broadcast") return withHubContext("/admin/broadcasts", hub)

  const defaultScreen = hub === "theory-vault" ? "theory-dashboard" : "dashboard"
  const pathname = screen === defaultScreen ? "/" : `/?screen=${encodeURIComponent(screen)}`
  return withHubContext(pathname, hub)
}
