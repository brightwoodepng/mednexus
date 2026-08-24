"use client"

import { useState } from "react"
import { BookOpen, CalendarDays, Check, ClipboardCheck, Clock3, Coins, Compass, Flame, Gamepad2, Target, Trophy, type LucideIcon } from "lucide-react"
import { useEconomy } from "@/contexts/economy-context"
import { SELLABLE_STORE_ITEMS, BOUNTY_POOL } from "@/lib/economy"
import { ECONOMY_ICON, ECONOMY_PROGRESS_TRACK, ECONOMY_ROW, ECONOMY_SECTION, ECONOMY_SECTION_HEADER } from "@/components/economy-ui"

// ── Wallet Badge ───────────────────────────────────────────────────────────────
export function WalletBadge({ onOpenStore }: { onOpenStore: () => void }) {
  const { balance } = useEconomy()
  return (
    <button
      type="button" onClick={onOpenStore}
      aria-label={`Open Nexus Store, ${balance.toLocaleString()} Nexus Points`}
      className="flex h-11 min-w-0 items-center justify-center gap-1 rounded-xl border border-border/80 bg-card/80 px-2 text-foreground shadow-sm backdrop-blur-sm transition-[background-color,border-color,box-shadow] hover:border-amber-500/30 hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 sm:w-auto sm:px-3"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500"><Coins size={15} aria-hidden /></span>
      <span className="min-w-0 truncate text-xs font-extrabold tabular-nums">{balance.toLocaleString()}</span>
      <span className="shrink-0 text-[10px] font-bold text-muted-foreground">NP</span>
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
  bountyUpdates: { id: string; progress: number; target: number; newlyComplete: boolean; reward?: number }[]
}) {
  const limitedByCap = breakdown.some(item => item.amount < 0)
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label={`${earned} Nexus Points earned`}>
      {/* Earned amount header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Coins size={19} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">Nexus Points earned</p>
          <p className="mt-0.5 text-2xl font-bold text-foreground tabular-nums">{earned > 0 ? "+" : ""}{earned.toLocaleString()} NP</p>
          {earned === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {limitedByCap ? "No additional NP was credited because a daily reward limit applied." : "No eligible points were awarded for this round."}
            </p>
          )}
        </div>
      </div>

      {/* Breakdown lines */}
      {breakdown.length > 0 && (
        <div className="grid gap-2 py-4">
          {breakdown.map(b => (
            <div key={b.label} className="flex items-center justify-between gap-4 text-sm">
              <span className="min-w-0 text-muted-foreground">{b.label}</span>
              <span className={`shrink-0 font-semibold tabular-nums ${b.amount < 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                {b.amount > 0 ? "+" : ""}{b.amount} NP
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bounty progress — show every bounty that got a delta, with mini progress bar */}
      {bountyUpdates.length > 0 && (
        <div className={`${breakdown.length > 0 ? "" : "mt-4"} space-y-3 rounded-xl border border-border bg-muted/25 p-3.5`}>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Target size={14} aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-wide">Bounty progress</p>
          </div>
          {bountyUpdates.map(b => {
            const def = BOUNTY_POOL.find(p => p.id === b.id)
            const pct = Math.min((b.progress / b.target) * 100, 100)
            return (
              <div key={b.id}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                    <span>{def?.icon ?? "🎯"}</span>
                    <span className="truncate">{def?.label ?? b.id}</span>
                  </span>
                  {b.newlyComplete ? (
                    <span className="shrink-0 text-[10px] font-semibold text-success">✓ +{b.reward ?? def?.reward ?? 0} NP</span>
                  ) : (
                    <span className="shrink-0 text-[10px] font-semibold text-muted-foreground tabular-nums">
                      {Math.min(b.progress, b.target)}/{b.target}
                    </span>
                  )}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full rounded-full transition-[width,background-color] duration-700 ${b.newlyComplete ? "bg-success" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ── Daily Bounties Panel ───────────────────────────────────────────────────────
export function DailyBountiesPanel() {
  const { bounties, weeklyGoals, claimBounty, loading } = useEconomy()
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

  const bountyIcons: Record<(typeof bounties)[number]["type"], LucideIcon> = {
    practice: BookOpen, exam: ClipboardCheck, accuracy: Target, game: Trophy,
    streak: Flame, discipline_variety: Compass, game_variety: Gamepad2,
  }
  const weeklyIcons = { answers: BookOpen, accuracy: Target, exam_dates: CalendarDays } satisfies Record<(typeof weeklyGoals)[number]["type"], LucideIcon>
  const weeklyLabels = {
    answers: "Complete 100 eligible questions",
    accuracy: "Reach 70% accuracy across 100+ answers",
    exam_dates: "Complete 3 qualifying exams on separate days",
  }

  return <div className="grid gap-3">
    <section className={ECONOMY_SECTION} aria-labelledby="weekly-rounds-title">
      <div className={ECONOMY_SECTION_HEADER}>
        <p id="weekly-rounds-title" className="text-[10px] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-300">Weekly rounds</p>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><CalendarDays size={13} aria-hidden />Monday reset</span>
      </div>
      <div className="grid gap-2 p-3">{weeklyGoals.map(goal => {
        const pct = Math.min(goal.progress / Math.max(goal.target, 1) * 100, 100)
        const GoalIcon = weeklyIcons[goal.type]
        return <div key={goal.id} className={ECONOMY_ROW}>
          <div className="flex min-w-0 items-start gap-3">
            <span className={`${ECONOMY_ICON} bg-violet-500/12 text-violet-600 dark:text-violet-300`}><GoalIcon size={17} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <p className="min-w-0 text-xs font-bold leading-5 text-foreground">{weeklyLabels[goal.type]}</p>
                <span className={`shrink-0 text-[10px] font-bold tabular-nums ${goal.credited ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {goal.credited ? <span className="inline-flex items-center gap-1"><Check size={12} aria-hidden />Credited</span> : `+${goal.reward} NP`}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className={ECONOMY_PROGRESS_TRACK}><div className={`h-full rounded-full transition-[width,background-color] duration-500 ${goal.completed ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${pct}%` }} /></div>
                <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{Math.min(goal.progress, goal.target)}/{goal.target}{goal.type === "accuracy" ? "%" : ""}</span>
              </div>
            </div>
          </div>
        </div>
      })}</div>
    </section>

    <section className={ECONOMY_SECTION} aria-labelledby="daily-bounties-title">
      <div className={ECONOMY_SECTION_HEADER}>
        <p id="daily-bounties-title" className="text-[10px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-300">Daily bounties</p>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground"><Clock3 size={13} aria-hidden />Resets midnight</span>
      </div>
      <div className="grid gap-2 p-3">{bounties.map(bounty => {
        const pct = Math.min((bounty.progress / bounty.target) * 100, 100)
        const complete = bounty.progress >= bounty.target
        const isFlashing = flash?.id === bounty.id
        const BountyIcon = bountyIcons[bounty.type]
        return <div key={bounty.id} className={`${ECONOMY_ROW} ${bounty.claimed ? "bg-muted/30 opacity-65" : complete ? "border-emerald-500/35 bg-emerald-500/5 shadow-sm" : ""}`}>
          <div className="flex items-start gap-3">
            <span className={`${ECONOMY_ICON} bg-cyan-500/12 text-cyan-600 dark:text-cyan-300`}><BountyIcon size={17} aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex min-w-0 items-start justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-bold leading-5 text-foreground">{bounty.label}</p>
                <span className="shrink-0 text-[10px] font-bold tabular-nums text-amber-600 dark:text-amber-400">+{bounty.reward} NP</span>
              </div>
              <p className="mb-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{bounty.desc}</p>
              <div className="flex items-center gap-2">
                <div className={ECONOMY_PROGRESS_TRACK}><div className={`h-full rounded-full transition-[width,background-color] duration-500 ${complete ? "bg-emerald-500" : "bg-cyan-500"}`} style={{ width: `${pct}%` }} /></div>
                <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{Math.min(bounty.progress, bounty.target)}/{bounty.target}</span>
                {complete && !bounty.claimed && <button type="button" disabled={claiming === bounty.id} onClick={() => handleClaim(bounty.id)} className="min-h-7 w-[4.25rem] shrink-0 rounded-lg bg-emerald-600 px-2 text-[10px] font-bold text-white transition-[background-color,box-shadow] hover:bg-emerald-500 hover:shadow-sm disabled:opacity-60">{claiming === bounty.id ? "Claiming" : isFlashing ? `+${flash?.earned} NP` : "Claim"}</button>}
                {bounty.claimed && <span className="inline-flex w-[4.25rem] shrink-0 items-center justify-end gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"><Check size={12} aria-hidden />Done</span>}
              </div>
            </div>
          </div>
        </div>
      })}</div>
    </section>
  </div>
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

  const items = SELLABLE_STORE_ITEMS.filter(i => i.category === tab)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏪</span>
            <div>
              <h2 className="font-extrabold text-foreground">Supply Closet</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5">
              <span className="text-sm">🪙</span>
              <span className="text-sm font-extrabold tabular-nums text-amber-700 dark:text-amber-300">{balance.toLocaleString()}</span>
              <span className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70">NP</span>
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
