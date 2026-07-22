"use client"

/**
 * RevisionQueueView — client component for /theory/revision-queue.
 * Fetches the user's revision queue from /api/theory/progress-data and
 * displays the questions with expandable model answers.
 */

import { useState, useEffect } from "react"
import { ChevronDownIcon, ChevronUpIcon, RotateCcwIcon, Loader2Icon } from "lucide-react"
import { TheoryAnswer } from "./TheoryAnswer"
import type { TheoryQuestion } from "@/lib/types"

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

export function RevisionQueueView() {
  const [questions, setQuestions] = useState<TheoryQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const headers = getAuthHeaders()
    fetch("/api/theory/progress-data", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setQuestions(data.revisionQuestions ?? [])
      })
      .catch(() => setError("Failed to load revision queue."))
      .finally(() => setLoading(false))
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950/30 mb-4">
          <RotateCcwIcon size={28} className="text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Revision Queue is Empty</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Questions you mark as "Needs Revision" during study sessions will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{questions.length}</span>{" "}
        {questions.length === 1 ? "question" : "questions"} flagged for revision
      </p>
      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          index={i + 1}
          question={q}
          isExpanded={expanded.has(q.id)}
          onToggle={() => toggleExpand(q.id)}
          accentColor="red"
        />
      ))}
    </div>
  )
}

// ── Shared card component ──────────────────────────────────────────────────────

interface QuestionCardProps {
  index: number
  question: TheoryQuestion
  isExpanded: boolean
  onToggle: () => void
  accentColor: "red" | "amber" | "teal"
}

export function QuestionCard({ index, question: q, isExpanded, onToggle, accentColor }: QuestionCardProps) {
  const badgeClasses: Record<string, string> = {
    red:   "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
    teal:  "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400",
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 sm:p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${badgeClasses[accentColor]}`}>
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {q.module} · {q.category}
          </p>
          <p className={`mt-1 text-sm font-medium leading-relaxed text-foreground ${isExpanded ? "" : "line-clamp-2"}`}>
            {q.prompt}
          </p>
        </div>
        <span className="shrink-0 mt-0.5 text-muted-foreground">
          {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
        </span>
      </button>

      {isExpanded && (
        <div className="border-t border-border px-4 pb-5 pt-4 sm:px-5">
          <TheoryAnswer modelAnswer={q.modelAnswer} criticalFlags={q.criticalFlags} />
        </div>
      )}
    </div>
  )
}

// ── Shared loading / error states ──────────────────────────────────────────────

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2Icon size={24} className="animate-spin text-muted-foreground" />
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <p className="text-sm font-medium text-destructive">{message}</p>
      <p className="mt-1 text-xs text-muted-foreground">Check that you are logged in and try again.</p>
    </div>
  )
}
