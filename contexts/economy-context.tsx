"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { type BountyDef, type StoreItem } from "@/lib/economy"
import type { DailyLoginResult } from "@/lib/anti-farming"
import { useApp } from "@/contexts/app-context"
import { multiplayerApi } from "@/lib/multiplayer-api"

export interface BountyWithProgress extends BountyDef {
  progress: number
  claimed: boolean
}
export interface WeeklyGoal {
  id: string
  type: "answers" | "accuracy" | "exam_dates"
  reward: number
  progress: number
  target: number
  completed: boolean
  credited: boolean
  minimumAnswers?: number
}

export interface EquippedCosmetics {
  title:     string | null
  frame:     string | null
  highlight: string | null
  avatar:    string | null
}

export interface PayoutResponse {
  earned: number
  newBalance: number
  isNewHigh: boolean
  breakdown: { label: string; amount: number }[]
  bountyUpdates: { id: string; progress: number; target: number; newlyComplete: boolean }[]
  wallet?: { balance: number; lifetimeEarned: number; rankPoints: number }
  bounties?: BountyWithProgress[]
  weeklyGoals?: WeeklyGoal[]
}

export interface EconomyContextValue {
  balance: number
  lifetimeEarned: number
  rankPoints: number
  bounties: BountyWithProgress[]
  weeklyGoals: WeeklyGoal[]
  inventory: Record<string, number>
  equippedCosmetics: EquippedCosmetics
  loading: boolean
  /** Non-null (and alreadyDone === false) on the first app open of a new calendar day */
  dailyLoginReward: DailyLoginResult | null
  clearDailyLoginReward: () => void
  refresh: () => Promise<void>
  claimBounty: (bountyId: string) => Promise<{ ok: boolean; earned?: number; error?: string }>
  purchase: (itemId: string, selection?: { quantity?: number; bundleId?: string }) => Promise<{ ok: boolean; error?: string; quantity?: number; balance?: number }>
  useItem: (itemId: string, usage: { sessionId: string; questionId: string }) => Promise<boolean>
  isItemUsePending: (itemId: string, questionId: string) => boolean
  isItemUsed: (itemId: string, questionId: string) => boolean
  equipCosmetic: (type: "title" | "frame" | "highlight" | "avatar", itemId: string | null) => Promise<{ ok: boolean; error?: string }>
  grantDevNP: () => Promise<{ ok: boolean; error?: string }>
  startScoredActivity: (mode: string, questionIds: string[]) => Promise<string | null>
  submitGameResult: (payload: {
    mode: string
    score: number
    correct: number
    total: number
    bestStreak: number
    isNewHigh: boolean
    survivedCount?: number
    lifelineUsed?: boolean
    sessionData?: { questionId: string; discipline: string; isCorrect: boolean; currentStreak?: number }[]
    examMeta?: { accuracy: number; correct: number; total: number; primaryDiscipline?: string }
    sessionId?: string
    answers?: Record<string, string | string[] | null>
    orderedAnswers?: Array<{ questionId: string; answer: string | string[] | null; firstAnswer?: string | string[] | null; secondAnswer?: string | string[] | null; assisted?: boolean }>
    completionReason?: string | null
    clientRoundStartedAt?: string
    clientRoundFinishedAt?: string
    selectedQuestionCount?: number
    answeredQuestionCount?: number
    freezeCount?: number
    wagerHistory?: number[]
  }) => Promise<PayoutResponse | null>
  submitMultiplayerResult: (
    pin: string,
    playerId: string,
    answers: Array<{ qi: number; answer: string }>,
  ) => Promise<PayoutResponse | null>
}

const EconomyContext = createContext<EconomyContextValue | undefined>(undefined)

const DEFAULT_COSMETICS: EquippedCosmetics = { title: null, frame: null, highlight: null, avatar: null }
type DailyLoginResponse = DailyLoginResult & { wallet: { balance: number; lifetimeEarned: number; rankPoints: number } }

function economyHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const guest = localStorage.getItem("mednexus-guest-token")
  const session = localStorage.getItem("mednexus-user-token")
  return session ? { "x-session-token": session } : guest ? { "x-guest-token": guest } : {}
}

