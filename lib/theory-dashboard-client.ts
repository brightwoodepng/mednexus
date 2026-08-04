export type TheoryDashboardData = {
  authenticated: boolean
  displayName: string
  totals: { total: number; completed: number }
  collections: Array<{ id: string; slug: string; title: string; kind: string; groups: number; sets: number; total: number; completed: number }>
  continueStudying: null | { id: string; setId: string | null; setTitle: string | null; setNumber: number | null; setLabel: string | null; collection: string; groupName: string; lastStudiedAt: string; setTotal: number; setCompleted: number }
  counts: { bookmarks: number; notes: number; drafts: number; revision: number }
  recentSets: Array<{ id: string; setId: string; setTitle: string; setNumber: number; setLabel: string; collection: string; groupName: string; lastStudiedAt: string; progressPercent: number }>
}

export const THEORY_DASHBOARD_FRESH_MS = 30_000

let cachedDashboard: { data: TheoryDashboardData; loadedAt: number } | null = null
let dashboardRequest: { promise: Promise<TheoryDashboardData>; controller: AbortController; activeConsumer: boolean } | null = null

async function fetchDashboard(signal: AbortSignal) {
  const response = await fetch("/api/theory/dashboard", { cache: "no-store", signal })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? "Unable to load Theory Vault.")
  cachedDashboard = { data: data as TheoryDashboardData, loadedAt: Date.now() }
  return cachedDashboard.data
}

function requestDashboard(activeConsumer: boolean) {
  if (dashboardRequest) {
    if (activeConsumer) dashboardRequest.activeConsumer = true
    return dashboardRequest.promise
  }
  const controller = new AbortController()
  const request = {
    controller,
    activeConsumer,
    promise: fetchDashboard(controller.signal).finally(() => {
      if (dashboardRequest === request) dashboardRequest = null
    }),
  }
  dashboardRequest = request
  return request.promise
}

export function preloadTheoryDashboard() {
  return requestDashboard(false)
}

export function loadTheoryDashboard() {
  return requestDashboard(true)
}

export function getRecentTheoryDashboard(now = Date.now()) {
  return cachedDashboard && now - cachedDashboard.loadedAt <= THEORY_DASHBOARD_FRESH_MS
    ? cachedDashboard.data
    : null
}

export function abortTheoryDashboardPreload() {
  if (dashboardRequest && !dashboardRequest.activeConsumer) dashboardRequest.controller.abort()
}
