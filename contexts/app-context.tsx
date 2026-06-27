"use client"

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
import { updateSrsFromHistory } from "@/lib/srs"

export type UserRole = "guest" | "user"

export interface AppUser {
  uid: string
  name: string
  role: UserRole
  status?: string
  indexNumber?: string
  level?: string
}

interface AppContextValue {
  user: AppUser | null
  authReady: boolean
  cloudEnabled: boolean
  requiresPasswordUpdate: boolean
  progress: UserProgress
  enterApp: (name: string) => Promise<void>
  loginUser: (indexNumber: string, password: string) => Promise<{ ok: boolean; error?: string }>
  registerUser: (name: string, level: string, indexNumber: string, password: string) => Promise<{ ok: boolean; error?: string; status?: string }>
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>
  signOutUser: () => void
  updateName: (name: string) => Promise<void>
  toggleFlag: (questionId: string) => void
  recordHistory: (entries: HistoryEntry[]) => void
  saveExamScore: (score: ExamScore) => void
  markNotificationsRead: () => void
  toggleMuteNotificationType: (type: string) => void
  toggleFavoriteModule: (module: string) => void
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
  favoriteModules: [],
  srsData: {},
}

const LS_UID = "mednexus-uid"
const LS_NAME = "mednexus-name"
const LS_ROLE = "mednexus-role"
const LS_STATUS = "mednexus-status"
const LS_PROGRESS = "mednexus-progress"
const LS_REQUIRES_PW_UPDATE = "mednexus-requires-pw-update"

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
  const [requiresPasswordUpdate, setRequiresPasswordUpdate] = useState(false)
  const [progress, setProgress] = useState<UserProgress>(EMPTY_PROGRESS)

  const userRef = useRef(user)
  userRef.current = user
  const progressRef = useRef(progress)
  progressRef.current = progress
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleSync = useCallback((uid: string, name: string, next: UserProgress) => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    syncTimer.current = setTimeout(() => {
      apiPost(uid, name, next).then((ok) => {
        if (ok) setCloudEnabled(true)
      })
    }, 1500)
  }, [])

  useEffect(() => {
    async function init() {
      const uid = typeof window !== "undefined" ? localStorage.getItem(LS_UID) : null
      const name = typeof window !== "undefined" ? localStorage.getItem(LS_NAME) ?? "Clinician" : "Clinician"
      const role = (typeof window !== "undefined" ? localStorage.getItem(LS_ROLE) : null) as UserRole | null
      const status = typeof window !== "undefined" ? localStorage.getItem(LS_STATUS) ?? undefined : undefined
      const needsPwUpdate = typeof window !== "undefined" ? localStorage.getItem(LS_REQUIRES_PW_UPDATE) === "true" : false

      if (uid) {
        const local = loadLocal(uid)
        const appUser: AppUser = { uid, name, role: role ?? "guest", status: status ?? undefined }
        setUser(appUser)
        setProgress(local)
        setRequiresPasswordUpdate(needsPwUpdate)
        setAuthReady(true)

        const remote = await apiGet(uid)
        if (remote) {
          setCloudEnabled(true)
          setProgress(remote.progress)
          setUser({ uid, name: remote.name, role: role ?? "guest" })
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
      localStorage.setItem(LS_ROLE, "guest")
      localStorage.removeItem(LS_REQUIRES_PW_UPDATE)
    } catch {}
    const appUser: AppUser = { uid, name: trimmed, role: "guest" }
    setUser(appUser)
    setProgress(EMPTY_PROGRESS)
    setRequiresPasswordUpdate(false)
    const ok = await apiPost(uid, trimmed, EMPTY_PROGRESS)
    if (ok) setCloudEnabled(true)
  }, [])

  const loginUser = useCallback(async (indexNumber: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ indexNumber, password }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error ?? "Login failed" }

      const { uid, name, requiresPasswordUpdate: needsPw } = data
      try {
        localStorage.setItem(LS_UID, uid)
        localStorage.setItem(LS_NAME, name)
        localStorage.setItem(LS_ROLE, "user")
        localStorage.setItem(LS_REQUIRES_PW_UPDATE, needsPw ? "true" : "false")
        if (data.status) localStorage.setItem(LS_STATUS, data.status)
      } catch {}

      const local = loadLocal(uid)
      const appUser: AppUser = { uid, name, role: "user", status: data.status, indexNumber: data.indexNumber, level: data.level }
      setUser(appUser)
      setProgress(local)
      setRequiresPasswordUpdate(!!needsPw)
      setCloudEnabled(false)

      const remote = await apiGet(uid)
      if (remote) {
        setCloudEnabled(true)
        setProgress(remote.progress)
      }

      return { ok: true }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [])

  const registerUser = useCallback(async (name: string, level: string, indexNumber: string, password: string) => {
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, level, indexNumber, password }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      return { ok: true, status: data.status }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [])

  const updatePassword = useCallback(async (newPassword: string) => {
    const uid = userRef.current?.uid
    if (!uid) return { ok: false, error: "Not logged in" }
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      setRequiresPasswordUpdate(false)
      try { localStorage.setItem(LS_REQUIRES_PW_UPDATE, "false") } catch {}
      return { ok: true }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [])

  const signOutUser = useCallback(() => {
    if (syncTimer.current) clearTimeout(syncTimer.current)
    try {
      localStorage.removeItem(LS_UID)
      localStorage.removeItem(LS_NAME)
      localStorage.removeItem(LS_ROLE)
      localStorage.removeItem(LS_STATUS)
      localStorage.removeItem(LS_REQUIRES_PW_UPDATE)
    } catch {}
    setUser(null)
    setProgress(EMPTY_PROGRESS)
    setCloudEnabled(false)
    setRequiresPasswordUpdate(false)
  }, [])

  const updateName = useCallback(async (name: string) => {
    const trimmed = name.trim() || "Clinician"
    const u = userRef.current
    if (!u) return
    try { localStorage.setItem(LS_NAME, trimmed) } catch {}
    const updated = { ...u, name: trimmed }
    setUser(updated)
    await apiPost(u.uid, trimmed, progressRef.current)
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
        if (u) { saveLocal(u.uid, next); scheduleSync(u.uid, u.name, next) }
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
          srsData: updateSrsFromHistory(prev.srsData ?? {}, entries),
        }
        const u = userRef.current
        if (u) { saveLocal(u.uid, next); scheduleSync(u.uid, u.name, next) }
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
        if (u) { saveLocal(u.uid, next); scheduleSync(u.uid, u.name, next) }
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
      if (u) { saveLocal(u.uid, next); scheduleSync(u.uid, u.name, next) }
      return next
    })
  }, [scheduleSync])

  const toggleMuteNotificationType = useCallback((type: string) => {
    setProgress((prev) => {
      const muted = prev.mutedNotificationTypes ?? []
      const next: UserProgress = {
        ...prev,
        mutedNotificationTypes: muted.includes(type) ? muted.filter((t) => t !== type) : [...muted, type],
      }
      const u = userRef.current
      if (u) { saveLocal(u.uid, next); scheduleSync(u.uid, u.name, next) }
      return next
    })
  }, [scheduleSync])

  const toggleFavoriteModule = useCallback((module: string) => {
    setProgress((prev) => {
      const favs = prev.favoriteModules ?? []
      const next: UserProgress = {
        ...prev,
        favoriteModules: favs.includes(module) ? favs.filter((m) => m !== module) : [...favs, module],
      }
      const u = userRef.current
      if (u) { saveLocal(u.uid, next); scheduleSync(u.uid, u.name, next) }
      return next
    })
  }, [scheduleSync])

  const value: AppContextValue = {
    user,
    authReady,
    cloudEnabled,
    requiresPasswordUpdate,
    progress,
    enterApp,
    loginUser,
    registerUser,
    updatePassword,
    signOutUser,
    updateName,
    toggleFlag,
    recordHistory,
    saveExamScore,
    markNotificationsRead,
    toggleMuteNotificationType,
    toggleFavoriteModule,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
