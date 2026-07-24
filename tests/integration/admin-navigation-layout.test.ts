import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const adminShellPath = new URL("../../components/admin-shell.tsx", import.meta.url)

describe("admin navigation layout", () => {
  it("keeps every navigation item reachable through an independently scrollable short-viewport body", async () => {
    const source = await readFile(adminShellPath, "utf8")

    expect(source).toContain('data-testid="admin-navigation-scroll-region" className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"')
    expect(source).toMatch(/admin-navigation-scroll-region[^>]*>\s*\{navigation\}/)
    expect(source).toMatch(/mb-8 flex shrink-0 items-center justify-between/)
    expect(source).toMatch(/mt-5 shrink-0 rounded-lg[^>]*>← Return to Learner Workspace<\/Link>/)
  })
})
