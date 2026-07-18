"use client"

/**
 * TrialReviewPanel — full-screen post-session answer review for Trial Mode.
 *
 * Mirrors AssessmentReview in every visual detail, extended to support:
 *  - SATA questions (correctAnswer: string[], userAnswer: string[])
 *  - The "Back to Summary" navigation button
 *
 * Rendered as a fixed overlay on top of the Grand Finale Modal.
 */

import { useState, useMemo } from "react"
import type { Question } from "@/lib/types"
import { CheckIcon, XIcon, SearchIcon } from "@/components/icons"
import { RichText } from "@/components/rich-text"
import { ChevronLeftIcon } from "@/components/icons"

// ── Types ─────────────────────────────────────────────────────────────────────

type Filter = "all" | "correct" | "incorrect"

interface Props {
  questions: Question[]
  answers: Record<string, string | string[] | null>
  onBack: () => void
  /** Optional sub-heading shown in the header (e.g. module name for profile review). */
  subtitle?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSata(q: Question): boolean {
  return Array.isArray(q.correctAnswer) && (q.correctAnswer as string[]).length > 1
}

function isAnswerCorrect(q: Question, ans: string | string[] | null): boolean {
  if (ans === null) return false
  if (isSata(q)) {
    const sel = Array.isArray(ans) ? [...ans].sort() : []
    const cor = [...(q.correctAnswer as string[])].sort()
    return sel.length === cor.length && sel.every((v, i) => v === cor[i])
  }
  return ans === (q.correctAnswer as string)
}

function isUserSelected(q: Question, opt: { id: string }, ans: string | string[] | null): boolean {
  if (ans === null) return false
  return Array.isArray(ans) ? ans.includes(opt.id) : ans === opt.id
}

function isOptionCorrect(q: Question, opt: { id: string }): boolean {
  if (isSata(q)) return (q.correctAnswer as string[]).includes(opt.id)
  return opt.id === (q.correctAnswer as string)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrialReviewPanel({ questions, answers, onBack, subtitle }: Props) {
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")

  const correctCount  = useMemo(() => questions.filter(q => isAnswerCorrect(q, answers[q.id] ?? null)).length, [questions, answers])
  const incorrectCount = useMemo(() => questions.filter(q => {
    const a = answers[q.id] ?? null
    return a !== null && !isAnswerCorrect(q, a)
  }).length, [questions, answers])

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      const ans = answers[q.id] ?? null
      const correct = isAnswerCorrect(q, ans)

      if (filter === "correct" && !correct) return false
      if (filter === "incorrect" && (correct || ans === null)) return false

      if (search.trim()) {
        const s = search.toLowerCase()
        return q.vignette.toLowerCase().includes(s) || q.subject.toLowerCase().includes(s)
      }
      return true
    })
  }, [questions, answers, filter, search])

  const filterTabs: { id: Filter; label: string; count: number }[] = [
    { id: "all",       label: "All",       count: questions.length },
    { id: "correct",   label: "Correct",   count: correctCount     },
    { id: "incorrect", label: "Incorrect", count: incorrectCount   },
  ]

  return (
    <div className="fixed inset-0 z-[10001] flex flex-col bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5
            text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeftIcon size={14} />
          Back
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-foreground truncate">Answer Review</h2>
          <p className="text-[11px] text-muted-foreground">
            {correctCount}/{questions.length} correct · {subtitle ?? "Trial Mode"}
          </p>
        </div>
      </header>

      {/* ── Search + filters ────────────────────────────────────────────────── */}
      <div className="shrink-0 flex flex-col sm:flex-row gap-2 px-4 py-3 border-b border-border bg-card/60">
        {/* Search */}
        <div className="relative flex-1">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm
              placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        {/* Filter pills */}
        <div className="flex rounded-xl border border-border bg-muted p-0.5 shrink-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors
                ${filter === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Question list ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
            <SearchIcon size={28} />
            <p className="text-sm">No questions match this filter.</p>
          </div>
        )}

        {filtered.map((q) => {
          const ans        = answers[q.id] ?? null
          const correct    = isAnswerCorrect(q, ans)
          const omitted    = ans === null
          const qNum       = questions.indexOf(q) + 1
          const sata       = isSata(q)

          return (
            <div
              key={q.id}
              className={`rounded-2xl border overflow-hidden ${
                correct ? "border-emerald-200 dark:border-emerald-800/40"
                : omitted ? "border-border"
                : "border-destructive/30"
              }`}
            >
              {/* Question header bar */}
              <div className={`flex items-center gap-3 px-4 py-2.5 ${
                correct ? "bg-emerald-50 dark:bg-emerald-900/20"
                : omitted ? "bg-muted/30"
                : "bg-destructive/5"
              }`}>
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  correct ? "bg-emerald-500 text-white"
                  : omitted ? "bg-muted border border-border"
                  : "bg-destructive text-white"
                }`}>
                  {correct
                    ? <CheckIcon size={12} />
                    : omitted
                      ? <span className="text-[10px] font-bold text-muted-foreground">–</span>
                      : <XIcon size={12} />}
                </div>
                <span className="text-xs font-semibold text-muted-foreground">Q{qNum}</span>
                <span className="text-xs text-muted-foreground">{q.subject}</span>
                {sata && (
                  <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-0.5">
                    SATA
                  </span>
                )}
                <span className={`ml-auto text-xs font-bold ${
                  correct ? "text-emerald-600 dark:text-emerald-400"
                  : omitted ? "text-muted-foreground"
                  : "text-destructive"
                }`}>
                  {correct ? "Correct" : omitted ? "Omitted" : "Incorrect"}
                </span>
              </div>

              <div className="p-4 space-y-3 bg-card">
                {/* Full vignette */}
                <RichText content={q.vignette} className="text-sm text-foreground" />

                {/* Answer options */}
                <div className="space-y-1.5">
                  {q.options.map((opt) => {
                    const userPicked  = isUserSelected(q, opt, ans)
                    const optCorrect  = isOptionCorrect(q, opt)
                    const wrongPick   = userPicked && !optCorrect

                    return (
                      <div
                        key={opt.id}
                        className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm border ${
                          optCorrect
                            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/40"
                            : wrongPick
                              ? "bg-destructive/5 border-destructive/20"
                              : "border-transparent"
                        }`}
                      >
                        {/* Option letter badge */}
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${
                          optCorrect
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : wrongPick
                              ? "border-destructive bg-destructive text-white"
                              : "border-border text-muted-foreground"
                        }`}>
                          {opt.id}
                        </span>

                        {/* Option text */}
                        <span className={`flex-1 leading-snug ${
                          optCorrect
                            ? "font-semibold text-emerald-700 dark:text-emerald-400"
                            : wrongPick
                              ? "text-destructive"
                              : "text-foreground"
                        }`}>
                          <RichText content={opt.text} className="inline" />
                          {optCorrect && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide opacity-70">
                              ✓ Correct{sata ? " choice" : ""}
                            </span>
                          )}
                          {wrongPick && (
                            <span className="ml-2 text-[10px] font-bold uppercase tracking-wide opacity-70">
                              ✗ Your answer
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-2 mt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Explanation
                    </p>
                    {q.explanation.objective && (
                      <p className="text-xs font-semibold text-foreground">{q.explanation.objective}</p>
                    )}
                    {q.explanation.details && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation.details}</p>
                    )}
                    {q.explanation.incorrectReasoning && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{q.explanation.incorrectReasoning}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
