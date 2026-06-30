"use client"

import { useState } from "react"
import { useEconomy } from "@/contexts/economy-context"
import { STORE_ITEMS } from "@/lib/economy"

// ── Wallet Badge ───────────────────────────────────────────────────────────────
export function WalletBadge({ onOpenStore }: { onOpenStore: () => void }) {
  const { balance } = useEconomy()
  return (
    <button
      type="button" onClick={onOpenStore}
      className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 shadow-sm transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
    >
      <span className="text-sm">🪙</span>
      <span className="text-sm font-extrabold tabular-nums text-white">{balance.toLocaleString()}</span>
      <span className="text-[10px] font-bold text-white/80">NP</span>
    </button>
  )
}

// ── Payout Toast ───────────────────────────────────────────────────────────────
export function PayoutResult({
  earned,
  breakdown,
  bountyUpdates,
}: {
  earned: number
  breakdown: { label: string; amount: number }[]
  bountyUpdates: { id: string; progress: number; target: number; newlyComplete: boolean }[]
}) {
  const completedBounties = bountyUpdates.filter(b => b.newlyComplete)
  return (
    <div className="rounded-3xl border-2 border-amber-200 dark:border-amber-800/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">🪙</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">Nexus Points Earned</p>
          <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-300">+{earned.toLocaleString()} NP</p>
        </div>
      </div>
      <div className="grid gap-1.5">
        {breakdown.map(b => (
          <div key={b.label} className="flex items-center justify-between">
            <span className="text-xs text-amber-700/80 dark:text-amber-400/80">{b.label}</span>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">+{b.amount}</span>
          </div>
        ))}
      </div>
      {completedBounties.length > 0 && (
        <div className="mt-3 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50 dark:bg-emerald-950/30 p-2.5">
          <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">🎯 Bounty Progress!</p>
          {completedBounties.map(b => (
            <p key={b.id} className="text-[11px] text-emerald-600 dark:text-emerald-400">✓ Bounty completed — claim it in the store!</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Daily Bounties Panel ───────────────────────────────────────────────────────
export function DailyBountiesPanel() {
  const { bounties, claimBounty, loading } = useEconomy()
  const [claiming, setClaiming] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ id: string; earned: number } | null>(null)

  async function handleClaim(bountyId: string) {
    setClaiming(bountyId)
    const result = await claimBounty(bountyId)
    setClaiming(null)
    if (result.ok && result.earned) {
      setFlash({ id: bountyId, earned: result.earned })
      setTimeout(() => setFlash(null), 2500)
    }
  }

  if (loading && bounties.length === 0) return null

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Daily Bounties</p>
        <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
          🪙 Resets midnight
        </span>
      </div>
      <div className="grid gap-2">
        {bounties.map(b => {
          const pct = Math.min((b.progress / b.target) * 100, 100)
          const complete = b.progress >= b.target
          const isFlashing = flash?.id === b.id
          return (
            <div
              key={b.id}
              className={`rounded-2xl border p-3 transition-all ${
                b.claimed
                  ? "border-muted bg-muted/30 opacity-60"
                  : complete
                  ? "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20"
                  : "border-border bg-muted/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-xl">{b.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-xs font-bold text-foreground truncate">{b.label}</p>
                    <span className="shrink-0 text-[10px] font-bold text-amber-600 dark:text-amber-400">+{b.reward} NP</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">{b.desc}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${complete ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {Math.min(b.progress, b.target)}/{b.target}
                    </span>
                    {complete && !b.claimed && (
                      <button
                        type="button"
                        disabled={claiming === b.id}
                        onClick={() => handleClaim(b.id)}
                        className="shrink-0 rounded-full bg-emerald-500 px-3 py-0.5 text-[11px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-60"
                      >
                        {claiming === b.id ? "…" : isFlashing ? `+${flash?.earned}!` : "Claim"}
                      </button>
                    )}
                    {b.claimed && (
                      <span className="shrink-0 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ Done</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Store Modal ────────────────────────────────────────────────────────────────
export function StoreModal({ onClose }: { onClose: () => void }) {
  const { balance, inventory, purchase } = useEconomy()
  const [buying, setBuying] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"lifeline" | "cosmetic">("lifeline")

  async function handleBuy(itemId: string) {
    setError(null)
    setBuying(itemId)
    const result = await purchase(itemId)
    setBuying(null)
    if (result.ok) {
      setFlash(itemId)
      setTimeout(() => setFlash(null), 2000)
    } else {
      setError(result.error ?? "Purchase failed")
      setTimeout(() => setError(null), 3000)
    }
  }

  const items = STORE_ITEMS.filter(i => i.category === tab)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏪</span>
            <div>
              <h2 className="font-extrabold text-foreground">Supply Closet</h2>
              <p className="text-[11px] text-muted-foreground">Spend your Nexus Points</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5">
              <span className="text-sm">🪙</span>
              <span className="text-sm font-extrabold tabular-nums text-amber-700 dark:text-amber-300">{balance.toLocaleString()}</span>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border px-5 pt-3 pb-0">
          {(["lifeline", "cosmetic"] as const).map(t => (
            <button
              key={t} type="button" onClick={() => setTab(t)}
              className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "lifeline" ? "⚗️ Lifelines" : "✨ Cosmetics"}
            </button>
          ))}
        </div>

        {/* Items */}
        <div className="max-h-[60vh] overflow-y-auto p-4 grid gap-3">
          {error && (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </div>
          )}
          {items.map(item => {
            const owned = inventory[item.id] ?? 0
            const isOwned = item.maxQuantity === 1 && owned >= 1
            const canAfford = balance >= item.price
            const isBuying = buying === item.id
            const didBuy = flash === item.id
            return (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} text-2xl shadow-sm`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-sm font-bold text-foreground">{item.name}</p>
                      {!isOwned && (
                        <div className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5">
                          <span className="text-[10px]">🪙</span>
                          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{item.price}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2.5">{item.desc}</p>
                    <div className="flex items-center justify-between">
                      {item.category === "lifeline" && owned > 0 && (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">You have: {owned}×</span>
                      )}
                      {isOwned ? (
                        <span className="ml-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">✓ Owned</span>
                      ) : (
                        <button
                          type="button"
                          disabled={isBuying || !canAfford}
                          onClick={() => handleBuy(item.id)}
                          className={`ml-auto rounded-full px-4 py-1.5 text-[11px] font-bold transition-all ${
                            didBuy
                              ? "bg-emerald-500 text-white"
                              : canAfford
                              ? `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90`
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          }`}
                        >
                          {isBuying ? "…" : didBuy ? "Purchased!" : canAfford ? "Buy" : "Need more NP"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
