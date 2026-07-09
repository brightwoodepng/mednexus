"use client"

/**
 * Task 6 — The Grand Finale Pop-up [TRIAL MODE ONLY]
 *
 * A custom glassmorphic summary modal that intercepts the session end.
 * Triggers the exact moment the final question is answered, fires a
 * massive screen-wide confetti blast, scales in aggressively, and
 * presents a celebratory breakdown of the user's performance.
 *
 * Strictly conditional — only mounted by QuizSimulator when
 * gamificationEnabled === true and the last answer has been recorded.
 */

import { useEffect, useRef } from "react"
import confetti from "canvas-confetti"

// ── Data ─────────────────────────────────────────────────────────────────────

const MILESTONE_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: "None",
  1: "Warming Up 🏃",
  2: "In the Zone 🧠",
  3: "Heavyweight 🦍",
}

const MILESTONE_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: "text-muted-foreground",
  1: "text-sky-500 dark:text-sky-400",
  2: "text-violet-500 dark:text-violet-400",
  3: "text-amber-500 dark:text-amber-400",
}

const CELEBRATION_COLORS = [
  "#22d3ee", "#a78bfa", "#34d399",
  "#fbbf24", "#f472b6", "#f87171",
  "#60a5fa", "#ffffff",
]

function accuracyColor(pct: number): string {
  if (pct >= 70) return "text-emerald-500 dark:text-emerald-400"
  if (pct >= 50) return "text-amber-500 dark:text-amber-400"
  return "text-rose-500 dark:text-rose-400"
}

function accuracyVerdict(pct: number): string {
  if (pct >= 90) return "Outstanding!"
  if (pct >= 70) return "Solid work."
  if (pct >= 50) return "Getting there."
  return "Keep grinding."
}

// ── Confetti ─────────────────────────────────────────────────────────────────

function fireGrandFinaleConfetti() {
  const shared = { colors: CELEBRATION_COLORS, zIndex: 10001 }

  // Centre top — massive primary burst
  confetti({ ...shared, particleCount: 200, spread: 140, startVelocity: 65, origin: { x: 0.5, y: 0.08 }, ticks: 320, gravity: 0.82, decay: 0.93 })
  // Left cannon
  confetti({ ...shared, particleCount: 100, angle: 62,  spread: 65, startVelocity: 58, origin: { x: 0, y: 0.55 }, ticks: 260, gravity: 0.88 })
  // Right cannon
  confetti({ ...shared, particleCount: 100, angle: 118, spread: 65, startVelocity: 58, origin: { x: 1, y: 0.55 }, ticks: 260, gravity: 0.88 })

  // Delayed second wave for sustained effect
  setTimeout(() => {
    confetti({ ...shared, particleCount: 120, spread: 130, startVelocity: 48, origin: { x: 0.5, y: 0.15 }, ticks: 220, gravity: 0.95, decay: 0.91, scalar: 0.82 })
    confetti({ ...shared, particleCount: 60, angle: 70,  spread: 55, startVelocity: 50, origin: { x: 0.05, y: 0.7 }, ticks: 200, gravity: 0.9 })
    confetti({ ...shared, particleCount: 60, angle: 110, spread: 55, startVelocity: 50, origin: { x: 0.95, y: 0.7 }, ticks: 200, gravity: 0.9 })
  }, 380)
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface GrandFinaleModalProps {
  bestStreak: number
  milestoneTier: 0 | 1 | 2 | 3
  accuracy: number           // 0–100 percentage
  totalQuestions: number
  onReturnToMenu: () => void
  onRetry: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GrandFinaleModal({
  bestStreak,
  milestoneTier,
  accuracy,
  totalQuestions,
  onReturnToMenu,
  onRetry,
}: GrandFinaleModalProps) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fireGrandFinaleConfetti()

    // Prevent body scroll while modal is open
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Trial session complete"
    >
      {/* Heavy glassmorphic backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md" />

      {/* Modal card — scales in aggressively */}
      <div className="animate-grand-finale-in relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-2xl ring-1 ring-white/10">

        {/* Top glow band */}
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 opacity-90" />

        <div className="px-6 pb-7 pt-8">

          {/* Trophy icon */}
          <div className="mb-5 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-400/20 via-yellow-500/20 to-orange-500/20 ring-1 ring-white/15 shadow-inner">
              <span className="text-5xl select-none" role="img" aria-label="trophy">🏆</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-1 text-center">
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              TRIAL COMPLETE!
            </h2>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {totalQuestions} questions · {accuracyVerdict(accuracy)}
            </p>
          </div>

          {/* Divider */}
          <div className="my-5 h-px bg-border" />

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-2.5">

            {/* Best Combo */}
            <StatCard
              icon="🔥"
              label="Best Combo"
              value={bestStreak > 0 ? `${bestStreak}` : "—"}
              sub={bestStreak > 0 ? "in a row" : "no streak"}
              valueClass={bestStreak > 0 ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"}
            />

            {/* Milestone */}
            <StatCard
              icon="🏷️"
              label="Milestone"
              value={milestoneTier > 0 ? ["", "25%", "50%", "75%"][milestoneTier] : "—"}
              sub={milestoneTier > 0 ? MILESTONE_LABELS[milestoneTier] : "not reached"}
              valueClass={MILESTONE_COLORS[milestoneTier]}
            />

            {/* Accuracy */}
            <StatCard
              icon="🎯"
              label="Accuracy"
              value={`${accuracy}%`}
              sub={accuracy >= 70 ? "excellent" : accuracy >= 50 ? "fair" : "needs work"}
              valueClass={accuracyColor(accuracy)}
            />

          </div>

          {/* CTA buttons */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onReturnToMenu}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              Return to Menu
            </button>
            <button
              type="button"
              onClick={onRetry}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-all hover:border-primary/40 hover:bg-muted active:scale-[0.98]"
            >
              🔄 Play Again
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── StatCard sub-component ────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: string
  label: string
  value: string
  sub: string
  valueClass: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-muted/40 px-2 py-3 text-center">
      <span className="text-lg select-none">{icon}</span>
      <span className={`text-xl font-black leading-none tabular-nums ${valueClass}`}>{value}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">{label}</span>
      <span className="text-[9px] text-muted-foreground/70 leading-tight">{sub}</span>
    </div>
  )
}
