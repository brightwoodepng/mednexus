import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8")
const usersUi = read("components/admin-user-management.tsx")
const usersApi = read("app/api/admin/users/route.ts")
const userApi = read("app/api/admin/users/[uid]/route.ts")
const rolesUi = read("components/role-management.tsx")
const rolesApi = read("app/api/admin/roles/route.ts")

describe("admin students and roles", () => {
  it("shows global account states and useful activity summaries", () => {
    for (const text of ["counts.suspended", "last_login_date", "assessment_attempts", "theory_attempts", "Retry"]) expect(usersUi).toContain(text)
    expect(usersApi).toContain("global_counts")
    expect(usersApi).toContain("last_login_date")
  })

  it("supports protected profile, suspension, reactivation, OTP, and deletion flows", () => {
    for (const action of ['action === "edit-profile"', 'action === "suspend"', 'action === "reactivate"', 'action === "reset-password"']) expect(userApi).toContain(action)
    expect(userApi).toContain("23505")
    expect(userApi).toContain('actor.role !== "SUPER_ADMIN"')
    expect(usersUi).toContain("Permanently delete")
    expect(usersUi).toContain("One-Time Password")
  })

  it("stages effective permission changes and confirms once", () => {
    for (const text of ["Effective permissions", "Unsaved access changes", "Confirm changes", "Baseline: on", "Override: granted"]) expect(rolesUi).toContain(text)
    expect(rolesApi).toContain("baselines")
    expect(rolesApi).toContain("final remaining SUPER_ADMIN")
    expect(rolesApi).toContain("ROLE_CHANGE")
    expect(rolesApi).toContain("PERMISSION_CHANGE")
  })
})
