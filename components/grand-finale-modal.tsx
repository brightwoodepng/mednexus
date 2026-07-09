"use client"

/**
 * Task 6 — The Grand Finale Pop-up [TRIAL MODE ONLY]
 *
 * Fused summary modal: gamification stats + test scores + per-question review.
 * Fires a massive screen-wide confetti blast on mount, scales in aggressively,
 * and displays a scrollable answer-by-answer breakdown below the stat cards.
 *
 * Strictly conditional — only mounted by QuizSimulator when
 * gamificationEnabled === true and the last answer has been recorded.
 */

import { useEffect, useRef } from "react"
import confetti from "canvas-confetti"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReviewItem {
  stem: string       // raw vignette (may contain HTML)
  isCorrect: boolean
  subject: string
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

/** Strip HTML tags so vignette text renders cleanly in the compact review list. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()
}

// ── Confetti ─────────────────────────────────────────────────────────────────

function fireGrandFinaleConfetti() {
  const shared = { colors: CELEBRATION_COLORS, zIndex: 10001 }

  confetti({ ...shared, particleCount: 200, spread: 140, startVelocity: 65, origin: { x: 0.5, y: 0.08 }, ticks: 320, gravity: 0.82, decay: 0.93 })
  confetti({ ...shared, particleCount: 100, angle: 62,  spread: 65, startVelocity: 58, origin: { x: 0, y: 0.55 }, ticks: 260, gravity: 0.88 })
  confetti({ ...shared, particleCount: 100, angle: 118, spread: 65, startVelocity: 58, origin: { x: 1, y: 0.55 }, ticks: 260, gravity: 0.88 })

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
  accuracy: number
  correctCount: number
  totalQuestions: number
  timeTakenSeconds: number
  reviewItems: ReviewItem[]
  onReturnToMenu: () => void
  onRetry: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GrandFinaleModal({
  bestStreak,
  milestoneTier,
  accuracy,
  correctCount,
  totalQuestions,
  timeTakenSeconds,
  reviewItems,
  onReturnToMenu,
  onRetry,
}: GrandFinaleModalProps) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fireGrandFinaleConfetti()
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const wrongCount = totalQuestions - correctCount

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Trial session complete"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md" />

      {/* Modal card */}
      <div className="animate-grand-finale-in relative flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-white/20 bg-card/95 shadow-2xl shadow-black/40 backdrop-blur-2xl ring-1 ring-white/10" style={{ maxHeight: "92dvh" }}>

        {/* Top glow band */}
        <div className="absolute inset-x-0 top-0 h-1 flex-shrink-0 bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400 opacity-90" />

        {/* ── Scrollable body ────────────────────────────────────────────────── */}
        <div className="overflow-y-auto overscroll-contain">
          <div className="px-5 pb-2 pt-8">

            {/* Trophy + heading */}
            <div className="mb-3 flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/20 via-yellow-500/20 to-orange-500/20 ring-1 ring-white/15 shadow-inner">
                <span className="text-3xl select-none" role="img" aria-label="trophy">🏆</span>
              </div>
              <div className="text-center">
                <h2 className="text-xl font-black tracking-tight text-foreground">TRIAL COMPLETE!</h2>
                <p className="text-xs font-medium text-muted-foreground">{accuracyVerdict(accuracy)}</p>
              </div>
            </div>

            {/* ── Score highlight ──────────────────────────────────────────── */}
            <div className="flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-muted/40 px-4 py-3">
              <span className={`text-4xl font-black tabular-nums leading-none ${accuracyColor(accuracy)}`}>
                {correctCount}
              </span>
              <span className="text-xl font-bold text-muted-foreground leading-none">/</span>
              <span className="text-xl font-bold text-muted-foreground tabular-nums leading-none">{totalQuestions}</span>
              <span className="ml-2 text-sm font-semibold text-muted-foreground">correct</span>
              <span className="ml-auto text-sm font-black tabular-nums">{accuracy}%</span>
            </div>

            {/* ── Test stats row ───────────────────────────────────────────── */}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <StatCard icon="✅" label="Correct" value={`${correctCount}`} sub="right"
                valueClass="text-emerald-500 dark:text-emerald-400" />
              <StatCard icon="❌" label="Missed" value={`${wrongCount}`} sub="wrong"
                valueClass={wrongCount > 0 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground"} />
              <StatCard icon="⏱️" label="Time" value={formatTime(timeTakenSeconds)} sub="elapsed"
                valueClass="text-foreground" />
            </div>

            {/* ── Gamification row ─────────────────────────────────────────── */}
            <p className="mb-1.5 mt-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Gamification
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon="🔥" label="Best Combo"
                value={bestStreak > 0 ? `${bestStreak}` : "—"}
                sub={bestStreak > 0 ? "in a row" : "no streak"}
                valueClass={bestStreak > 0 ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"} />
              <StatCard icon="🏷️" label="Milestone"
                value={milestoneTier > 0 ? ["", "25%", "50%", "75%"][milestoneTier] : "—"}
                sub={milestoneTier > 0 ? MILESTONE_LABELS[milestoneTier] : "not reached"}
                valueClass={MILESTONE_COLORS[milestoneTier]} />
            </div>

            {/* ── Answer review ────────────────────────────────────────────── */}
            {reviewItems.length > 0 && (
              <>
                <p className="mb-1.5 mt-3 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Answer Review
                </p>
                <div className="rounded-2xl border border-border bg-muted/25 divide-y divide-border overflow-hidden">
                  {reviewItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                      {/* Result badge */}
                      <span className="mt-px flex-shrink-0 text-sm leading-none select-none">
                        {item.isCorrect ? "✅" : "❌"}
                      </span>
                      {/* Question info */}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground">
                          <span className="mr-1 font-bold text-muted-foreground">Q{i + 1}.</span>
                          {stripHtml(item.stem)}
                        </p>
                        <span className="text-[10px] text-muted-foreground/70">{item.subject}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

          </div>
        </div>

        {/* ── Sticky CTA buttons ────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-border bg-card/80 px-5 py-4 backdrop-blur-sm">
          <div className="flex flex-col gap-2.5">
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
              🔄 Retry Block
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// ── StatCard sub-component ────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, valueClass,
}: {
  icon: string
  label: string
  value: string
  sub: string
  valueClass: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-border bg-muted/40 px-2 py-2.5 text-center">
      <span className="text-base select-none">{icon}</span>
      <span className={`text-lg font-black leading-none tabular-nums ${valueClass}`}>{value}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">{label}</span>
      <span className="text-[9px] text-muted-foreground/70 leading-tight">{sub}</span>
    </div>
  )
}
