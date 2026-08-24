import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (file: string) => readFileSync(file, "utf8")

describe("notification automations", () => {
  it("uses retry-safe personal events with learner actions", () => {
    const helper = read("lib/personal-notifications.ts")
    expect(helper).toContain("ON CONFLICT (id) DO NOTHING")
    expect(helper).toContain("action_url")
    expect(read("app/api/user-notifications/route.ts")).toContain("n.archived_at IS NULL")
    expect(read("components/notification-overlay.tsx")).toContain("actionUrl: r.actionUrl")
  })

  it("covers study, assessment and economy success events", () => {
    expect(read("app/api/group-study/[pin]/route.ts")).toContain("group-complete-")
    expect(read("app/api/group-study/[pin]/route.ts")).toContain("group-start-")
    expect(read("app/api/assessments/[id]/attempt/route.ts")).toContain("assessment-submit-")
    expect(read("app/api/assessments/[id]/route.ts")).toContain("assessment-live-")
    expect(read("app/api/economy/daily-login/route.ts")).toContain("daily-login-")
    expect(read("app/api/economy/store/route.ts")).toContain("Purchase confirmed:")
    expect(read("app/api/admin/economy-seasons/route.ts")).toContain("View rankings")
  })

  it("provides a manageable admin delivery history", () => {
    const ui = read("components/broadcast-screen.tsx")
    for (const value of ["Choose a template", "Custom internal path", "Search delivery history", "Save changes", "restore", "cancel"]) expect(ui).toContain(value)
    const api = read("app/api/notifications/route.ts")
    for (const value of ["archived_at", "scheduled_at>NOW()", "Sent notifications cannot be edited", "n.title ILIKE"]) expect(api).toContain(value)
  })
})
