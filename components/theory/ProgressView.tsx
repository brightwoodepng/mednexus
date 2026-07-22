"use client"

/**
 * ProgressView — client component for /theory/progress.
 * Displays the user's Theory Vault study statistics.
 */

import { useEffect, useState } from "react"
import { StarIcon, RotateCcwIcon, FileTextIcon, CheckCircleIcon } from "lucide-react"
import { LoadingState, ErrorState } from "./RevisionQueueView"

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const guest = localStorage.getItem("mednexus-guest-token")
    if (guest) return { "x-guest-token": guest }
    const user = localStorage.getItem("mednexus-user-token")
    if (user) return { "x-session-token": user }
  } catch { /* ignore */ }
  return {}
}

interface Stats {
  bookmarks: number
  revision:  number
  notes:     number
  answered:  number
}

interface StatCardProps {
  label:    string
  value:    number
  icon:     React.ReactNode
  color:    string
  bgColor:  string
  description: string
}

function StatCard({ label, value, icon, color, bgColor, description }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${bgColor}`}>
        <span className={color}>{icon}</span>
      </div>
      <p className="text-3xl font-extrabold text-foreground">{value}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

export function ProgressView() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const headers = getAuthHeaders()
    fetch("/api/theory/progress-data", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setStats(data.stats ?? { bookmarks: 0, revision: 0, notes: 0, answered: 0 })
      })
      .catch(() => setError("Failed to load progress."))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />
  if (!stats) return null

  const statCards: StatCardProps[] = [
    {
      label:       "Total Prompts Answered",
      value:       stats.answered,
      icon:        <CheckCircleIcon size={24} />,
      color:       "text-emerald-600 dark:text-emerald-400",
      bgColor:     "bg-emerald-50 dark:bg-emerald-900/30",
      description: "Questions you've self-rated in any study session",
    },
    {
      label:       "Bookmarked Questions",
      value:       stats.bookmarks,
      icon:        <StarIcon size={24} />,
      color:       "text-amber-600 dark:text-amber-400",
      bgColor:     "bg-amber-50 dark:bg-amber-900/30",
      description: "Questions saved for easy reference",
    },
    {
      label:       "Needs Revision",
      value:       stats.revision,
      icon:        <RotateCcwIcon size={24} />,
      color:       "text-red-600 dark:text-red-400",
      bgColor:     "bg-red-50 dark:bg-red-900/30",
      description: "Questions queued for another review pass",
    },
    {
      label:       "Saved Notes",
      value:       stats.notes,
      icon:        <FileTextIcon size={24} />,
      color:       "text-teal-600 dark:text-teal-400",
      bgColor:     "bg-teal-50 dark:bg-teal-900/30",
      description: "Personal annotations written during study",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Tips */}
      <div className="rounded-2xl border border-teal-200/60 bg-teal-50/60 p-5 dark:border-teal-800/30 dark:bg-teal-950/20">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
          Study Tips
        </p>
        <ul className="space-y-2">
          {[
            "Rate every question honestly — 'Needs Revision' sends it to your revision queue.",
            "Use bookmarks for high-yield questions you want to revisit quickly.",
            "Notes are great for personal mnemonics or connecting concepts to your own experiences.",
            "Work through your Revision Queue regularly until all items are rated 'Nailed it'.",
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500 dark:bg-teal-400" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {stats.answered === 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Start a study session from Browse to populate your progress stats.
        </p>
      )}
    </div>
  )
}
