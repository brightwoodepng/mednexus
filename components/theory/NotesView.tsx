"use client"

/**
 * NotesView — client component for /theory/notes.
 * Shows all theory questions where the user has saved a personal note.
 */

import { useState, useEffect } from "react"
import { FileTextIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { LoadingState, ErrorState } from "./RevisionQueueView"
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

interface NoteEntry {
  questionId: string
  question: TheoryQuestion | null
  note: string
}

export function NotesView() {
  const [entries, setEntries] = useState<NoteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const headers = getAuthHeaders()
    fetch("/api/theory/progress-data", { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setEntries(data.noteEntries ?? [])
      })
      .catch(() => setError("Failed to load notes."))
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

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/30 mb-4">
          <FileTextIcon size={28} className="text-teal-600 dark:text-teal-400" />
        </div>
        <h2 className="text-lg font-bold text-foreground">No Notes Yet</h2>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Open the 📝 note drawer in the study interface to write personal notes on any question.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Notes on <span className="font-semibold text-foreground">{entries.length}</span>{" "}
        {entries.length === 1 ? "question" : "questions"}
      </p>

      {entries.map((entry, i) => {
        const q = entry.question
        const isExpanded = expanded.has(entry.questionId)
        return (
          <div key={entry.questionId} className="overflow-hidden rounded-2xl border border-border bg-card">
            <button
              type="button"
              onClick={() => toggleExpand(entry.questionId)}
              className="flex w-full items-start gap-3 p-4 sm:p-5 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="mt-0.5 shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {q && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {q.module} · {q.category}
                  </p>
                )}
                <p className="mt-1 text-sm font-medium leading-relaxed text-foreground line-clamp-2">
                  {q?.prompt ?? `Question ID: ${entry.questionId}`}
                </p>
                {/* Note preview */}
                <p className="mt-2 line-clamp-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  📝 {entry.note}
                </p>
              </div>
              <span className="shrink-0 mt-0.5 text-muted-foreground">
                {isExpanded ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-4 pb-5 pt-4 sm:px-5 space-y-4">
                {/* Full note */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
                    Your Note
                  </p>
                  <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-sm leading-relaxed text-foreground dark:border-amber-800/30 dark:bg-amber-950/20">
                    {entry.note}
                  </div>
                </div>
                {/* Full prompt */}
                {q && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Question
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">{q.prompt}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
