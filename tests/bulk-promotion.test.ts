import { describe, expect, it, vi } from "vitest"
import type { Pool } from "pg"
vi.mock("../lib/platform-settings", () => ({ auditAdmin: vi.fn(async (client, actor, action, type, uid, details) => client.query("AUDIT", [actor, uid, details])) }))
import { promoteStudents, validPromotion } from "../lib/bulk-promotion"

function database(rows: object[], failAudit = false) {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("SELECT")) return { rows }
    if (sql === "AUDIT" && failAudit) throw new Error("audit unavailable")
    return { rows: [] }
  })
  const release = vi.fn()
  return { pool: { connect: async () => ({ query, release }) } as unknown as Pool, query, release }
}
const student = { uid: "a", level: "Level 400", class_level: "Level 400", status: "approved", role: "STUDENT" }
describe("bulk promotion", () => {
  it("validates levels, duplicate IDs and batch limits", () => {
    expect(validPromotion("Level 400", "Level 500", ["a"])).toBe(true)
    for (const args of [["Level 400", "Level 400", ["a"]], ["unknown", "Level 500", ["a"]], ["Level 400", "Level 500", []], ["Level 400", "Level 500", ["a", "a"]], ["Level 400", "Level 500", Array.from({ length: 501 }, (_, i) => String(i))]]) expect(validPromotion(...args as [unknown, unknown, unknown])).toBe(false)
  })
  it("updates both level fields and commits the history together", async () => {
    const db = database([student])
    expect(await promoteStudents(db.pool, "admin", "Level 400", "Level 500", ["a"])).toBe(true)
    expect(db.query.mock.calls.some(([sql]) => sql.includes("level=$1, class_level=$1"))).toBe(true)
    expect(db.query).toHaveBeenCalledWith("COMMIT")
    expect(db.release).toHaveBeenCalledOnce()
  })
  it.each([{ rows: [] }, { rows: [{ ...student, level: "Level 500" }] }, { rows: [{ ...student, status: "suspended" }] }, { rows: [{ ...student, role: "ADMIN" }] }])("rejects stale, missing or ineligible selections without an update", async ({ rows }) => {
    const db = database(rows)
    expect(await promoteStudents(db.pool, "admin", "Level 400", "Level 500", ["a"])).toBe(false)
    expect(db.query).toHaveBeenCalledWith("ROLLBACK")
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false)
  })
  it("rolls back when history cannot be recorded", async () => {
    const db = database([student], true)
    await expect(promoteStudents(db.pool, "admin", "Level 400", "Level 500", ["a"])).rejects.toThrow()
    expect(db.query).toHaveBeenCalledWith("ROLLBACK")
    expect(db.query).not.toHaveBeenCalledWith("COMMIT")
  })
})
