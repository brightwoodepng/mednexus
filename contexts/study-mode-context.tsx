"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type GlobalMode = "trial" | "exam"

interface StudyModeContextValue {
  globalMode: GlobalMode
  setGlobalMode: (mode: GlobalMode) => void
  toggleMode: () => void
}

const StudyModeContext = createContext<StudyModeContextValue | undefined>(undefined)

const LS_KEY = "mednexus-study-mode"

function loadMode(): GlobalMode {
  if (typeof window === "undefined") return "trial"
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === "trial" || v === "exam") return v
  } catch {}
  return "trial"
}

export function StudyModeProvider({ children }: { children: ReactNode }) {
  const [globalMode, setGlobalModeState] = useState<GlobalMode>(loadMode)

  const setGlobalMode = useCallback((mode: GlobalMode) => {
    setGlobalModeState(mode)
    try { localStorage.setItem(LS_KEY, mode) } catch {}
  }, [])

  const toggleMode = useCallback(() => {
    setGlobalModeState((prev) => {
      const next = prev === "trial" ? "exam" : "trial"
      try { localStorage.setItem(LS_KEY, next) } catch {}
      return next
    })
  }, [])

  return (
    <StudyModeContext.Provider value={{ globalMode, setGlobalMode, toggleMode }}>
      {children}
    </StudyModeContext.Provider>
  )
}

export function useStudyMode() {
  const ctx = useContext(StudyModeContext)
  if (!ctx) throw new Error("useStudyMode must be used within StudyModeProvider")
  return ctx
}
