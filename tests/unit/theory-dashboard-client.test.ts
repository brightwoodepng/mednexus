import { beforeEach, describe, expect, it, vi } from "vitest"

const dashboard = {
  authenticated: true,
  displayName: "Learner",
  totals: { total: 24, completed: 1 },
  collections: [],
  continueStudying: null,
  counts: { bookmarks: 0, notes: 0, drafts: 0, revision: 0 },
  recentSets: [],
}

describe("Theory dashboard preloading", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.unstubAllGlobals()
  })

  it("deduplicates preload and active navigation requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => dashboard })
    vi.stubGlobal("fetch", fetchMock)
    const client = await import("@/lib/theory-dashboard-client")

    const preload = client.preloadTheoryDashboard()
    const navigation = client.loadTheoryDashboard()

    await expect(Promise.all([preload, navigation])).resolves.toEqual([dashboard, dashboard])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("exposes successful preload data for only thirty seconds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => dashboard }))
    const client = await import("@/lib/theory-dashboard-client")
    vi.spyOn(Date, "now").mockReturnValue(1_000)

    await client.preloadTheoryDashboard()

    expect(client.getRecentTheoryDashboard(30_999)).toEqual(dashboard)
    expect(client.getRecentTheoryDashboard(31_001)).toBeNull()
  })

  it("keeps an in-flight request alive after Theory becomes its active consumer", async () => {
    let signal: AbortSignal | undefined
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return Promise.resolve({ ok: true, json: async () => dashboard })
    }))
    const client = await import("@/lib/theory-dashboard-client")

    const preload = client.preloadTheoryDashboard()
    const navigation = client.loadTheoryDashboard()
    client.abortTheoryDashboardPreload()

    expect(signal?.aborted).toBe(false)
    await expect(Promise.all([preload, navigation])).resolves.toHaveLength(2)
  })

  it("aborts an obsolete preload with no active Theory consumer", async () => {
    let signal: AbortSignal | undefined
    vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined
      return new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))))
    }))
    const client = await import("@/lib/theory-dashboard-client")

    const preload = client.preloadTheoryDashboard()
    client.abortTheoryDashboardPreload()

    expect(signal?.aborted).toBe(true)
    await expect(preload).rejects.toMatchObject({ name: "AbortError" })
  })
})
