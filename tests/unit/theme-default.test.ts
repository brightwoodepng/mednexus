import { describe, expect, it } from "vitest"
import { DEFAULT_THEME, THEMES, THEME_DEFAULT_VERSION, resolveInitialTheme } from "@/lib/themes"

describe("Deep Ocean default rollout", () => {
  it("starts new browsers in the dark Deep Ocean theme", () => {
    expect(resolveInitialTheme(null, null)).toBe("deep-ocean")
    expect(THEMES.find(theme => theme.id === DEFAULT_THEME)?.mode).toBe("dark")
  })
  it("migrates every existing theme once", () => {
    for (const theme of THEMES) expect(resolveInitialTheme(theme.id, null)).toBe("deep-ocean")
    expect(resolveInitialTheme("liquid-glass-light", null)).toBe("deep-ocean")
  })
  it("preserves choices made after the rollout and recovers invalid settings", () => {
    expect(resolveInitialTheme("rose-quartz", THEME_DEFAULT_VERSION)).toBe("rose-quartz")
    expect(resolveInitialTheme("unknown", THEME_DEFAULT_VERSION)).toBe("deep-ocean")
  })
})
