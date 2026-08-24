import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const requireRegisteredUser = vi.fn()
const query = vi.fn()

vi.mock("server-only", () => ({}))
vi.mock("@/lib/request-auth", () => ({
  requireRegisteredUser,
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
}))
vi.mock("@/lib/admin-access", () => ({
  adminAccessDenied: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  requireAdminRequest: vi.fn(),
}))
vi.mock("@/lib/platform-settings", () => ({ auditAdmin: vi.fn() }))
vi.mock("@/lib/db", () => ({ default: { query } }))

function bulkRequest(path: string, body: Record<string, unknown> = { markAllRead: true }) {
  return new NextRequest(`http://mednexus.test${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("notification bulk mark-all-read routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DATABASE_URL = "postgres://test"
    requireRegisteredUser.mockResolvedValue({ uid: "user-a", role: "STUDENT" })
    query.mockResolvedValue({ rows: [], rowCount: 0 })
  })

  it.each([
    ["broadcast", "/api/notifications", async (req: NextRequest) => (await import("@/app/api/notifications/route")).PATCH(req)],
    ["personal", "/api/user-notifications", async (req: NextRequest) => (await import("@/app/api/user-notifications/route")).PATCH(req)],
  ])("requires authentication for the %s feed", async (_name, path, patch) => {
    requireRegisteredUser.mockResolvedValue(null)
    const response = await patch(bulkRequest(path))
    expect(response.status).toBe(401)
    expect(query).not.toHaveBeenCalled()
  })

  it("marks every broadcast in one set-based statement and uses only the session identity", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 3 })
    const { PATCH } = await import("@/app/api/notifications/route")
    const response = await PATCH(bulkRequest("/api/notifications", { markAllRead: true, userId: "user-b" }))

    expect(await response.json()).toEqual({ success: true, updated: 3 })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/INSERT INTO[\s\S]+SELECT[\s\S]+ON CONFLICT/), ["user-a", false, "STUDENT"])
    expect(query.mock.calls[0][1]).not.toContain("user-b")
  })

  it("marks multiple personal rows in one user-scoped statement", async () => {
    query.mockResolvedValue({ rows: [], rowCount: 4 })
    const { PATCH } = await import("@/app/api/user-notifications/route")
    const response = await PATCH(bulkRequest("/api/user-notifications", { markAllRead: true, userId: "user-b" }))

    expect(await response.json()).toEqual({ success: true, updated: 4 })
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/UPDATE mednexus_user_notifications[\s\S]+user_id = \$1[\s\S]+is_read = FALSE/), ["user-a"])
  })

  it.each([
    ["/api/notifications", async (req: NextRequest) => (await import("@/app/api/notifications/route")).PATCH(req)],
    ["/api/user-notifications", async (req: NextRequest) => (await import("@/app/api/user-notifications/route")).PATCH(req)],
  ])("succeeds for an empty inbox at %s", async (path, patch) => {
    const response = await patch(bulkRequest(path))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, updated: 0 })
  })
})
