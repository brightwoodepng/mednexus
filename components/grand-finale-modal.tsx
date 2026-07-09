"use client"

/**
 * Task 6 — The Grand Finale Pop-up [TRIAL MODE ONLY]
 *
 * Layout (top → bottom):
 *   • Compact trophy + title header
 *   • Large X/Y score bar with accuracy %
 *   • Unified 5-stat grid (correct, missed, time, combo, milestone)
 *   • "Review Answers" toggle button → reveals accordion list
 *     Each row expands to show correct answer + explanation
 *   • Sticky CTA footer (Return to Menu / Retry Block)
 */

import { useState, useEffect, useRef } from "react"
import confetti from "canvas-confetti"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReviewItem {
  stem: string
  isCorrect: boolean
  subject: string
  correctAnswerText: string
  explanation?: {
    objective: string
    details: string
    incorrectReasoning: string
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MILESTONE_LABELS: Record<0 | 1 | 2 | 3, string> = {
  0: "—", 1: "Warming Up 🏃", 2: "In the Zone 🧠", 3: "Heavyweight 🦍",
}

const MILESTONE_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: "text-muted-foreground",
  1: "text-sky-500 dark:text-sky-400",
  2: "text-violet-500 dark:text-violet-400",
  3: "text-amber-500 dark:text-amber-400",
}

const CONFETTI_COLORS = ["#22d3ee","#a78bfa","#34d399","#fbbf24","#f472b6","#f87171","#60a5fa","#ffffff"]

// ── Helpers ───────────────────────────────────────────────────────────────────

const accuracyColor = (p: number) =>
  p >= 70 ? "text-emerald-500 dark:text-emerald-400"
  : p >= 50 ? "text-amber-500 dark:text-amber-400"
  : "text-rose-500 dark:text-rose-400"

const accuracyVerdict = (p: number) =>
  p >= 90 ? "Outstanding! 🎖️" : p >= 70 ? "Solid work." : p >= 50 ? "Getting there." : "Keep grinding."

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s{2,}/g, " ").trim()

// ── Confetti ──────────────────────────────────────────────────────────────────

