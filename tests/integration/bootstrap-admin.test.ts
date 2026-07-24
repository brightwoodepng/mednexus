import { describe, expect, it, vi } from "vitest"
import { bootstrapAdmin } from "@/lib/bootstrap-admin"

describe("bootstrapAdmin", () => {
  it("promotes only an existing registered account and writes its audit record", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ uid: "registered-1", index_number: "sm/sms/24/0123", role: "STUDENT" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
    const target = await bootstrapAdmin({ query }, "SM/SMS/24/0123")
    expect(target.uid).toBe("registered-1")
    expect(query.mock.calls[0][1]).toEqual(["sm/sms/24/0123"])
    expect(query.mock.calls[1][0]).toContain("UPDATE mednexus_registered_users SET role = 'SUPER_ADMIN'")
    expect(query.mock.calls[2][0]).toContain("INSERT INTO mednexus_role_audit_log")
    expect(query.mock.calls[2][1]).toEqual(["registered-1", "STUDENT"])
  })

  it("never creates an account when the index number is not registered", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] })
    await expect(bootstrapAdmin({ query }, "sm/sms/24/0123")).rejects.toThrow("no registered account")
    expect(query).toHaveBeenCalledTimes(1)
  })
})
