"use client"

import { useState, useMemo } from "react"
import type { Question } from "@/lib/types"
import { CheckIcon, XIcon, SearchIcon, TrophyIcon, AlertTriangleIcon } from "@/components/icons"

interface Props {
  questions: Question[]
  answers: Record<string, string | null>
  score: number
  total: number
  percentage: number
  passed: boolean
  passMark: number
  title: string
  userName: string
  onClose?: () => void
}

type Filter = "all" | "correct" | "incorrect" | "omitted"

export function AssessmentReview({
  questions, answers, score, total, percentage, passed, passMark, title, userName, onClose,
}: Props) {
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      const ans = answers[q.id] ?? null
      const isCorrect = ans === q.correctAnswer
      const isOmitted = ans === null

      if (filter === "correct" && !isCorrect) return false
      if (filter === "incorrect" && (isCorrect || isOmitted)) return false
      if (filter === "omitted" && !isOmitted) return false

      if (search.trim()) {
        const s = search.toLowerCase()
        return q.vignette.toLowerCase().includes(s) || q.subject.toLowerCase().includes(s)
      }
      return true
    })
  }, [questions, answers, filter, search])

  const correctCount = questions.filter((q) => answers[q.id] === q.correctAnswer).length
  const incorrectCount = questions.filter((q) => {
    const a = answers[q.id] ?? null
    return a !== null && a !== q.correctAnswer
  }).length
  const omittedCount = questions.filter((q) => (answers[q.id] ?? null) === null).length

  const filterTabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: total },
    { id: "correct", label: "Correct", count: correctCount },
    { id: "incorrect", label: "Incorrect", count: incorrectCount },
    { id: "omitted", label: "Omitted", count: omittedCount },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Score summary */}
      <div className={`shrink-0 rounded-2xl border p-5 mb-5 ${passed ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/20" : "border-destructive/30 bg-destructive/5"}`}>
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
            {passed ? <TrophyIcon size={26} /> : <AlertTriangleIcon size={26} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground truncate">{userName} · {title}</p>
            <p className={`text-3xl font-bold tabular-nums ${passed ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
              {percentage}%
            </p>
            <p className="text-sm text-muted-foreground">
              {score}/{total} correct · Pass mark {passMark}% · {passed ? "Passed ✓" : "Did not pass"}
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
              <XIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search + filter */}
      <div className="shrink-0 flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="flex rounded-xl border border-border bg-muted p-0.5 shrink-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Question list */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <SearchIcon size={28} />
            <p className="text-sm">No questions match this filter.</p>
          </div>
        )}
        {filtered.map((q, idx) => {
          const ans = answers[q.id] ?? null
          const isCorrect = ans === q.correctAnswer
          const isOmitted = ans === null
          const questionNumber = questions.indexOf(q) + 1

          return (
            <div key={q.id} className={`rounded-2xl border overflow-hidden ${isCorrect ? "border-emerald-200 dark:border-emerald-800/40" : isOmitted ? "border-border" : "border-destructive/30"}`}>
              {/* Question header */}
              <div className={`flex items-center gap-3 px-4 py-2.5 ${isCorrect ? "bg-emerald-50 dark:bg-emerald-900/20" : isOmitted ? "bg-muted/30" : "bg-destructive/5"}`}>
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isCorrect ? "bg-emerald-500 text-white" : isOmitted ? "bg-muted border border-border" : "bg-destructive text-white"}`}>
                  {isCorrect ? <CheckIcon size={12} /> : isOmitted ? <span className="text-[10px] font-bold text-muted-foreground">–</span> : <XIcon size={12} />}
                </div>
                <span className="text-xs font-semibold text-muted-foreground">Q{questionNumber}</span>
                <span className="text-xs text-muted-foreground">{q.subject}</span>
                <span className={`ml-auto text-xs font-bold ${isCorrect ? "text-emerald-600" : isOmitted ? "text-muted-foreground" : "text-destructive"}`}>
                  {isCorrect ? "Correct" : isOmitted ? "Omitted" : "Incorrect"}
                </span>
              </div>

              <div className="p-4 space-y-3 bg-card">
                {/* Vignette */}
                <p className="text-sm leading-relaxed text-foreground">{q.vignette}</p>

                {/* Options */}
                <div className="space-y-1.5">
                  {q.options.map((opt) => {
                    const isUserAnswer = ans === opt.id
                    const isRight = opt.id === q.correctAnswer
                    return (
                      <div key={opt.id} className={`flex items-start gap-2.5 rounded-lg px-3 py-2 text-sm ${
                        isRight ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/40"
                        : isUserAnswer && !isRight ? "bg-destructive/5 border border-destructive/20"
                        : "border border-transparent"
                      }`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold border ${
                          isRight ? "border-emerald-500 bg-emerald-500 text-white"
                          : isUserAnswer ? "border-destructive bg-destructive text-white"
                          : "border-border text-muted-foreground"
                        }`}>{opt.id}</span>
                        <span className={`flex-1 ${isRight ? "font-semibold text-emerald-700 dark:text-emerald-400" : isUserAnswer && !isRight ? "text-destructive" : "text-foreground"}`}>
                          {opt.text}
                          {isRight && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide opacity-70">✓ Correct</span>}
                          {isUserAnswer && !isRight && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide opacity-70">✗ Your answer</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-2 mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Explanation</p>
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
