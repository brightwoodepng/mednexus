"use client"

import { useState, useEffect } from "react"
import type { BlockResult, ProficiencyRank, Question, QuizMode } from "@/lib/types"
import { CheckIcon, XIcon, EyeOffIcon, TrophyIcon, RotateCcwIcon, LayoutDashboardIcon } from "@/components/icons"
import { TrialReviewPanel } from "@/components/trial-review-panel"

interface ResultsScreenProps {
  result: BlockResult
  moduleName: string
  mode?: QuizMode
  questions?: Question[]
  answers?: Record<string, string | string[] | null>
  earnedNP?: number
  onReturn: () => void
  onRetry: () => void
}

// ── Bounty counting animation (exam mode) ─────────────────────────────────────
function BountyCountup({ target }: { target: number }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (target === 0) return
    const steps    = 50
    const duration = 1800
    const interval = duration / steps
    let step = 0
    const t = setInterval(() => {
      step++
      setCount(Math.round((step / steps) * target))
      if (step >= steps) clearInterval(t)
    }, interval)
    return () => clearInterval(t)
  }, [target])
  return <span className="tabular-nums">{count.toLocaleString()}</span>
}

const RANK_STYLES: Record<ProficiencyRank, { text: string; ring: string; blurb: string }> = {
  Expert: { text: "text-success", ring: "text-success", blurb: "Outstanding command of this material." },
  Proficient: { text: "text-chart-1", ring: "text-chart-1", blurb: "Strong performance — keep sharpening." },
  Competent: { text: "text-warning", ring: "text-warning", blurb: "A solid base with room to grow." },
  Novice: { text: "text-destructive", ring: "text-destructive", blurb: "Review the explanations and try again." },
}

export function ResultsScreen({ result, moduleName, mode, questions, answers, earnedNP, onReturn, onRetry }: ResultsScreenProps) {
  const [showReview, setShowReview] = useState(false)
  const rankStyle = RANK_STYLES[result.rank]
  // SVG circle geometry for the score ring.
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (result.percentage / 100) * circumference

  const canReview = mode === "trial" && questions && questions.length > 0 && answers

  return (
    <>
      {/* Full-screen answer review — trial mode only */}
      {showReview && canReview && (
        <TrialReviewPanel
          questions={questions}
          answers={answers}
          onBack={() => setShowReview(false)}
        />
      )}

      <div className="mx-auto flex max-w-2xl flex-col items-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
          <TrophyIcon size={14} />
          Block Complete · {moduleName}
        </div>
        <h1 className="mb-8 text-2xl font-semibold tracking-tight">Your Proficiency</h1>

        {/* Circular score graphic */}
        <div className="relative mb-6 flex h-52 w-52 items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
            <circle cx="100" cy="100" r={radius} fill="none" stroke="var(--muted)" strokeWidth="14" />
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={`${rankStyle.ring} transition-all duration-1000 ease-out`}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-5xl font-semibold tabular-nums">{result.percentage}%</span>
            <span className={`mt-1 text-sm font-semibold ${rankStyle.text}`}>{result.rank}</span>
          </div>
        </div>

        <p className="mb-8 text-center text-sm text-muted-foreground text-pretty">{rankStyle.blurb}</p>

        {/* Exam Bounty — counting animation */}
        {mode === "exam" && earnedNP !== undefined && earnedNP > 0 && (
          <div className="mb-6 w-full rounded-2xl border border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/20 p-5 text-center">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              🏆 Bounty Earned
            </p>
            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
              +<BountyCountup target={earnedNP} /> NP
            </p>
          </div>
        )}

        {/* Raw numbers */}
        <div className="mb-8 grid w-full grid-cols-3 gap-4">
          <StatCard label="Correct" value={result.correct} icon={<CheckIcon size={18} />} accent="text-success" />
          <StatCard label="Incorrect" value={result.incorrect} icon={<XIcon size={18} />} accent="text-destructive" />
          <StatCard label="Omitted" value={result.omitted} icon={<EyeOffIcon size={18} />} accent="text-muted-foreground" />
        </div>

        {/* Review Answers — trial mode only */}
        {canReview && (
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="mb-4 flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">📋</span>
              Review Answers
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                {questions.length}
              </span>
            </span>
            <span className="text-muted-foreground">›</span>
          </button>
        )}

        {/* Actions */}
        <div className="flex w-full flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onRetry}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <RotateCcwIcon size={18} />
            Retry Block
          </button>
          <button
            type="button"
            onClick={onReturn}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <LayoutDashboardIcon size={18} />
            Return to Dashboard
          </button>
        </div>
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string
  value: number
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-4 shadow-sm">
      <span className={`mb-2 inline-flex rounded-lg bg-muted p-2 ${accent}`}>{icon}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <span className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  )
}
