import { describe, expect, it } from "vitest"
import { canShowAdminConsoleLink } from "@/lib/admin-console-link"

describe("learner Admin Console account-menu link", () => {
  it("never displays for guests or ordinary registered students", () => {
    expect(canShowAdminConsoleLink({ role: "guest", status: "approved", sessionVerified: true, canAccessAdmin: true })).toBe(false)
    expect(canShowAdminConsoleLink({ role: "user", status: "approved", sessionVerified: true, canAccessAdmin: false })).toBe(false)
  })

  it("displays only for an approved, server-verified administrator with access", () => {
    expect(canShowAdminConsoleLink({ role: "user", status: "approved", sessionVerified: true, canAccessAdmin: true })).toBe(true)
    expect(canShowAdminConsoleLink({ role: "user", status: "pending", sessionVerified: true, canAccessAdmin: true })).toBe(false)
    expect(canShowAdminConsoleLink({ role: "user", status: "rejected", sessionVerified: true, canAccessAdmin: true })).toBe(false)
    expect(canShowAdminConsoleLink({ role: "user", status: "approved", sessionVerified: false, canAccessAdmin: true })).toBe(false)
  })
})
