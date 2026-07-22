"use client"

/**
 * CurrentStudyModeContext — tracks which top-level study environment the user
 * is in: MCQ Q-Bank, Theory Vault, or OSCE (future).
 *
 * Separate from StudyModeContext (trial | exam), which lives one level below
 * and only applies inside the MCQ environment.
 *
 * Persisted to localStorage so the preference survives hard-refreshes.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import type { StudyMode } from "@/lib/types"

interface CurrentStudyModeContextValue {
  currentStudyMode: StudyMode
  setCurrentStudyMode: (mode: StudyMode) => void
}

const CurrentStudyModeContext = createContext<
  CurrentStudyModeContextValue | undefined
>(undefined)

const LS_KEY = "mednexus-current-study-mode"

function loadMode(): StudyMode {
  if (typeof window === "undefined") return "MCQ"
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === "MCQ" || v === "THEORY" || v === "OSCE") return v
  } catch {}
  return "MCQ"
}

export function CurrentStudyModeProvider({
  children,
}: {
  children: ReactNode
}) {
  const [currentStudyMode, setCurrentStudyModeState] =
    useState<StudyMode>(loadMode)

  const setCurrentStudyMode = useCallback((mode: StudyMode) => {
    setCurrentStudyModeState(mode)
    try {
      localStorage.setItem(LS_KEY, mode)
    } catch {}
  }, [])

  return (
    <CurrentStudyModeContext.Provider
      value={{ currentStudyMode, setCurrentStudyMode }}
    >
      {children}
    </CurrentStudyModeContext.Provider>
  )
}

export function useCurrentStudyMode(): CurrentStudyModeContextValue {
  const ctx = useContext(CurrentStudyModeContext)
  if (!ctx)
    throw new Error(
      "useCurrentStudyMode must be used within CurrentStudyModeProvider",
    )
  return ctx
}