export function EconomyProvider({ children }: { children: ReactNode }) {
  const { user } = useApp()
  const [balance, setBalance]                       = useState(0)
  const [lifetimeEarned, setLifetimeEarned]         = useState(0)
  const [rankPoints, setRankPoints]                 = useState(0)
  const [bounties, setBounties]                     = useState<BountyWithProgress[]>([])
  const [weeklyGoals, setWeeklyGoals]               = useState<WeeklyGoal[]>([])
  const [inventory, setInventory]                   = useState<Record<string, number>>({})
  const [pendingItemUses, setPendingItemUses]       = useState<Set<string>>(new Set())
  const [successfulItemUses, setSuccessfulItemUses] = useState<Set<string>>(new Set())
  const pendingItemUsesRef = useRef<Set<string>>(new Set())
  const [equippedCosmetics, setEquippedCosmetics]   = useState<EquippedCosmetics>(DEFAULT_COSMETICS)
  const [loading, setLoading]                       = useState(false)
  const [dailyLoginReward, setDailyLoginReward]     = useState<DailyLoginResult | null>(null)
  const initializedUserId = useRef<string | null>(null)

  const clearDailyLoginReward = useCallback(() => setDailyLoginReward(null), [])

  const refresh = useCallback(async () => {
    const uid = user?.uid
    if (!uid) return
    setLoading(true)
    try {
      const response = await fetch("/api/economy/bootstrap", { headers: economyHeaders() })
      if (!response.ok) throw new Error("Economy bootstrap failed")
      const data = await response.json()
      setBalance(data.wallet?.balance ?? 0)
      setLifetimeEarned(data.wallet?.lifetimeEarned ?? 0)
      setRankPoints(data.wallet?.rankPoints ?? 0)
      setBounties(data.bounties ?? [])
      setWeeklyGoals(data.weeklyGoals ?? [])
      setInventory(data.inventory ?? {})
      setEquippedCosmetics(data.equippedCosmetics ?? DEFAULT_COSMETICS)
    } catch {
      // silent — keep stale state
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (user?.uid && initializedUserId.current !== user.uid) {
      initializedUserId.current = user.uid
      refresh()

      // Fire daily login for registered users (not guests).
      // Idempotent — the server returns alreadyDone:true when called again today.
      const isRegistered = !user.uid.startsWith("guest")
      if (isRegistered) {
        fetch("/api/economy/daily-login", {
          method:  "POST",
          headers: { "Content-Type": "application/json", ...economyHeaders() },
          body:    JSON.stringify({ uid: user.uid }),
        })
          .then((r) => r.json())
          .then((data: DailyLoginResponse) => {
            if (!data.alreadyDone && data.earned > 0) {
              setBalance(data.wallet.balance)
              setLifetimeEarned(data.wallet.lifetimeEarned)
              setRankPoints(data.wallet.rankPoints)
              setDailyLoginReward(data)
            }
          })
          .catch(() => { /* silent — non-critical */ })
      }
    } else if (!user?.uid) {
      initializedUserId.current = null
    }
  }, [user?.uid, refresh])

  const claimBounty = useCallback(async (bountyId: string) => {
    const uid = user?.uid
    if (!uid) return { ok: false, error: "Not logged in" }
    try {
      const res = await fetch("/api/economy/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({ uid, bountyId }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      setBalance(data.wallet.balance)
      setLifetimeEarned(data.wallet.lifetimeEarned)
      setRankPoints(data.wallet.rankPoints)
      setBounties(data.bounties)
      return { ok: true, earned: data.earned }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [user?.uid])

  const purchase = useCallback(async (itemId: string, selection: { quantity?: number; bundleId?: string } = {}) => {
    const uid = user?.uid
    if (!uid) return { ok: false, error: "Not logged in" }
    try {
      const res = await fetch("/api/economy/store", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({ uid, itemId, ...selection }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      setBalance(data.wallet.balance)
      setLifetimeEarned(data.wallet.lifetimeEarned)
      setRankPoints(data.wallet.rankPoints)
      setInventory(previous => ({ ...previous, ...data.inventory }))
      return { ok: true, quantity: data.inventory[itemId], balance: data.wallet.balance }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [user?.uid])

  const useItem = useCallback(async (itemId: string, usage: { sessionId: string; questionId: string }) => {
    const uid = user?.uid
    if (!uid) return false
    const usageKey = `${itemId}:${usage.questionId}`
    if (pendingItemUsesRef.current.has(usageKey)) return false
    const usageId = crypto.randomUUID()
    pendingItemUsesRef.current.add(usageKey)
    setPendingItemUses(previous => new Set(previous).add(usageKey))
    try {
      const request = () => fetch("/api/economy/inventory", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...economyHeaders() },
          body: JSON.stringify({ uid, itemId, usageId, ...usage }),
        })
      // A transport-level retry reuses this activation's usageId, allowing the
      // server to replay its committed result without another decrement.
      let res: Response
      try { res = await request() } catch { res = await request() }
      const data = await res.json()
      if (!res.ok) {
        if (data.usageStatus === "already_used") {
          setSuccessfulItemUses(previous => new Set(previous).add(usageKey))
          if (typeof data.quantity === "number") {
            setInventory(previous => ({ ...previous, [itemId]: data.quantity }))
          }
        }
        return false
      }
      setInventory(prev => {
        const quantity = data.quantity
        if (quantity <= 0) {
          const next = { ...prev }
          delete next[itemId]
          return next
        }
        return { ...prev, [itemId]: quantity }
      })
      setSuccessfulItemUses(previous => new Set(previous).add(usageKey))
      return true
    } catch {
      return false
    } finally {
      pendingItemUsesRef.current.delete(usageKey)
      setPendingItemUses(previous => {
        const next = new Set(previous)
        next.delete(usageKey)
        return next
      })
    }
  }, [user?.uid])

  const isItemUsePending = useCallback((itemId: string, questionId: string) =>
    pendingItemUses.has(`${itemId}:${questionId}`), [pendingItemUses])
  const isItemUsed = useCallback((itemId: string, questionId: string) =>
    successfulItemUses.has(`${itemId}:${questionId}`), [successfulItemUses])

  const equipCosmetic = useCallback(async (
    type: "title" | "frame" | "highlight" | "avatar",
    itemId: string | null
  ) => {
    const uid = user?.uid
    if (!uid) return { ok: false, error: "Not logged in" }
    try {
      const res = await fetch("/api/economy/cosmetics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({ uid, type, itemId }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      setEquippedCosmetics(data.equippedCosmetics)
      return { ok: true }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [user?.uid])

  const grantDevNP = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const uid = user?.uid
    if (!uid) return { ok: false, error: "No uid" }
    const target = 999_999
    // Optimistic: update UI instantly so the header reflects 999,999 immediately
    setBalance(target)
    try {
      const res = await fetch("/api/economy/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({ uid, balance: target }),
      })
      const data = await res.json()
      if (!res.ok) {
        // DB write failed — revert to whatever the server says the real balance is
        setBalance(data.balance ?? 0)
        return { ok: false, error: data.error ?? "Server error" }
      }
      // Confirm with the value the DB echoed back
      setBalance(data.balance ?? target)
      setLifetimeEarned(data.lifetimeEarned ?? lifetimeEarned)
      setRankPoints(data.rankPoints ?? rankPoints)
      return { ok: true }
    } catch (e) {
      // Network failure — revert by re-fetching the real balance
      fetch(`/api/economy/wallet?uid=${encodeURIComponent(uid)}`)
        .then(r => r.json())
        .then(d => { if (typeof d.balance === "number") setBalance(d.balance) })
        .catch(() => {/* silent */})
      return { ok: false, error: String(e) }
    }
  }, [user?.uid, lifetimeEarned, rankPoints])

  const startScoredActivity = useCallback(async (mode: string, questionIds: string[]) => {
    if (!user?.uid) return null
    try {
      const res = await fetch("/api/economy/session", { method: "POST", headers: { "Content-Type": "application/json", ...economyHeaders() }, body: JSON.stringify({ uid: user.uid, mode, questionIds }) })
      if (!res.ok) return null
      const sessionId = (await res.json()).sessionId ?? null
      if (sessionId) {
        pendingItemUsesRef.current.clear()
        setPendingItemUses(new Set())
        setSuccessfulItemUses(new Set())
      }
      return sessionId
    } catch { return null }
  }, [user?.uid])

  const submitGameResult = useCallback(async (payload: {
    mode: string; score: number; correct: number; total: number
    bestStreak: number; isNewHigh: boolean; survivedCount?: number
    lifelineUsed?: boolean
    /** Per-question anti-farming data */
    sessionData?: { questionId: string; discipline: string; isCorrect: boolean; currentStreak?: number }[]
    /** Exam-mode bounty metadata */
    examMeta?: { accuracy: number; correct: number; total: number; primaryDiscipline?: string }
    sessionId?: string
    answers?: Record<string, string | string[] | null>
    orderedAnswers?: Array<{ questionId: string; answer: string | string[] | null; firstAnswer?: string | string[] | null; secondAnswer?: string | string[] | null; assisted?: boolean }>
    completionReason?: string | null
    clientRoundStartedAt?: string
    clientRoundFinishedAt?: string
    selectedQuestionCount?: number
    answeredQuestionCount?: number
    freezeCount?: number
    wagerHistory?: number[]
  }) => {
    const uid = user?.uid
    if (!uid) return null
    try {
      if (!payload.sessionId || !payload.answers) return null
      const completion = await fetch("/api/economy/session", {
        method: "PATCH", headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({
          sessionId: payload.sessionId,
          uid,
          answers: payload.answers,
          orderedAnswers: payload.orderedAnswers,
          resultMeta: {
            lifelineUsed: payload.lifelineUsed === true,
            completionReason: payload.completionReason,
            clientRoundStartedAt: payload.clientRoundStartedAt,
            clientRoundFinishedAt: payload.clientRoundFinishedAt,
            selectedQuestionCount: payload.selectedQuestionCount,
            answeredQuestionCount: payload.answeredQuestionCount,
            freezeCount: payload.freezeCount,
            wagerHistory: payload.wagerHistory,
          },
        }),
      })
      if (!completion.ok) return null
      const res = await fetch("/api/economy/payout", {
        method: "POST", headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({ sessionId: payload.sessionId, uid }),
      })
      if (!res.ok) return null
      const data = await res.json()
      setBalance(data.wallet.balance)
      setLifetimeEarned(data.wallet.lifetimeEarned)
      setRankPoints(data.wallet.rankPoints)
      setBounties(data.bounties)
      setWeeklyGoals(data.weeklyGoals)
      return data
    } catch {
      return null
    }
  }, [user?.uid])

  const submitMultiplayerResult = useCallback(async (
    pin: string,
    playerId: string,
    answers: Array<{ qi: number; answer: string }>,
  ): Promise<PayoutResponse | null> => {
    if (!user?.uid || user.uid !== playerId) return null
    try {
      const data = await multiplayerApi<PayoutResponse>(`/api/game-rooms/${encodeURIComponent(pin)}/score`, {
        method: "POST",
        body: JSON.stringify({
          match_id: pin,
          user_answers_array: answers,
        }),
      })
      setBalance(data.newBalance)
      void refresh()
      if (data.bountyUpdates?.length) {
        setBounties(previous => previous.map((bounty) => {
          const update = data.bountyUpdates.find((item: { id: string }) => item.id === bounty.id)
          return update ? { ...bounty, progress: update.progress } : bounty
        }))
      }
      return data
    } catch {
      return null
    }
  }, [user?.uid, refresh])

  return (
    <EconomyContext.Provider value={{
      balance, lifetimeEarned, rankPoints, bounties, weeklyGoals, inventory, equippedCosmetics, loading,
      isItemUsePending, isItemUsed,
      dailyLoginReward, clearDailyLoginReward,
      refresh, claimBounty, purchase, useItem, equipCosmetic, grantDevNP,
      startScoredActivity, submitGameResult, submitMultiplayerResult,
    }}>
      {children}
    </EconomyContext.Provider>
  )
}

export function useEconomy() {
  const ctx = useContext(EconomyContext)
  if (!ctx) throw new Error("useEconomy must be used inside EconomyProvider")
  return ctx
}
