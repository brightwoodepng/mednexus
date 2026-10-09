import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const { query, auth, notify } = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn(), notify: vi.fn() }))
vi.mock("@/lib/request-auth", () => ({ requireRegisteredUser: auth, unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }) }))
vi.mock("@/lib/db", () => ({ default: { query, connect: async () => ({ query, release: () => {} }) } }))
vi.mock("@/lib/progression-notifications", () => ({ triggerProgressionNotifications: notify }))
vi.mock("@/lib/firebase-admin", () => ({ getAdminDb: () => null }))

describe("durable account sync", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://test"
    auth.mockResolvedValue({ uid: "learner-1" })
    query.mockReset()
    notify.mockReset()
  })

  it("returns the full snapshot for a new device even when the server version is zero", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("LEFT JOIN mednexus_progress")) return { rows: [{ name: "Learner", version: 0 }] }
      if (sql.includes("SELECT data")) return { rows: [{ data: { totalAnswered: 10 } }] }
      return { rows: [] }
    })
    const { GET } = await import("@/app/api/sync/route")
    const response = await GET(new NextRequest("http://test/api/sync"))
    expect((await response.json()).progress.totalAnswered).toBe(10)
    expect(response.headers.get("cache-control")).toContain("no-store")
  })

  it("acknowledges retries without incrementing statistics again", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("FOR UPDATE")) return { rows: [{ version: 8, data: { _syncMutationIds: ["mutation-1"] } }] }
      return { rows: [] }
    })
    const { POST } = await import("@/app/api/sync/route")
    const response = await POST(new NextRequest("http://test/api/sync", { method: "POST", body: JSON.stringify({ baseVersion: 7, mutationId: "mutation-1", increments: { totalAnswered: 10 } }) }))
    expect(await response.json()).toMatchObject({ success: true, version: 8 })
    expect(query.mock.calls.some(([sql]) => String(sql).includes("UPDATE mednexus_progress SET"))).toBe(false)
  })

  it("stores an acknowledgement in the same transaction as a new result", async () => {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("FOR UPDATE")) return { rows: [{ version: 7, data: {} }] }
      if (sql.includes("UPDATE mednexus_progress SET")) return { rows: [{ version: 8, data: {} }] }
      return { rows: [] }
    })
    const { POST } = await import("@/app/api/sync/route")
    const response = await POST(new NextRequest("http://test/api/sync", { method: "POST", body: JSON.stringify({ baseVersion: 7, mutationId: "mutation-2", increments: { totalAnswered: 1 } }) }))
    expect(response.status).toBe(200)
    const update = query.mock.calls.find(([sql]) => String(sql).includes("UPDATE mednexus_progress SET"))!
    expect(JSON.parse(update[1][2])._syncMutationIds).toEqual(["mutation-2"])
  })

  it("rejects saved attempts belonging to a different account", async () => {
    const { POST } = await import("@/app/api/sync/route")
    const response = await POST(new NextRequest("http://test/api/sync", { method: "POST", body: JSON.stringify({ baseVersion: 0, patch: { savedQuizSession: { userId: "someone-else" } } }) }))
    expect(response.status).toBe(400)
    expect(query).not.toHaveBeenCalled()
  })
})
