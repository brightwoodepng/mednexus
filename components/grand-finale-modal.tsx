"use client"

/**
 * Task 6 — The Grand Finale Pop-up [TRIAL MODE ONLY]
 *
 * Layout (top → bottom):
 *   • Compact trophy + title header (side-by-side)
 *   • Large X/Y score bar with accuracy %
 *   • Compact performance summary
 *   • "Review Answers" button → opens TrialReviewPanel full-screen overlay
 *   • Dashboard and same-question retry actions
 */

import { useState, useEffect, useRef } from "react"
import confetti from "canvas-confetti"
import type { Question } from "@/lib/types"
import { TrialReviewPanel } from "@/components/trial-review-panel"
import { CheckIcon, ClockIcon, LayoutDashboardIcon, RotateCcwIcon, TrophyIcon, XIcon } from "@/components/icons"

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

const CONFETTI_COLORS = ["#22d3ee","#a78bfa","#34d399","#fbbf24","#f472b6","#f87171","#60a5fa","#ffffff"]

// ── Helpers ───────────────────────────────────────────────────────────────────

const accuracyColor = (p: number) =>
  p >= 70 ? "text-emerald-500 dark:text-emerald-400"
  : p >= 50 ? "text-amber-500 dark:text-amber-400"
  : "text-rose-500 dark:text-rose-400"

const accuracyVerdict = (p: number) =>
  p >= 90 ? "Outstanding! 🎖️" : p >= 70 ? "Solid work." : p >= 50 ? "Getting there." : "Keep grinding."

const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`

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
  questions: Question[]
  answers: Record<string, string | string[] | null>
  onReturnToDashboard: () => void
  onRetry: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GrandFinaleModal({
  bestStreak, milestoneTier, accuracy, correctCount,
  totalQuestions, timeTakenSeconds, questions, answers,
  onReturnToDashboard, onRetry,
}: Props) {
  const fired = useRef(false)
  const [showReview, setShowReview] = useState(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    fireConfetti()
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const wrongCount = totalQuestions - correctCount

  return (
    <>
      {/* Full-screen review panel — mounts on top when "Review Answers" is clicked */}
      {showReview && (
        <TrialReviewPanel
          questions={questions}
          answers={answers}
          onBack={() => setShowReview(false)}
        />
      )}

      {/* Summary modal */}
      <div className="fixed inset-0 z-[10000] flex items-end justify-center sm:items-center p-0 sm:p-4"
        role="dialog" aria-modal="true" aria-label="Trial session complete">

        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Card */}
        <div className="relative flex w-full flex-col overflow-hidden
          rounded-t-3xl border border-border/70 bg-card shadow-2xl sm:max-w-lg sm:rounded-3xl"
          style={{ maxHeight: "93dvh" }}>

          {/* Celebration hero */}
          <div className="relative overflow-hidden border-b border-primary/15 bg-gradient-to-br from-primary/25 via-primary/10 to-card px-5 py-6 sm:px-7">
            <div className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-primary/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 left-20 h-24 w-24 rounded-full bg-cyan-400/10 blur-xl" />
            <div className="relative flex items-center justify-between gap-5">
              <div className="min-w-0">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <TrophyIcon size={25} />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Session complete</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">{accuracyVerdict(accuracy)}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground"><strong className="text-foreground">{correctCount}</strong> of {totalQuestions} answers correct</p>
              </div>
              <div
                className="grid h-28 w-28 shrink-0 place-items-center rounded-full p-[7px] shadow-xl shadow-primary/10"
                style={{ background: `conic-gradient(var(--primary) ${Math.max(0, Math.min(100, accuracy)) * 3.6}deg, var(--muted) 0deg)` }}
                aria-label={`${accuracy}% score`}
              >
                <div className="grid h-full w-full place-items-center rounded-full border border-border/60 bg-card shadow-inner">
                  <div className="text-center">
                    <span className={`block text-3xl font-black leading-none tabular-nums ${accuracyColor(accuracy)}`}>{accuracy}%</span>
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Score</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Scrollable body ──────────────────────────────────────────────── */}
          <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">

            {/* Performance details */}
            <div className="grid grid-cols-3 gap-2.5">
              <StatCard icon={<CheckIcon size={17} />} label="Correct" value={`${correctCount}`} accent="text-emerald-500" surface="border-emerald-500/20 bg-emerald-500/8" />
              <StatCard icon={<XIcon size={17} />} label="Missed" value={`${wrongCount}`} accent={wrongCount > 0 ? "text-rose-500" : "text-muted-foreground"} surface={wrongCount > 0 ? "border-rose-500/20 bg-rose-500/8" : "border-border bg-muted/30"} />
              <StatCard icon={<ClockIcon size={17} />} label="Time" value={formatTime(timeTakenSeconds)} accent="text-primary" surface="border-primary/20 bg-primary/8" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-card p-3.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">🔥 Best combo</p>
                <p className="mt-1 text-sm font-bold tabular-nums">{bestStreak > 0 ? `${bestStreak} in a row` : "No streak yet"}</p>
              </div>
              <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-card p-3.5 text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Milestone</p>
                <p className="mt-1 text-sm font-bold">{MILESTONE_LABELS[milestoneTier]}</p>
              </div>
            </div>

            {/* Review Answers button */}
            {questions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReview(true)}
                className="group flex w-full items-center justify-between gap-2 rounded-2xl border border-border
                  bg-card px-4 py-3.5 text-sm font-semibold text-foreground shadow-sm
                  transition-all hover:border-primary/30 hover:bg-primary/5 hover:shadow-md active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">📋</span>
                  Review answers
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                    {questions.length}
                  </span>
                </span>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">›</span>
              </button>
            )}

          </div>

          {/* ── Sticky CTA footer ──────────────────────────────────────────────── */}
          <div className="flex-shrink-0 space-y-2 border-t border-border bg-card px-5 py-4 sm:px-6">
            <button type="button" onClick={onReturnToDashboard}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5
                text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80">
              <LayoutDashboardIcon size={18} />
              Return to Dashboard
            </button>
            <button type="button" onClick={onRetry}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border
                bg-card px-5 py-3 text-sm font-semibold text-foreground
                transition-colors hover:bg-muted active:bg-muted/80">
              <RotateCcwIcon size={17} />
              Retry Block
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, accent, surface }: {
  icon: React.ReactNode; label: string; value: string; accent: string; surface: string
}) {
  return (
    <div className={`flex min-w-0 flex-col items-center rounded-2xl border px-2 py-3.5 text-center ${surface}`}>
      <span className={`grid h-7 w-7 place-items-center rounded-full bg-card/80 ${accent}`}>{icon}</span>
      <span className={`mt-1 text-lg font-bold leading-tight tabular-nums ${accent}`}>{value}</span>
      <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  )
}
