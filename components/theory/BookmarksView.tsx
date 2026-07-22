"use client"

/**
 * BookmarksView — client component for /theory/bookmarks.
 * Fetches the user's bookmarked questions and displays them with
 * expandable model answers.
 */

import { useState, useEffect } from "react"
import { StarIcon } from "lucide-react"
import { QuestionCard, LoadingState, ErrorState } from "./RevisionQueueView"
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

export function BookmarksView() {
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
        else setQuestions(data.bookmarkedQuestions ?? [])
      })
      .catch(() => setError("Failed to load bookmarks."))
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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/30 mb-4">
          <StarIcon size={28} className="text-amber-500 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-foreground">No Bookmarks Yet</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Tap the ★ bookmark icon in the study interface header to save questions here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{questions.length}</span>{" "}
        bookmarked {questions.length === 1 ? "question" : "questions"}
      </p>
      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          index={i + 1}
          question={q}
          isExpanded={expanded.has(q.id)}
          onToggle={() => toggleExpand(q.id)}
          accentColor="amber"
        />
      ))}
    </div>
  )
}
