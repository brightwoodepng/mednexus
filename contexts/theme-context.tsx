"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { DEFAULT_THEME, THEMES, THEME_DEFAULT_VERSION, resolveInitialTheme, type ThemeId } from "@/lib/themes"

const STORAGE_KEY = "mednexus-theme"
const GLASS_STORAGE_KEY = "mednexus-glass"
const DEFAULT_VERSION_KEY = "mednexus-theme-default-version"

// Legacy liquid-glass theme IDs that may be in localStorage from before this was a toggle
const LEGACY_GLASS_THEMES = ["liquid-glass-light", "liquid-glass-dark"]

interface ThemeContextValue {
  /** The active color theme ID (e.g. "clinical-light", "ocean-breeze", "midnight-purple"). */
  activeTheme: ThemeId
  setActiveTheme: (theme: ThemeId) => void
  /** Whether the Liquid Glass frosted-glass overlay is enabled. Independent of activeTheme. */
  isGlassEnabled: boolean
  setIsGlassEnabled: (enabled: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Two fully independent state variables — toggling one never touches the other.
  const [activeTheme, setThemeState] = useState<ThemeId>(DEFAULT_THEME)
  const [isGlassEnabled, setGlassState] = useState(false)

  // ── Hydrate from localStorage on first mount (with legacy migration) ────────
  useEffect(() => {
    if (typeof window === "undefined") return

    try {
      const storedTheme = localStorage.getItem(STORAGE_KEY)
      const storedGlass = localStorage.getItem(GLASS_STORAGE_KEY)
      const nextTheme = resolveInitialTheme(storedTheme, localStorage.getItem(DEFAULT_VERSION_KEY))
      setThemeState(nextTheme)
      const glass = Boolean(storedTheme && LEGACY_GLASS_THEMES.includes(storedTheme)) || storedGlass === "true"
      setGlassState(glass)
      // Write the theme first so interrupted migrations safely retry.
      localStorage.setItem(STORAGE_KEY, nextTheme)
      localStorage.setItem(DEFAULT_VERSION_KEY, THEME_DEFAULT_VERSION)
      if (storedTheme && LEGACY_GLASS_THEMES.includes(storedTheme)) localStorage.setItem(GLASS_STORAGE_KEY, "true")
    } catch { /* Deep Ocean remains the default when storage is unavailable. */ }
  }, [])

  // ── Apply activeTheme to <html data-theme="…"> ────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme)
    const dark = THEMES.find(theme => theme.id === activeTheme)?.mode === "dark"
    document.documentElement.classList.toggle("dark", dark)
    document.documentElement.setAttribute("data-mode", dark ? "dark" : "light")
  }, [activeTheme])

  // ── Apply isGlassEnabled to <html data-glass="true"> — independent effect ──
  useEffect(() => {
    if (isGlassEnabled) {
      document.documentElement.setAttribute("data-glass", "true")
    } else {
      document.documentElement.removeAttribute("data-glass")
    }
  }, [isGlassEnabled])

  // ── Stable setters — each persists its own key, never touches the other ────
  const setActiveTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }, [])

  const setIsGlassEnabled = useCallback((enabled: boolean) => {
    setGlassState(enabled)
    try { localStorage.setItem(GLASS_STORAGE_KEY, String(enabled)) } catch {}
  }, [])

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme, isGlassEnabled, setIsGlassEnabled }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hook to access appearance state from any component inside ThemeProvider.
 *
 * @example
 * const { activeTheme, setActiveTheme, isGlassEnabled, setIsGlassEnabled } = useTheme()
 */
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
