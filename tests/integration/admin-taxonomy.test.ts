import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), query: vi.fn(), release: vi.fn(), poolQuery: vi.fn(), connect: vi.fn(), audit: vi.fn(),
}))
vi.mock("@/lib/admin-access", () => ({ requireAdminRequest: mocks.auth, adminAccessDenied: () => new Response("Forbidden", { status: 403 }) }))
vi.mock("@/lib/db", () => ({ default: { query: mocks.poolQuery, connect: mocks.connect }, ensureSchema: vi.fn() }))
vi.mock("@/lib/platform-settings", () => ({ auditAdmin: mocks.audit }))
vi.mock("@/lib/api-efficiency", () => ({ measuredJson: ({ payload }: { payload: unknown }, init: ResponseInit) => Response.json(payload, init) }))
import { GET, PATCH } from "@/app/api/admin/taxonomy/route"

const request = (body: unknown) => new NextRequest("http://localhost/api/admin/taxonomy", { method: "PATCH", body: JSON.stringify(body), headers: { "content-type": "application/json" } })
const rename = { action: "rename_module", module: "Medicine", newName: "Internal Medicine", confirm: true }

describe("admin taxonomy mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockResolvedValue({ uid: "admin" })
    mocks.connect.mockResolvedValue({ query: mocks.query, release: mocks.release })
    let count = 0
    mocks.query.mockImplementation(async (sql: string) => sql.includes("COUNT(*)") ? { rows: [{ count: count++ === 0 ? 12 : 0 }] } : { rows: [] })
    mocks.poolQuery.mockResolvedValue({ rows: [{ module_name: "Medicine", discipline: "Cardiology", question_count: 12 }] })
  })
  it("denies mutation without MCQ permission", async () => {
    mocks.auth.mockResolvedValue(null)
    expect((await PATCH(request(rename))).status).toBe(403)
    expect(mocks.connect).not.toHaveBeenCalled()
  })
  it.each([
    { ...rename, confirm: "yes" },
    { ...rename, module: 23 },
    { ...rename, newName: " ".repeat(4) },
    { ...rename, newName: "a".repeat(161) },
    { ...rename, newName: "Medicine" },
    { action: "move_discipline", module: "Medicine", discipline: "Cardiology", destinationModule: {}, confirm: true },
  ])("rejects invalid or unchanged input before writing: %j", async body => {
    expect((await PATCH(request(body))).status).toBe(400)
    expect(mocks.connect).not.toHaveBeenCalled()
  })
  it("rejects malformed JSON", async () => {
    expect((await PATCH(new NextRequest("http://localhost/api/admin/taxonomy", { method: "PATCH", body: "{" }))).status).toBe(400)
  })
  it("renames under a lock, preserves array order and audits the transaction", async () => {
    const response = await PATCH(request(rename))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, affected: 12 })
    const calls = mocks.query.mock.calls
    expect(calls.some(([sql]) => sql.includes("FOR UPDATE"))).toBe(true)
    const update = calls.find(([sql]) => sql.startsWith("UPDATE mednexus_questions"))!
    expect(update[0]).toContain("ORDER BY item.ordinality")
    expect(update[1]).toEqual(["Medicine", null, "Internal Medicine"])
    expect(mocks.audit).toHaveBeenCalled()
    expect(calls.at(-1)?.[0]).toBe("COMMIT")
    expect(mocks.release).toHaveBeenCalled()
  })
  it("requires explicit merge approval if the destination exists", async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.includes("COUNT(*)") ? { rows: [{ count: 12 }] } : { rows: [] })
    const response = await PATCH(request(rename))
    expect(response.status).toBe(409)
    expect((await response.json()).requiresMerge).toBe(true)
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false)
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK")
  })
  it("combines groups only after approval", async () => {
    mocks.query.mockImplementation(async (sql: string) => sql.includes("COUNT(*)") ? { rows: [{ count: 12 }] } : { rows: [] })
    expect((await PATCH(request({ ...rename, allowMerge: true }))).status).toBe(200)
  })
  it("binds move parameters without unused placeholders", async () => {
    expect((await PATCH(request({ action: "move_discipline", module: "Medicine", discipline: "Cardiology", destinationModule: "Clinical Science", destinationDiscipline: "Cardiology", confirm: true }))).status).toBe(200)
    const update = mocks.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE mednexus_questions"))!
    expect(update[1]).toEqual(["Medicine", "Cardiology", "Clinical Science", "Cardiology"])
    expect(update[0]).toContain("to_jsonb($3::text)")
    expect(update[0]).not.toContain("$5")
  })
  it("keeps a legacy implicit module stable when renaming its discipline", async () => {
    await PATCH(request({ action: "rename_discipline", module: "Cardiology", discipline: "Cardiology", newName: "Cardiovascular", confirm: true }))
    const update = mocks.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE mednexus_questions"))!
    expect(update[0]).toContain("NULLIF(BTRIM(item.value->>'subject'), '')")
    expect(update[0]).toContain("'{module}', to_jsonb($1::text)")
  })
  it("rolls back write failures and releases the connection", async () => {
    mocks.audit.mockRejectedValueOnce(new Error("audit unavailable"))
    expect((await PATCH(request(rename))).status).toBe(500)
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK")
    expect(mocks.release).toHaveBeenCalled()
  })
  it("returns fresh grouped metadata", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/taxonomy"))
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect((await response.json()).modules[0]).toEqual({ name: "Medicine", questionCount: 12, disciplines: [{ name: "Cardiology", questionCount: 12 }] })
  })
})