function fireConfetti() {
  const s = { colors: CONFETTI_COLORS, zIndex: 10001 }
  confetti({ ...s, particleCount: 200, spread: 140, startVelocity: 65, origin: { x: 0.5, y: 0.08 }, ticks: 320, gravity: 0.82, decay: 0.93 })
  confetti({ ...s, particleCount: 100, angle: 62,  spread: 65, startVelocity: 58, origin: { x: 0, y: 0.55 }, ticks: 260, gravity: 0.88 })
  confetti({ ...s, particleCount: 100, angle: 118, spread: 65, startVelocity: 58, origin: { x: 1, y: 0.55 }, ticks: 260, gravity: 0.88 })
  setTimeout(() => {
    confetti({ ...s, particleCount: 120, spread: 130, startVelocity: 48, origin: { x: 0.5, y: 0.15 }, ticks: 220, gravity: 0.95, decay: 0.91, scalar: 0.82 })
    confetti({ ...s, particleCount: 60, angle: 70,  spread: 55, startVelocity: 50, origin: { x: 0.05, y: 0.7 }, ticks: 200 })
    confetti({ ...s, particleCount: 60, angle: 110, spread: 55, startVelocity: 50, origin: { x: 0.95, y: 0.7 }, ticks: 200 })
  }, 380)
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
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
  bestStreak, milestoneTier, accuracy, correctCount,
  totalQuestions, timeTakenSeconds, reviewItems, onReturnToMenu, onRetry,
}: Props) {
  const fired = useRef(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fireConfetti()
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const wrongCount = totalQuestions - correctCount

  return (
    <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center p-0 sm:p-4"
      role="dialog" aria-modal="true" aria-label="Trial session complete">

      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

      {/* Card — sheet on mobile, centered modal on sm+ */}
      <div className="animate-grand-finale-in relative flex w-full flex-col overflow-hidden
        rounded-t-3xl sm:rounded-3xl border border-white/20
        bg-card/97 shadow-2xl shadow-black/50 backdrop-blur-2xl ring-1 ring-white/10
        sm:max-w-md"
        style={{ maxHeight: "93dvh" }}>

        {/* Colour band */}
        <div className="absolute inset-x-0 top-0 h-[3px] flex-shrink-0
          bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-400" />

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="overflow-y-auto overscroll-contain px-5 pt-7 pb-4 flex-1 space-y-4">

          {/* Header row: trophy + title side-by-side */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl
              bg-gradient-to-br from-amber-400/25 to-orange-500/20 ring-1 ring-white/15">
              <span className="text-2xl select-none">🏆</span>
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-black tracking-tight text-foreground leading-tight">
                TRIAL COMPLETE!
              </h2>
              <p className="text-xs text-muted-foreground font-medium">{accuracyVerdict(accuracy)}</p>
            </div>
          </div>

          {/* Score bar */}
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/35 px-4 py-3">
            <span className={`text-4xl font-black tabular-nums leading-none ${accuracyColor(accuracy)}`}>
              {correctCount}
            </span>
            <span className="text-lg font-bold text-muted-foreground leading-none">/</span>
            <span className="text-lg font-bold text-muted-foreground tabular-nums leading-none">
              {totalQuestions}
            </span>
            <span className="text-sm text-muted-foreground ml-1">correct</span>
            <span className={`ml-auto text-xl font-black tabular-nums ${accuracyColor(accuracy)}`}>
              {accuracy}%
            </span>
          </div>

          {/* Unified 5-stat grid */}
          <div className="space-y-1.5">
            {/* Row 1: test stats */}
            <div className="grid grid-cols-3 gap-1.5">
              <StatCard icon="✅" label="Correct"   value={`${correctCount}`}      sub="right"   vc="text-emerald-500 dark:text-emerald-400" />
              <StatCard icon="❌" label="Missed"    value={`${wrongCount}`}        sub="wrong"   vc={wrongCount > 0 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground"} />
              <StatCard icon="⏱️" label="Time"      value={formatTime(timeTakenSeconds)} sub="elapsed" vc="text-foreground" />
            </div>
            {/* Row 2: gamification */}
            <div className="grid grid-cols-2 gap-1.5">
              <StatCard icon="🔥" label="Best Combo"
                value={bestStreak > 0 ? `${bestStreak}` : "—"}
                sub={bestStreak > 0 ? "in a row" : "no streak"}
                vc={bestStreak > 0 ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"} />
              <StatCard icon="🏷️" label="Milestone"
                value={milestoneTier > 0 ? ["","25%","50%","75%"][milestoneTier] : "—"}
                sub={MILESTONE_LABELS[milestoneTier]}
                vc={MILESTONE_COLORS[milestoneTier]} />
            </div>
          </div>

          {/* Review Answers toggle button */}
          {reviewItems.length > 0 && (
            <button
              type="button"
              onClick={() => setReviewOpen(v => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-border
                bg-muted/30 px-4 py-2.5 text-sm font-semibold text-foreground
                transition-colors hover:bg-muted active:scale-[0.98]"
            >
              <span className="flex items-center gap-2">
                <span className="text-base">📋</span>
                Review Answers
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {reviewItems.length}
                </span>
              </span>
              <span className={`text-muted-foreground transition-transform duration-200 ${reviewOpen ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
          )}

          {/* Accordion review list */}
          {reviewOpen && (
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {reviewItems.map((item, i) => {
                const isExpanded = expandedIdx === i
                return (
                  <div key={i}>
                    {/* Row header — click to expand */}
                    <button
                      type="button"
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                      className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left
                        transition-colors hover:bg-muted/40"
                    >
                      <span className="mt-px flex-shrink-0 text-sm leading-none select-none">
                        {item.isCorrect ? "✅" : "❌"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground">
                          <span className="mr-1 font-bold text-muted-foreground">Q{i + 1}.</span>
                          {stripHtml(item.stem)}
                        </p>
                        <span className="text-[10px] text-muted-foreground/70">{item.subject}</span>
                      </div>
                      <span className={`mt-0.5 flex-shrink-0 text-[10px] text-muted-foreground transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </button>

                    {/* Expanded explanation drawer */}
                    {isExpanded && (
                      <div className={`border-t px-3 py-3 text-[11px] leading-relaxed space-y-2
                        ${item.isCorrect ? "border-emerald-500/20 bg-emerald-500/5" : "border-rose-500/20 bg-rose-500/5"}`}>

                        {/* Correct answer */}
                        <div>
                          <span className="font-bold text-foreground">Correct answer: </span>
                          <span className="text-foreground/80">
                            {item.correctAnswerText || "—"}
                          </span>
                        </div>

                        {/* Explanation blocks */}
                        {item.explanation?.objective && (
                          <div>
                            <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[9px] mb-0.5">
                              Learning Objective
                            </p>
                            <p className="text-foreground/80">{stripHtml(item.explanation.objective)}</p>
                          </div>
                        )}
                        {item.explanation?.details && (
                          <div>
                            <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[9px] mb-0.5">
                              Why It&apos;s Correct
                            </p>
                            <p className="text-foreground/80">{stripHtml(item.explanation.details)}</p>
                          </div>
                        )}
                        {!item.isCorrect && item.explanation?.incorrectReasoning && (
                          <div>
                            <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[9px] mb-0.5">
                              Distractor Reasoning
                            </p>
                            <p className="text-foreground/80">{stripHtml(item.explanation.incorrectReasoning)}</p>
                          </div>
                        )}
                        {!item.explanation && (
                          <p className="text-muted-foreground italic">No explanation available.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>

        {/* ── Sticky CTA footer ────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-border bg-card/80 px-5 py-4 backdrop-blur-sm space-y-2">
          <button type="button" onClick={onReturnToMenu}
            className="flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3.5
              text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30
              transition-all hover:bg-primary/90 active:scale-[0.98]">
            Return to Menu
          </button>
          <button type="button" onClick={onRetry}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border
              bg-card px-5 py-3 text-sm font-semibold text-foreground
              transition-all hover:border-primary/40 hover:bg-muted active:scale-[0.98]">
            🔄 Retry Block
          </button>
        </div>

      </div>
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, vc }: {
  icon: string; label: string; value: string; sub: string; vc: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl border border-border bg-muted/35 px-2 py-2.5 text-center">
      <span className="text-base select-none leading-none">{icon}</span>
      <span className={`text-lg font-black leading-tight tabular-nums ${vc}`}>{value}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">{label}</span>
      <span className="text-[9px] text-muted-foreground/60 leading-none">{sub}</span>
    </div>
  )
}
