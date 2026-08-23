import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("Group Study learner workspace", () => {
  it("keeps the shared learner sidebar on desktop room routes", async () => {
    const [home, room, shell, sidebar] = await Promise.all([
      readFile(new URL("../../app/group-study/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../app/group-study/[pin]/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../components/group-study/group-study-workspace-shell.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../components/sidebar.tsx", import.meta.url), "utf8"),
    ])
    expect(home).toContain("GroupStudyWorkspaceShell")
    expect(room).toContain("GroupStudyWorkspaceShell")
    expect(shell).toContain("md:flex md:h-screen")
    expect(shell).toContain("<Sidebar")
    expect(shell).toContain("mobileOpen={mobileNavigationOpen}")
    expect(shell).toContain('aria-label="Open navigation menu"')
    expect(home).not.toContain("MCQ dashboard")
    expect(sidebar).toContain('pathname.startsWith("/group-study")')
    expect(sidebar).toContain("active={!groupStudyActive && screen === item.screen}")
  })
})
