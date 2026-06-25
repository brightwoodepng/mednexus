"use client"

// ============================================================================
// MedNexus — App Context
// Uses Replit PostgreSQL for cloud storage (via /api/sync).
// Falls back to localStorage if the API is unavailable.
// ============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react"
import type { HistoryEntry, UserProgress, ExamScore } from "@/lib/types"

interface AppUser {
  uid: string
  name: string
}

interface AppContextValue {
  user: AppUser | null
  authReady: boolean
  cloudEnabled: boolean
  progress: UserProgress
  enterApp: (name: string) => Promise<void>
  signOutUser: () => void
  toggleFlag: (questionId: string) => void
  recordHistory: (entries: HistoryEntry[]) => void
  saveExamScore: (score: ExamScore) => void
  markNotificationsRead: () => void
  toggleMuteNotificationType: (type: string) => void
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

const EMPTY_PROGRESS: UserProgress = {
  totalAnswered: 0,
  totalCorrect: 0,
  flaggedQuestionIds: [],
  streak: 0,
  lastStudyDate: null,
  history: [],
  examScores: [],
  notificationsLastRead: 0,
  mutedNotificationTypes: [],
}

const LS_UID = "mednexus-uid"
const LS_NAME = "mednexus-name"
const LS_PROGRESS = "mednexus-progress"

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function nextStreak(progress: UserProgress): number {
  const today = todayStr()
  if (progress.lastStudyDate === today) return progress.streak || 1
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (progress.lastStudyDate === yesterday) return (progress.streak || 0) + 1
  return 1
}

function saveLocal(uid: string, progress: UserProgress) {
  try {
    localStorage.setItem(LS_PROGRESS + "-" + uid, JSON.stringify(progress))
  } catch {}
}

function loadLocal(uid: string): UserProgress {
  try {
    const raw = localStorage.getItem(LS_PROGRESS + "-" + uid)
    if (raw) return { ...EMPTY_PROGRESS, ...JSON.parse(raw) }
  } catch {}
  return EMPTY_PROGRESS
}

async function apiGet(uid: string): Promise<{ name: string; progress: UserProgress } | null> {
  try {
    const res = await fetch(`/api/sync?uid=${encodeURIComponent(uid)}`, {
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return { name: data.name, progress: { ...EMPTY_PROGRESS, ...data.progress } }
  } catch {
    return null
  }
}

async function apiPost(uid: string, name: string, progress: UserProgress): Promise<boolean> {
  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, name, progress }),
      signal: AbortSignal.timeout(6000),
    })
    return res.ok
  } catch {
    return false
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [cloudEnabled, setCloudEnabled] = useState(false)
  const [progress, setProgress] = useState<UserProgress>(EMPTY_PROGRESS)

  const userRef = useRef(user)
  userRef.current = user
  const progressRef = useRef(progress)
  progressRef.current = progress
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced cloud sync — fires 1.5s after the last progress change.
  const scheduleSync = useCallback((uid: string, name: string, next: UserProgress) => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      apiPost(uid, name, next).then((ok) => {
        if (ok) setCloudEnabled(true)
      })
    }, 1500)
  }, [])

  // Bootstrap: restore session from localStorage, then hydrate from cloud.
  useEffect(() => {
    async function init() {
      const uid = typeof window !== "undefined" ? localStorage.getItem(LS_UID) : null
      const name = typeof window !== "undefined" ? localStorage.getItem(LS_NAME) ?? "Clinician" : "Clinician"

      if (uid) {
        const local = loadLocal(uid)
        const appUser: AppUser = { uid, name }
        setUser(appUser)
        setProgress(local) // show local data immediately
        setAuthReady(true)

        // Then try to hydrate from cloud (may be richer / newer)
        const remote = await apiGet(uid)
        if (remote) {
          setCloudEnabled(true)
          setProgress(remote.progress)
          setUser({ uid, name: remote.name })
        }
      } else {
        setAuthReady(true)
      }
    }
    init()
  }, [])

  const enterApp = useCallback(async (name: string) => {
    const uid = crypto.randomUUID()
    const trimmed = name.trim() || "Clinician"

    try {
      localStorage.setItem(LS_UID, uid)
      localStorage.setItem(LS_NAME, trimmed)
    } catch {}

    const appUser: AppUser = { uid, name: trimmed }
    setUser(appUser)
    setProgress(EMPTY_PROGRESS)

    // Create the user record in the cloud.
    const ok = await apiPost(uid, trimmed, EMPTY_PROGRESS)
    if (ok) setCloudEnabled(true)
  }, [])

  const signOutUser = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    try {
      localStorage.removeItem(LS_UID)
      localStorage.removeItem(LS_NAME)
    } catch {}
    setUser(null)
    setProgress(EMPTY_PROGRESS)
    setCloudEnabled(false)
  }, [])

  const toggleFlag = useCallback(
    (questionId: string) => {
      setProgress((prev) => {
        const has = prev.flaggedQuestionIds.includes(questionId)
        const flaggedQuestionIds = has
          ? prev.flaggedQuestionIds.filter((id) => id !== questionId)
          : [...prev.flaggedQuestionIds, questionId]
        const next = { ...prev, flaggedQuestionIds }
        const u = userRef.current
        if (u) {
          saveLocal(u.uid, next)
          scheduleSync(u.uid, u.name, next)
        }
        return next
      })
    },
    [scheduleSync],
  )

  const recordHistory = useCallback(
    (entries: HistoryEntry[]) => {
      if (entries.length === 0) return
      setProgress((prev) => {
        const answered = entries.filter((e) => e.selectedOption !== null)
        const correct = entries.filter((e) => e.isCorrect).length
        const next: UserProgress = {
          ...prev,
          totalAnswered: prev.totalAnswered + answered.length,
          totalCorrect: prev.totalCorrect + correct,
          streak: nextStreak(prev),
          lastStudyDate: todayStr(),
          history: [...entries, ...prev.history].slice(0, 500),
        }
        const u = userRef.current
        if (u) {
          saveLocal(u.uid, next)
          scheduleSync(u.uid, u.name, next)
        }
        return next
      })
    },
    [scheduleSync],
  )

  const saveExamScore = useCallback(
    (score: ExamScore) => {
      setProgress((prev) => {
        const next: UserProgress = {
          ...prev,
          examScores: [score, ...(prev.examScores ?? [])].slice(0, 100),
        }
        const u = userRef.current
        if (u) {
          saveLocal(u.uid, next)
          scheduleSync(u.uid, u.name, next)
        }
        return next
      })
    },
    [scheduleSync],
  )

  const markNotificationsRead = useCallback(() => {
    setProgress((prev) => {
      const now = Date.now()
      const next: UserProgress = { ...prev, notificationsLastRead: now }
      const u = userRef.current
      if (u) {
        saveLocal(u.uid, next)
        scheduleSync(u.uid, u.name, next)
      }
      return next
    })
  }, [scheduleSync])

  const toggleMuteNotificationType = useCallback((type: string) => {
    setProgress((prev) => {
      const muted = prev.mutedNotificationTypes ?? []
      const next: UserProgress = {
        ...prev,
        mutedNotificationTypes: muted.includes(type)
          ? muted.filter((t) => t !== type)
          : [...muted, type],
      }
      const u = userRef.current
      if (u) {
        saveLocal(u.uid, next)
        scheduleSync(u.uid, u.name, next)
      }
      return next
    })
  }, [scheduleSync])

  const value: AppContextValue = {
    user,
    authReady,
    cloudEnabled,
    progress,
    enterApp,
    signOutUser,
    toggleFlag,
    recordHistory,
    saveExamScore,
    markNotificationsRead,
    toggleMuteNotificationType,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
