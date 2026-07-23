import { beforeEach, describe, expect, it, vi } from "vitest"

const database = {
  role: "STUDENT",
  status: "approved",
  permissions: [] as Array<{ permission: string; granted: boolean }>,
  users: [{ uid: "learner-1", name: "Learner", status: "approved", created_at: "2026-01-01" }],
}

const query = vi.fn(async (sql: string) => {
  if (sql.includes("FROM mednexus_registered_users u")) {
    return {
      rows: [{ role: database.role, status: database.status }, ...database.permissions],
      rowCount: 1,
    }
  }
  if (sql.includes("FROM mednexus_registered_users WHERE 1=1")) {
    return { rows: database.users, rowCount: database.users.length }
  }
  if (sql.includes("SELECT COUNT(*)")) return { rows: [{ count: String(database.users.length) }], rowCount: 1 }
  throw new Error(`Unexpected query: ${sql}`)
})

vi.mock("server-only", () => ({}))
vi.mock("@/lib/db", () => ({ default: { query } }))
// Request tests deliberately have no HttpOnly cookie: only an authentic signed
// token in the transport under test can establish an identity.
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })) }))

function request(token?: string, extraHeaders: Record<string, string> = {}) {
  const req = new Request("http://mednexus.test/api/admin/users", {
    headers: { ...(token ? { "x-session-token": token } : {}), ...extraHeaders },
  })
  return Object.assign(req, { nextUrl: new URL(req.url) })
}

describe("admin access integration", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "integration-test-secret"
    database.role = "STUDENT"
    database.status = "approved"
    database.permissions = []
    query.mockClear()
  })

  it("denies guest, missing-cookie, tampered, and expired requests as unauthenticated", async () => {
    const { adminAccessDenied, requireAdminRequest } = await import("@/lib/admin-access")
    const { createSessionToken } = await import("@/lib/session-auth")
    const expired = createSessionToken("learner-1", "ADMIN", -1)
    const valid = createSessionToken("learner-1", "ADMIN")

    for (const req of [request(), request("forged.token"), request(`${valid}tampered`), request(expired)]) {
      expect(await requireAdminRequest(req, "manage_users")).toBeNull()
      expect((await adminAccessDenied(req)).status).toBe(401)
    }
  })

  it("uses the current database role rather than the signed or client-provided role", async () => {
    const { adminAccessDenied, requireAdminRequest } = await import("@/lib/admin-access")
    const { createSessionToken } = await import("@/lib/session-auth")
    const studentToken = createSessionToken("learner-1", "SUPER_ADMIN")
    const forgedRole = request(studentToken, { "x-role": "SUPER_ADMIN", "x-session-role": "ADMIN" })

    expect(await requireAdminRequest(forgedRole, "manage_users")).toBeNull()
    expect((await adminAccessDenied(forgedRole)).status).toBe(403)

    database.role = "ADMIN"
    expect(await requireAdminRequest(request(studentToken), "manage_users")).toEqual({ uid: "learner-1", role: "ADMIN" })

    // Demotion after login takes effect immediately, even though the token says ADMIN.
    database.role = "STUDENT"
    expect(await requireAdminRequest(request(createSessionToken("learner-1", "ADMIN")), "manage_users")).toBeNull()
  })

  it("allows ADMIN baseline permissions and SUPER_ADMIN system permissions", async () => {
    const { requireAdminRequest } = await import("@/lib/admin-access")
    const { createSessionToken } = await import("@/lib/session-auth")
    database.role = "ADMIN"
    const adminToken = createSessionToken("learner-1", "STUDENT")
    expect(await requireAdminRequest(request(adminToken), "manage_mcq_content")).toEqual({ uid: "learner-1", role: "ADMIN" })
    expect(await requireAdminRequest(request(adminToken), "manage_system")).toBeNull()

    database.role = "SUPER_ADMIN"
    expect(await requireAdminRequest(request(adminToken), "manage_system")).toEqual({ uid: "learner-1", role: "SUPER_ADMIN" })
  })

  it("protects the users route while allowing a verified administrator", async () => {
    const { GET } = await import("@/app/api/admin/users/route")
    const { createSessionToken } = await import("@/lib/session-auth")

    expect((await GET(request() as never)).status).toBe(401)

    database.role = "STUDENT"
    expect((await GET(request(createSessionToken("learner-1", "STUDENT"), { "x-role": "ADMIN" }) as never)).status).toBe(403)

    database.role = "ADMIN"
    const response = await GET(request(createSessionToken("learner-1", "STUDENT")) as never)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ total: 1, users: [{ uid: "learner-1" }] })
  })
})
