import { beforeEach, describe, expect, it, vi } from "vitest"

const db = { role: "STUDENT", status: "approved", guest: true, permissions: [] as Array<{ permission: string; granted: boolean }> }
const query = vi.fn(async (sql: string) => {
  if (sql.includes("mednexus_registered_users u")) return { rows: db.status === "approved" ? [{ role: db.role }, ...db.permissions] : [] }
  if (sql.includes("mednexus_guest_users")) return { rows: db.guest ? [{ uid: "guest-1" }] : [] }
  throw new Error(`Unexpected query: ${sql}`)
})
vi.mock("server-only", () => ({}))
vi.mock("@/lib/db", () => ({ default: { query } }))
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })) }))

function request(token?: string) { return new Request("http://mednexus.test/api/protected", { headers: token ? { "x-session-token": token } : {} }) }

describe("server request auth", () => {
  beforeEach(() => { process.env.SESSION_SECRET = "request-auth-test"; db.role = "STUDENT"; db.status = "approved"; db.permissions = []; query.mockClear() })
  it("rejects absent credentials and does not trust browser role fields", async () => {
    const { requireRegisteredUser } = await import("@/lib/request-auth")
    const { createSessionToken } = await import("@/lib/session-auth")
    expect(await requireRegisteredUser(request())).toBeNull()
    expect(await requireRegisteredUser(new Request("http://x", { headers: { "x-session-token": createSessionToken("learner-1", "SUPER_ADMIN"), "x-role": "SUPER_ADMIN" } }))).toMatchObject({ uid: "learner-1", role: "STUDENT" })
  })
  it("enforces server permissions and blocks guest access to registered helpers", async () => {
    const { requireAdminPermission, requireAuthenticatedUser, requireRegisteredUser } = await import("@/lib/request-auth")
    const { createSessionToken } = await import("@/lib/session-auth")
    const { createGuestToken } = await import("@/lib/guest-auth")
    const learner = request(createSessionToken("learner-1", "ADMIN"))
    expect(await requireAdminPermission(learner, "manage_system")).toBeNull()
    db.role = "ADMIN"; db.permissions = [{ permission: "manage_system", granted: true }]
    expect(await requireAdminPermission(learner, "manage_system")).toMatchObject({ uid: "learner-1" })
    const guest = new Request("http://x", { headers: { "x-guest-token": createGuestToken("guest-1") } })
    expect(await requireRegisteredUser(guest)).toBeNull()
    expect(await requireAuthenticatedUser(guest)).toMatchObject({ uid: "guest-1", isGuest: true })
  })
})
