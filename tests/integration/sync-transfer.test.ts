import { beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const query = vi.fn(async (sql: string) => {
  if (sql.includes("LEFT JOIN mednexus_progress")) return { rows: [{ name: "Learner", version: 7 }] }
  if (sql.includes("SELECT data FROM mednexus_progress")) return { rows: [{ data: { streak: 3 } }] }
  if (sql.includes("mednexus_progress_history")) return { rows: [{ payload: { id: "history-1" } }] }
  if (sql.includes("mednexus_progress_exam_scores")) return { rows: [{ payload: { id: "exam-1" } }] }
  throw new Error(`Unexpected query: ${sql}`)
})

vi.mock("@/lib/request-auth", () => ({
  requireRegisteredUser: vi.fn(async () => ({ uid: "learner-1" })),
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}))
vi.mock("@/lib/db", () => ({ default: { query } }))
vi.mock("@/lib/firebase-admin", () => ({ getAdminDb: () => null }))

describe("version-aware progress sync transfer", () => {
  beforeAll(() => { process.env.DATABASE_URL = "postgres://test" })

  it("does not read history or exam payloads when the client version is current", async () => {
    query.mockClear()
    const { GET } = await import("@/app/api/sync/route")
    const response = await GET(new NextRequest("http://mednexus.test/api/sync?version=7"))
    expect(await response.json()).toMatchObject({ version: 7, unchanged: true })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls.some(([sql]) => String(sql).includes("SELECT data"))).toBe(false)
    expect(query.mock.calls.some(([sql]) => String(sql).includes("progress_history"))).toBe(false)
    expect(query.mock.calls.some(([sql]) => String(sql).includes("exam_scores"))).toBe(false)
  })

  it("loads bounded event payloads when the version changed", async () => {
    query.mockClear()
    const { GET } = await import("@/app/api/sync/route")
    const response = await GET(new NextRequest("http://mednexus.test/api/sync?version=6"))
    const body = await response.json()
    expect(body.progress.history).toEqual([{ id: "history-1" }])
    expect(body.progress.examScores).toEqual([{ id: "exam-1" }])
    expect(query).toHaveBeenCalledTimes(4)
  })
})
