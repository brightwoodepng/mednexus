import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("notification overlay navigation", () => {
  it("closes the notification overlay before learner navigation", async () => {
    const shell = await readFile("components/learner-workspace-shell.tsx", "utf8")
    const navigate = shell.match(/const navigate = \(next: Screen\) => \{([\s\S]*?)\n  \}/)?.[1] ?? ""

    expect(navigate).toContain("setNotificationOpen(false)")
    expect(navigate).toContain("onNavigate(next)")
    expect(navigate.indexOf("setNotificationOpen(false)")).toBeLessThan(navigate.indexOf("onNavigate(next)"))
    expect(shell).toContain("<BottomNav screen={screen} activeHub={activeStudyHub} onNavigate={navigate}")
  })
})
