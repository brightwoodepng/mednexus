"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { DEFAULT_THEME, type ThemeId } from "@/lib/themes"

const STORAGE_KEY = "mednexus-theme"
const GLASS_STORAGE_KEY = "mednexus-glass"

// Legacy liquid-glass theme IDs that may be in localStorage from before this was a toggle
const LEGACY_GLASS_THEMES = ["liquid-glass-light", "liquid-glass-dark"]

interface ThemeContextValue {
  theme: ThemeId
  setTheme: (theme: ThemeId) => void
  glassEnabled: boolean
  setGlassEnabled: (enabled: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME)
  const [glassEnabled, setGlassState] = useState(false)

  // Load persisted preferences on mount (with legacy migration)
  useEffect(() => {
    if (typeof window === "undefined") return

    const storedTheme = localStorage.getItem(STORAGE_KEY)
    const storedGlass = localStorage.getItem(GLASS_STORAGE_KEY)

    if (storedTheme && LEGACY_GLASS_THEMES.includes(storedTheme)) {
      // Migrate: was using liquid-glass theme → switch to default + enable glass
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

  // Apply theme + glass attributes to <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
  }, [theme])

  useEffect(() => {
    if (glassEnabled) {
      document.documentElement.setAttribute("data-glass", "true")
    } else {
      document.documentElement.removeAttribute("data-glass")
    }
  }, [glassEnabled])

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  }, [])

  const setGlassEnabled = useCallback((enabled: boolean) => {
    setGlassState(enabled)
    try { localStorage.setItem(GLASS_STORAGE_KEY, String(enabled)) } catch {}
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, glassEnabled, setGlassEnabled }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}
