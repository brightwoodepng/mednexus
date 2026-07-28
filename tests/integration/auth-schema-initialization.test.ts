import { beforeEach, describe, expect, it, vi } from "vitest"

type RegisteredUser = {
  uid: string
  name: string
  level: string
  class_level: string
  role: string
  index_number: string
  password_hash: string
  status: string
  must_change_password: boolean
  otp_hash: string | null
}

let schemaInitialized = false
const registeredUsers: RegisteredUser[] = []
const wallets: Array<{ uid: string; balance: number }> = []
const notifications: Array<{ title: string; body: string }> = []
const guestUsers: Array<{ uid: string; name: string; class_level: string; role: string }> = []

function requireSchema() {
  if (!schemaInitialized) throw new Error("relation does not exist: schema was not initialized")
}

const query = vi.fn(async (sql: string, params: unknown[] = []) => {
  requireSchema()

  if (sql.includes("FROM mednexus_economy_seasons")) return { rows: [{ id: "season-1", name: "Season 1", economy_version: "2.0", starts_at: "2026-01-01", opening_grant: 500 }], rowCount: 1 }
  if (sql.includes("SELECT 1 FROM mednexus_registered_users")) {
    const user = registeredUsers.find(({ uid, status }) => uid === params[0] && status === "approved")
    return { rows: user ? [{ "?column?": 1 }] : [], rowCount: user ? 1 : 0 }
  }

  if (sql.includes("SELECT uid FROM mednexus_registered_users")) {
    const user = registeredUsers.find(({ index_number }) => index_number === params[0])
    return { rows: user ? [{ uid: user.uid }] : [], rowCount: user ? 1 : 0 }
  }
  if (sql.includes("SELECT uid, name, level, class_level")) {
    const user = registeredUsers.find(({ index_number }) => index_number === params[0])
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 }
  }
  if (sql.includes("FROM mednexus_registered_users u")) {
    const user = registeredUsers.find(({ uid }) => uid === params[0])
    return { rows: user ? [{ role: user.role, status: user.status }] : [], rowCount: user ? 1 : 0 }
  }
  if (sql.includes("INSERT INTO mednexus_registered_users")) {
    registeredUsers.push({
      uid: params[0] as string,
      name: params[1] as string,
      level: params[2] as string,
      class_level: params[2] as string,
      role: "REGISTERED",
      index_number: params[3] as string,
      password_hash: params[4] as string,
      status: params[5] as string,
      must_change_password: false,
      otp_hash: null,
    })
    return { rows: [], rowCount: 1 }
  }
  if (sql.includes("INSERT INTO mednexus_users")) {
    return { rows: [], rowCount: 1 }
  }
  if (sql.includes("INSERT INTO mednexus_np_transactions")) {
    return { rows: [{ id: params[0] }], rowCount: 1 }
  }
  if (sql.includes("INSERT INTO mednexus_season_wallets")) {
    wallets.push({ uid: params[1] as string, balance: 0 })
    return { rows: [], rowCount: 1 }
  }
  if (sql.includes("UPDATE mednexus_season_wallets")) {
    const wallet = wallets.find(({ uid }) => uid === params[1])!
    wallet.balance += Number(params[2])
    return { rows: [], rowCount: 1 }
  }
  if (sql.includes("INSERT INTO mednexus_notifications")) {
    notifications.push({ title: params[1] as string, body: params[2] as string })
    return { rows: [], rowCount: 1 }
  }
  if (sql.includes("INSERT INTO mednexus_guest_users")) {
    const guest = { uid: params[0] as string, name: params[1] as string, class_level: params[2] as string, role: "GUEST" }
    guestUsers.push(guest)
    return { rows: [{ ...guest, created_at: "2026-01-01T00:00:00.000Z", expires_at: params[4] }], rowCount: 1 }
  }
  if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: 0 }
  throw new Error(`Unexpected query: ${sql}`)
})

const ensureSchema = vi.fn(async () => {
  schemaInitialized = true
})

vi.mock("@/lib/db", () => ({
  default: { query, connect: async () => ({ query, release: vi.fn() }) },
  ensureSchema,
}))
vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: vi.fn(() => undefined) })) }))

