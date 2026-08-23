import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("System Settings reliability", () => {
  it("uses a focused schema preflight and specific diagnostics", async () => {
    const [route, settings] = await Promise.all([
      readFile(new URL("../../app/api/admin/settings/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../../lib/platform-settings.ts", import.meta.url), "utf8"),
    ])
    expect(route).toContain("assertSystemSettingsSchema(pool)")
    expect(route).not.toContain("ensureSchema()")
    expect(route).toContain("SYSTEM_SETTINGS_SCHEMA_NOT_READY")
    expect(route).toContain("DATABASE_UNREACHABLE")
    expect(route).not.toContain("Retry after checking the database connection")
    expect(settings).toContain("to_regclass('public.' || name)")
  })
})
