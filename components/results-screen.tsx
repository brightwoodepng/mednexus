"use client"

import type { BlockResult, ProficiencyRank } from "@/lib/types"
import { CheckIcon, XIcon, EyeOffIcon, TrophyIcon, RotateCcwIcon, LayoutDashboardIcon } from "@/components/icons"

interface ResultsScreenProps {
  result: BlockResult
  moduleName: string
  onReturn: () => void
  onRetry: () => void
}

const RANK_STYLES: Record<ProficiencyRank, { text: string; ring: string; blurb: string }> = {
  Expert: { text: "text-success", ring: "text-success", blurb: "Outstanding command of this material." },
  Proficient: { text: "text-chart-1", ring: "text-chart-1", blurb: "Strong performance — keep sharpening." },
  Competent: { text: "text-warning", ring: "text-warning", blurb: "A solid base with room to grow." },
  Novice: { text: "text-destructive", ring: "text-destructive", blurb: "Review the explanations and try again." },
}

export function ResultsScreen({ result, moduleName, onReturn, onRetry }: ResultsScreenProps) {
  const rankStyle = RANK_STYLES[result.rank]
  // SVG circle geometry for the score ring.
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (result.percentage / 100) * circumference

  return (
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

      {/* Raw numbers */}
      <div className="mb-8 grid w-full grid-cols-3 gap-4">
        <StatCard label="Correct" value={result.correct} icon={<CheckIcon size={18} />} accent="text-success" />
        <StatCard label="Incorrect" value={result.incorrect} icon={<XIcon size={18} />} accent="text-destructive" />
        <StatCard label="Omitted" value={result.omitted} icon={<EyeOffIcon size={18} />} accent="text-muted-foreground" />
      </div>

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
