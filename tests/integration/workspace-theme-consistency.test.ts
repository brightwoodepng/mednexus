import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const adminShellPath = new URL("../../components/admin-shell.tsx", import.meta.url)
const themeContextPath = new URL("../../contexts/theme-context.tsx", import.meta.url)
const themeModalPath = new URL("../../components/appearance-modal.tsx", import.meta.url)
const rootLayoutPath = new URL("../../app/layout.tsx", import.meta.url)

describe("workspace theme consistency", () => {
  it("uses the learner appearance state in the admin workspace and preserves it after refresh", async () => {
    const [adminShell, themeContext, themeModal, rootLayout] = await Promise.all([
      readFile(adminShellPath, "utf8"),
      readFile(themeContextPath, "utf8"),
      readFile(themeModalPath, "utf8"),
      readFile(rootLayoutPath, "utf8"),
    ])

    // Both / and /admin are children of the one root ThemeProvider, so client
    // navigation retains this shared state instead of mounting an admin-only copy.
    expect(rootLayout).toContain("<WorkspaceProviders>{children}</WorkspaceProviders>")
    expect(adminShell).toContain('import { useTheme } from "@/contexts/theme-context"')
    expect(adminShell).toContain('import { AppearanceModal } from "@/components/appearance-modal"')
    expect(adminShell).toMatch(/<AppearanceModal open=\{themeModalOpen\} onClose=\{\(\) => setThemeModalOpen\(false\)\} \/>/)
    expect(adminShell).toContain('aria-label="Appearance"')
    expect(adminShell).not.toContain("admin-dark")
    expect(adminShell).not.toContain("useDarkMode")

    // The modal changes the exact activeTheme and Liquid Glass setters used by
    // the provider, which rehydrates and reapplies both document attributes.
    expect(themeModal).toMatch(/const \{ activeTheme, setActiveTheme, isGlassEnabled, setIsGlassEnabled \} =\s*useTheme\(\)/)
    expect(themeContext).toContain('const STORAGE_KEY = "mednexus-theme"')
    expect(themeContext).toContain('const GLASS_STORAGE_KEY = "mednexus-glass"')
    expect(themeContext).toMatch(/localStorage\.getItem\(STORAGE_KEY\)[\s\S]*?localStorage\.getItem\(GLASS_STORAGE_KEY\)/)
    expect(themeContext).toMatch(/document\.documentElement\.setAttribute\("data-theme", activeTheme\)/)
    expect(themeContext).toMatch(/document\.documentElement\.setAttribute\("data-glass", "true"\)/)
  })
})
