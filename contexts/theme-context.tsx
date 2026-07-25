"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { DEFAULT_THEME, type ThemeId } from "@/lib/themes"

const STORAGE_KEY = "mednexus-theme"
const GLASS_STORAGE_KEY = "mednexus-glass"

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

    const storedTheme = localStorage.getItem(STORAGE_KEY)
    const storedGlass = localStorage.getItem(GLASS_STORAGE_KEY)

    if (storedTheme && LEGACY_GLASS_THEMES.includes(storedTheme)) {
      // Migrate: old liquid-glass theme → default color theme + glass ON
      setThemeState(DEFAULT_THEME)
      setGlassState(true)
      localStorage.setItem(STORAGE_KEY, DEFAULT_THEME)
      localStorage.setItem(GLASS_STORAGE_KEY, "true")
    } else if (storedTheme) {
      setThemeState(storedTheme as ThemeId)
      setGlassState(storedGlass === "true")
    } else {
      setGlassState(storedGlass === "true")
    }
  }, [])

  // ── Apply activeTheme to <html data-theme="…"> ────────────────────────────
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", activeTheme)
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
