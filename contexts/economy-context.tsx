"use client"

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import type { BountyDef, StoreItem } from "@/lib/economy"
import { useApp } from "@/contexts/app-context"

export interface BountyWithProgress extends BountyDef {
  progress: number
  claimed: boolean
}

export interface EquippedCosmetics {
  title:     string | null
  frame:     string | null
  highlight: string | null
  avatar:    string | null
}

export interface EconomyContextValue {
  balance: number
  bounties: BountyWithProgress[]
  inventory: Record<string, number>
  equippedCosmetics: EquippedCosmetics
  loading: boolean
  refresh: () => Promise<void>
  claimBounty: (bountyId: string) => Promise<{ ok: boolean; earned?: number; error?: string }>
  purchase: (itemId: string) => Promise<{ ok: boolean; error?: string }>
  useItem: (itemId: string) => Promise<boolean>
  equipCosmetic: (type: "title" | "frame" | "highlight" | "avatar", itemId: string | null) => Promise<{ ok: boolean; error?: string }>
  grantDevNP: () => Promise<{ ok: boolean; error?: string }>
  submitGameResult: (payload: {
    mode: string
    score: number
    correct: number
    total: number
    bestStreak: number
    isNewHigh: boolean
    survivedCount?: number
    lifelineUsed?: boolean
  }) => Promise<{ earned: number; breakdown: { label: string; amount: number }[]; bountyUpdates: { id: string; progress: number; target: number; newlyComplete: boolean }[] } | null>
}

const EconomyContext = createContext<EconomyContextValue | undefined>(undefined)

const DEFAULT_COSMETICS: EquippedCosmetics = { title: null, frame: null, highlight: null, avatar: null }

export function EconomyProvider({ children }: { children: ReactNode }) {
  const { user } = useApp()
  const [balance, setBalance]                       = useState(0)
  const [bounties, setBounties]                     = useState<BountyWithProgress[]>([])
  const [inventory, setInventory]                   = useState<Record<string, number>>({})
  const [equippedCosmetics, setEquippedCosmetics]   = useState<EquippedCosmetics>(DEFAULT_COSMETICS)
  const [loading, setLoading]                       = useState(false)
  const initialized = useRef(false)

  const refresh = useCallback(async () => {
    const uid = user?.uid
    if (!uid) return
    setLoading(true)
    try {
      const [walletRes, bountiesRes, storeRes, cosmeticsRes] = await Promise.all([
        fetch(`/api/economy/wallet?uid=${encodeURIComponent(uid)}`).then(r => r.json()),
        fetch(`/api/economy/bounties?uid=${encodeURIComponent(uid)}`).then(r => r.json()),
        fetch(`/api/economy/store?uid=${encodeURIComponent(uid)}`).then(r => r.json()),
        fetch(`/api/economy/cosmetics?uid=${encodeURIComponent(uid)}`).then(r => r.json()),
      ])
      setBalance(walletRes.balance ?? 0)
      setBounties(bountiesRes.bounties ?? [])
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

  const useItem = useCallback(async (itemId: string) => {
    const uid = user?.uid
    if (!uid) return false
    try {
      const res = await fetch("/api/economy/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
      return { ok: true }
    } catch (e) {
      // Network failure — revert by re-fetching the real balance
      fetch(`/api/economy/wallet?uid=${encodeURIComponent(uid)}`)
        .then(r => r.json())
        .then(d => { if (typeof d.balance === "number") setBalance(d.balance) })
        .catch(() => {/* silent */})
      return { ok: false, error: String(e) }
    }
  }, [user?.uid])

  const submitGameResult = useCallback(async (payload: {
    mode: string; score: number; correct: number; total: number
    bestStreak: number; isNewHigh: boolean; survivedCount?: number
    lifelineUsed?: boolean
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
    <EconomyContext.Provider value={{
      balance, bounties, inventory, equippedCosmetics, loading,
      refresh, claimBounty, purchase, useItem, equipCosmetic, grantDevNP, submitGameResult,
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
