"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import type { BountyDef, StoreItem } from "@/lib/economy"
import type { DailyLoginResult } from "@/lib/anti-farming"
import { useApp } from "@/contexts/app-context"

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
  breakdown: { label: string; amount: number }[]
  bountyUpdates: { id: string; progress: number; target: number; newlyComplete: boolean }[]
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
  purchase: (itemId: string) => Promise<{ ok: boolean; error?: string }>
  useItem: (itemId: string) => Promise<boolean>
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
    orderedAnswers?: Array<{ questionId: string; answer: string | string[] | null }>
  }) => Promise<PayoutResponse | null>
  submitMultiplayerResult: (
    pin: string,
    playerId: string,
    answers: Array<{ qi: number; answer: string }>,
  ) => Promise<PayoutResponse | null>
}

const EconomyContext = createContext<EconomyContextValue | undefined>(undefined)

const DEFAULT_COSMETICS: EquippedCosmetics = { title: null, frame: null, highlight: null, avatar: null }

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
  const [equippedCosmetics, setEquippedCosmetics]   = useState<EquippedCosmetics>(DEFAULT_COSMETICS)
  const [loading, setLoading]                       = useState(false)
  const [dailyLoginReward, setDailyLoginReward]     = useState<DailyLoginResult | null>(null)
  const initialized = useRef(false)

  const clearDailyLoginReward = useCallback(() => setDailyLoginReward(null), [])

  const refresh = useCallback(async () => {
    const uid = user?.uid
    if (!uid) return
    setLoading(true)
    try {
      const [walletRes, bountiesRes, weeklyRes, storeRes, cosmeticsRes] = await Promise.all([
        fetch(`/api/economy/wallet`, { headers: economyHeaders() }).then(r => r.json()),
        fetch(`/api/economy/bounties`, { headers: economyHeaders() }).then(r => r.json()),
        fetch(`/api/economy/weekly-goals`, { headers: economyHeaders() }).then(r => r.json()),
        fetch(`/api/economy/store`, { headers: economyHeaders() }).then(r => r.json()),
        fetch(`/api/economy/cosmetics`, { headers: economyHeaders() }).then(r => r.json()),
      ])
      setBalance(walletRes.balance ?? 0)
      setLifetimeEarned(walletRes.lifetimeEarned ?? 0)
      setRankPoints(walletRes.rankPoints ?? 0)
      setBounties(bountiesRes.bounties ?? [])
      setWeeklyGoals(weeklyRes.goals ?? [])
      setInventory(storeRes.inventory ?? {})
      setEquippedCosmetics(cosmeticsRes.equipped ?? DEFAULT_COSMETICS)
    } catch {
      // silent — keep stale state
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (user?.uid && !initialized.current) {
      initialized.current = true
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
          .then((data: DailyLoginResult) => {
            if (!data.alreadyDone && data.earned > 0) {
              // Update balance optimistically so the header reflects the award immediately
              setBalance((prev) => prev + data.earned)
              setDailyLoginReward(data)
              void refresh()
            }
          })
          .catch(() => { /* silent — non-critical */ })
      }
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
      setBalance(data.newBalance)
      void refresh()
      setBounties(prev => prev.map(b => b.id === bountyId ? { ...b, claimed: true } : b))
      return { ok: true, earned: data.earned }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [user?.uid, refresh])

  const purchase = useCallback(async (itemId: string) => {
    const uid = user?.uid
    if (!uid) return { ok: false, error: "Not logged in" }
    try {
      const res = await fetch("/api/economy/store", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({ uid, itemId }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      setBalance(data.balance ?? data.newBalance)
      setLifetimeEarned(data.lifetimeEarned ?? lifetimeEarned)
      setRankPoints(data.rankPoints ?? rankPoints)
      setInventory(prev => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }))
      // Reconcile every economy surface with the committed transaction. This
      // also corrects optimistic inventory state if another tab purchased or
      // consumed the same item concurrently.
      void refresh()
      return { ok: true }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [user?.uid, lifetimeEarned, rankPoints, refresh])

  const useItem = useCallback(async (itemId: string) => {
    const uid = user?.uid
    if (!uid) return false
    try {
      const res = await fetch("/api/economy/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({ uid, itemId }),
      })
      if (!res.ok) return false
      setInventory(prev => {
        const newQty = (prev[itemId] ?? 0) - 1
        if (newQty <= 0) {
          const next = { ...prev }
          delete next[itemId]
          return next
        }
        return { ...prev, [itemId]: newQty }
      })
      return true
    } catch {
      return false
    }
  }, [user?.uid])

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
      setEquippedCosmetics(prev => ({ ...prev, [type]: itemId }))
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
      return res.ok ? (await res.json()).sessionId ?? null : null
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
    orderedAnswers?: Array<{ questionId: string; answer: string | string[] | null }>
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
          resultMeta: { lifelineUsed: payload.lifelineUsed === true },
        }),
      })
      if (!completion.ok) return null
      const res = await fetch("/api/economy/payout", {
        method: "POST", headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({ sessionId: payload.sessionId, uid }),
      })
      if (!res.ok) return null
      const data = await res.json()
      setBalance(data.newBalance)
      void refresh()
      if (data.bountyUpdates?.length) {
        setBounties(prev => prev.map(b => {
          const upd = data.bountyUpdates.find((u: { id: string }) => u.id === b.id)
          if (!upd) return b
          return { ...b, progress: upd.progress }
        }))
      }
      return data
    } catch {
      return null
    }
  }, [user?.uid, refresh])

  const submitMultiplayerResult = useCallback(async (
    pin: string,
    playerId: string,
    answers: Array<{ qi: number; answer: string }>,
  ): Promise<PayoutResponse | null> => {
    if (!user?.uid || user.uid !== playerId) return null
    try {
      const response = await fetch(`/api/game-rooms/${encodeURIComponent(pin)}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...economyHeaders() },
        body: JSON.stringify({
          match_id: pin,
          playerId,
          user_answers_array: answers,
        }),
      })
      const data = await response.json()
      if (!response.ok) return null
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