function post(url: string, body: Record<string, string>) {
  return new Request(`http://mednexus.test${url}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("account entry schema initialization", () => {
  beforeEach(() => {
    schemaInitialized = false
    registeredUsers.length = 0
    wallets.length = 0
    notifications.length = 0
    guestUsers.length = 0
    ensureSchema.mockClear()
    query.mockClear()
    process.env.SESSION_SECRET = "auth-schema-integration-secret"
  })

  it("registers against an uninitialized database and provisions all account records", async () => {
    const { POST } = await import("@/app/api/auth/register/route")
    const response = await POST(post("/api/auth/register", {
      name: "Pending Learner", classLevel: "Level 400", indexNumber: "external-0001", password: "secure-password",
    }) as never)

    expect(response.status).toBe(200)
    expect(ensureSchema).toHaveBeenCalledTimes(1)
    expect(registeredUsers).toHaveLength(1)
    expect(registeredUsers[0]).toMatchObject({ name: "Pending Learner", class_level: "Level 400", status: "pending" })
    expect(wallets).toEqual([])
    expect(notifications).toHaveLength(1)

    const duplicate = await POST(post("/api/auth/register", {
      name: "Duplicate", classLevel: "Level 400", indexNumber: "external-0001", password: "secure-password",
    }) as never)
    expect(duplicate.status).toBe(409)

    const invalidLevel = await POST(post("/api/auth/register", {
      name: "Invalid", classLevel: "Not a level", indexNumber: "external-0002", password: "secure-password",
    }) as never)
    expect(invalidLevel.status).toBe(422)
  })

  it("returns readable validation and duplicate-account responses", async () => {
    const { POST } = await import("@/app/api/auth/register/route")

    const invalidJson = await POST(new Request("http://mednexus.test/api/auth/register", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{",
    }) as never)
    expect(invalidJson.status).toBe(400)
    await expect(invalidJson.json()).resolves.toEqual({ error: "Invalid JSON body" })

    const invalidFields = await POST(new Request("http://mednexus.test/api/auth/register", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Learner", classLevel: 400, indexNumber: "learner-0001", password: 123456 }),
    }) as never)
    expect(invalidFields.status).toBe(400)
    await expect(invalidFields.json()).resolves.toEqual({ error: "Name, index number, and password are required" })

    const first = await POST(post("/api/auth/register", {
      name: "Learner", classLevel: "Level 400", indexNumber: "learner-0001", password: "secure-password",
    }) as never)
    expect(first.status).toBe(200)

    const duplicate = await POST(post("/api/auth/register", {
      name: "Learner Again", classLevel: "Level 400", indexNumber: "learner-0001", password: "secure-password",
    }) as never)
    expect(duplicate.status).toBe(409)
    await expect(duplicate.json()).resolves.toEqual({ error: "An account with this index number already exists" })
  })

  it("initializes the schema before login and guest entry", async () => {
    const { POST: register } = await import("@/app/api/auth/register/route")
    const registration = await register(post("/api/auth/register", {
      name: "Approved Learner", classLevel: "Level 400", indexNumber: "SM/SMS/22/0001", password: "secure-password",
    }) as never)
    expect(registration.status).toBe(200)
    registeredUsers[0].status = "approved"

    schemaInitialized = false
    const { POST: login } = await import("@/app/api/auth/login/route")
    const loginResponse = await login(post("/api/auth/login", { indexNumber: "sm/sms/22/0001", password: "secure-password" }) as never)
    expect(loginResponse.status).toBe(200)
    await expect(loginResponse.json()).resolves.toMatchObject({ name: "Approved Learner", role: "STUDENT" })

    schemaInitialized = false
    const { POST: guest } = await import("@/app/api/auth/guest/route")
    const guestResponse = await guest(post("/api/auth/guest", { name: "Guest Learner", classLevel: "Level 300" }) as never)
    expect(guestResponse.status).toBe(201)
    expect(guestUsers).toHaveLength(1)
    expect(ensureSchema).toHaveBeenCalledTimes(3)
  })
})
