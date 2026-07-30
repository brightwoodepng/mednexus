import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

describe("notification overlay bulk read regression", () => {
  it("uses at most one PATCH per non-empty feed instead of per-item fan-out", () => {
    const source = readFileSync("components/notification-overlay.tsx", "utf8")
    const bulkSection = source.slice(source.indexOf("const unreadBroadcasts"), source.indexOf("// Escape key closes"))

    expect(bulkSection).not.toMatch(/unreadBroadcasts\.map\s*\(/)
    expect(bulkSection).not.toMatch(/unreadPersonal\.map\s*\(/)
    expect(bulkSection.match(/fetch\("\/api\/notifications"/g)).toHaveLength(1)
    expect(bulkSection.match(/fetch\("\/api\/user-notifications"/g)).toHaveLength(1)
    expect(bulkSection).toContain("Promise.allSettled")
    expect(bulkSection).toContain("successfulSources.has(n.source)")
  })
})
