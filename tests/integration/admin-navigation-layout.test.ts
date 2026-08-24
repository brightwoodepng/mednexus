import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const adminShellPath = new URL("../../components/admin-shell.tsx", import.meta.url)

describe("admin navigation layout", () => {
  it("keeps every navigation item reachable through an independently scrollable short-viewport body", async () => {
    const source = await readFile(adminShellPath, "utf8")

    expect(source).toMatch(/data-testid="admin-navigation-scroll-region"[\s\S]*?className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"/)
    expect(source).toMatch(/admin-navigation-scroll-region[\s\S]*?>\s*\{navigation\}/)
    expect(source).toMatch(/mb-6 flex h-16 min-h-16 shrink-0 items-center justify-between/)
    expect(source).toMatch(/<header className="flex h-16 min-h-16/)
    expect(source).not.toContain("SidebarProfileFooter")
    expect(source).toContain('identity={identity}')
    expect(source).toContain("max-w-2xl")
    expect(source).toMatch(/href="\/"[\s\S]*?Learner View\s*<\/Link>/)
    expect(source).toContain("prefetch")
  })

  it("sends the labelled notification bell to the notifications console", async () => {
    const source = await readFile(adminShellPath, "utf8")

    expect(source).toMatch(/<Link\s+href="\/admin\/notifications"[\s\S]*?aria-label="Notifications"[\s\S]*?>\s*<Bell/)
    expect(source).not.toContain("pending approvals")
  })

  it("keeps the notifications route protected by the broadcasts capability", async () => {
    const notificationsPagePath = new URL("../../app/admin/notifications/page.tsx", import.meta.url)
    const source = await readFile(notificationsPagePath, "utf8")

    expect(source).toContain('getVerifiedAdminFromCookie("manage_broadcasts")')
    expect(source).toContain('redirect("/admin")')
  })
})
