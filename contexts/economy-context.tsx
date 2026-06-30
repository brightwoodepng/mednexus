"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import type { BountyDef, StoreItem } from "@/lib/economy"
import { useApp } from "@/contexts/app-context"

export interface BountyWithProgress extends BountyDef {
  progress: number
  claimed: boolean
}

export interface EconomyContextValue {
  balance: number
  bounties: BountyWithProgress[]
  inventory: Record<string, number>
  loading: boolean
  refresh: () => Promise<void>
  claimBounty: (bountyId: string) => Promise<{ ok: boolean; earned?: number; error?: string }>
  purchase: (itemId: string) => Promise<{ ok: boolean; error?: string }>
  submitGameResult: (payload: {
    mode: string
    score: number
    correct: number
    total: number
    bestStreak: number
    isNewHigh: boolean
    survivedCount?: number
  }) => Promise<{ earned: number; breakdown: { label: string; amount: number }[]; bountyUpdates: { id: string; progress: number; target: number; newlyComplete: boolean }[] } | null>
}

const EconomyContext = createContext<EconomyContextValue | undefined>(undefined)

export function EconomyProvider({ children }: { children: ReactNode }) {
  const { user } = useApp()
  const [balance, setBalance] = useState(0)
  const [bounties, setBounties] = useState<BountyWithProgress[]>([])
  const [inventory, setInventory] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const initialized = useRef(false)

  const refresh = useCallback(async () => {
    const uid = user?.uid
    if (!uid) return
    setLoading(true)
    try {
      const [walletRes, bountiesRes, storeRes] = await Promise.all([
        fetch(`/api/economy/wallet?uid=${encodeURIComponent(uid)}`).then(r => r.json()),
        fetch(`/api/economy/bounties?uid=${encodeURIComponent(uid)}`).then(r => r.json()),
        fetch(`/api/economy/store?uid=${encodeURIComponent(uid)}`).then(r => r.json()),
      ])
      setBalance(walletRes.balance ?? 0)
      setBounties(bountiesRes.bounties ?? [])
      setInventory(storeRes.inventory ?? {})
    } catch {
    } finally {
      setLoading(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (user?.uid && !initialized.current) {
      initialized.current = true
      refresh()
    }
  }, [user?.uid, refresh])

  const claimBounty = useCallback(async (bountyId: string) => {
    const uid = user?.uid
    if (!uid) return { ok: false, error: "Not logged in" }
    try {
      const res = await fetch("/api/economy/bounties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, bountyId }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      setBalance(data.newBalance)
      setBounties(prev => prev.map(b => b.id === bountyId ? { ...b, claimed: true } : b))
      return { ok: true, earned: data.earned }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [user?.uid])

  const purchase = useCallback(async (itemId: string) => {
    const uid = user?.uid
    if (!uid) return { ok: false, error: "Not logged in" }
    try {
      const res = await fetch("/api/economy/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, itemId }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error }
      setBalance(data.newBalance)
      setInventory(prev => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }))
      return { ok: true }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [user?.uid])

  const submitGameResult = useCallback(async (payload: {
    mode: string; score: number; correct: number; total: number
    bestStreak: number; isNewHigh: boolean; survivedCount?: number
  }) => {
    const uid = user?.uid
    if (!uid) return null
    try {
      const res = await fetch("/api/economy/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, ...payload }),
      })
      if (!res.ok) return null
      const data = await res.json()
      setBalance(data.newBalance)
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
  }, [user?.uid])

  return (
    <EconomyContext.Provider value={{ balance, bounties, inventory, loading, refresh, claimBounty, purchase, submitGameResult }}>
      {children}
    </EconomyContext.Provider>
  )
}

export function useEconomy() {
  const ctx = useContext(EconomyContext)
  if (!ctx) throw new Error("useEconomy must be used inside EconomyProvider")
  return ctx
}
