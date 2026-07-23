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
