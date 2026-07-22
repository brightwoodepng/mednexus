"use client"

/** Route-aware top-level study hub selection. */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import type { StudyMode } from "@/lib/types"
import { getStudyHubByMode, getStudyHubFromPathname } from "@/lib/study-hubs"

interface CurrentStudyModeContextValue {
  currentStudyMode: StudyMode
  /** Selects an available hub and performs client-side navigation. */
  setCurrentStudyMode: (mode: StudyMode) => void
}
const CurrentStudyModeContext = createContext<CurrentStudyModeContextValue | undefined>(undefined)
const LS_KEY = "mednexus-current-study-mode"

export function CurrentStudyModeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [currentStudyMode, setCurrentStudyModeState] = useState<StudyMode>(() => getStudyHubFromPathname(pathname).mode)

  // The URL is authoritative: deep links and browser navigation always win.
  useEffect(() => {
    const routeHub = getStudyHubFromPathname(pathname)
    setCurrentStudyModeState(routeHub.mode)
    if (routeHub.availability === "available") {
      try { localStorage.setItem(LS_KEY, routeHub.mode) } catch {}
    }
  }, [pathname])

  // Restore a valid last hub only when entering the neutral MCQ landing route.
  useEffect(() => {
    if (pathname !== "/") return
    try {
      const stored = localStorage.getItem(LS_KEY) as StudyMode | null
      const hub = stored ? getStudyHubByMode(stored) : null
      if (hub?.availability === "available" && hub.mode !== "MCQ") router.replace(hub.landingRoute)
    } catch {}
  }, [pathname, router])

  const setCurrentStudyMode = useCallback((mode: StudyMode) => {
    const hub = getStudyHubByMode(mode)
    if (hub.availability !== "available") return
    setCurrentStudyModeState(mode)
    try { localStorage.setItem(LS_KEY, mode) } catch {}
    router.push(hub.landingRoute)
  }, [router])

  return <CurrentStudyModeContext.Provider value={{ currentStudyMode, setCurrentStudyMode }}>{children}</CurrentStudyModeContext.Provider>
}

export function useCurrentStudyMode(): CurrentStudyModeContextValue {
  const ctx = useContext(CurrentStudyModeContext)
  if (!ctx) throw new Error("useCurrentStudyMode must be used within CurrentStudyModeProvider")
  return ctx
}
