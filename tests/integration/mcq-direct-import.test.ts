import { beforeEach, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const m = vi.hoisted(() => ({ auth: vi.fn(), query: vi.fn(), connect: vi.fn(), audit: vi.fn(), release: vi.fn() }))
vi.mock("@/lib/admin-access", () => ({ requireAdminRequest: m.auth, adminAccessDenied: () => new Response(null, { status: 403 }) }))
vi.mock("@/lib/db", () => ({ default: { connect: m.connect } }))
vi.mock("@/lib/platform-settings", () => ({ auditAdmin: m.audit }))
vi.mock("@/lib/api-efficiency", () => ({ boundedPagination: vi.fn(), measuredJson: vi.fn() }))
import { POST } from "@/app/api/admin/content/imports/route"
const q = { id: "q1", vignette: "Stem", options: [{ id: "A", text: "Answer" }], status: "live", moduleStatus: "live" }
const req = (drafts: unknown[]) => new NextRequest("http://localhost/api/admin/content/imports", { method: "POST", body: JSON.stringify({ bank: "mcq", drafts }) })
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ uid: "admin" }); m.connect.mockResolvedValue({ query: m.query, release: m.release }); m.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("FOR UPDATE") ? [{ updated_at: "now" }] : [] })) })
it("saves imported questions immediately as drafts and commits history atomically", async () => {
  const response = await POST(req([q]))
  expect(response.status).toBe(201)
  expect(await response.json()).toMatchObject({ imported: 1, status: "committed" })
  const update = m.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE mednexus_questions"))!
  expect(JSON.parse(update[1][0])[0]).toMatchObject({ id: "q1", status: "draft", moduleStatus: "draft" })
  expect(m.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO mednexus_content_import_jobs"))).toBe(true)
  expect(m.query.mock.calls.at(-1)?.[0]).toBe("COMMIT")
})
it("skips duplicate IDs in the file and existing bank", async () => {
  m.query.mockImplementation(async (sql: string) => ({ rows: sql.includes("FOR UPDATE") ? [{}] : sql.includes("question.value") ? [{ id: "existing" }] : [] }))
  const response = await POST(req([q, q, { ...q, id: "existing" }]))
  expect(await response.json()).toMatchObject({ imported: 1, errorCount: 2 })
})
it("skips malformed records", async () => {
  const response = await POST(req([null, { id: "bad" }, q]))
  expect(await response.json()).toMatchObject({ imported: 1, errorCount: 2 })
})
it("rolls back if history or audit fails", async () => {
  m.audit.mockRejectedValueOnce(new Error("Audit failed"))
  expect((await POST(req([q]))).status).toBe(500)
  expect(m.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK")
  expect(m.release).toHaveBeenCalled()
})
it("requires MCQ permission before opening a transaction", async () => {
  m.auth.mockResolvedValue(null)
  expect((await POST(req([q]))).status).toBe(403)
  expect(m.connect).not.toHaveBeenCalled()
})
