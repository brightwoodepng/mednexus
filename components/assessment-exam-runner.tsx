"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Question } from "@/lib/types"
import {
  ClockIcon, CheckIcon, XIcon, ChevronLeftIcon, ChevronRightIcon,
  AlertTriangleIcon, FlagIcon,
} from "@/components/icons"

interface Props {
  assessmentId: string
  title: string
  timeLimitMins: number
  passMark: number
  questions: Question[]
  userName: string
  userId: string
  isGuest?: boolean
  onComplete: (result: {
    score: number
    total: number
    percentage: number
    passed: boolean
    answers: Record<string, string | null>
    questions: Question[]
  }) => void
  onExit?: () => void
}

export function AssessmentExamRunner({
  assessmentId, title, timeLimitMins, passMark, questions,
  userName, userId, isGuest = false, onComplete, onExit,
}: Props) {
  const totalSecs = timeLimitMins * 60
  const [timeLeft, setTimeLeft] = useState(totalSecs)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | null>>({})
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showNav, setShowNav] = useState(false)
  const submittedRef = useRef(false)

  const submitExam = useCallback(async (finalAnswers: Record<string, string | null>) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)

    let score = 0
    for (const q of questions) {
      if (finalAnswers[q.id] === q.correctAnswer) score++
    }
    const total = questions.length
    const percentage = total ? Math.round((score / total) * 100) : 0

    try {
      await fetch(`/api/assessments/${assessmentId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName, isGuest, answers: finalAnswers }),
      })
    } catch { /* swallow — result still shown locally */ }

    setSubmitted(true)
    setSubmitting(false)
    onComplete({ score, total, percentage, passed: percentage >= passMark, answers: finalAnswers, questions })
  }, [assessmentId, questions, userId, userName, isGuest, passMark, onComplete])

  // Timer countdown
  useEffect(() => {
    if (submitted) return
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t)
          submitExam(answers)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [submitted, submitExam, answers])

  // Session enforcement — auto-submit on tab hide or page unload
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && !submittedRef.current) {
        submitExam(answers)
      }
    }
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current) {
        submitExam(answers)
        e.preventDefault()
        e.returnValue = ""
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [answers, submitExam])

  function selectAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
  }

  const q = questions[currentIdx]
  const answered = Object.values(answers).filter((v) => v !== null && v !== undefined).length
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timeCritical = timeLeft <= 60
  const timeWarning = timeLeft <= 300 && timeLeft > 60

  if (!q) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{userName} · {title}</p>
          <p className="text-sm font-semibold text-foreground">
            Q{currentIdx + 1} of {questions.length}
          </p>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:flex flex-1 max-w-xs items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(answered / questions.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{answered}/{questions.length}</span>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${
          timeCritical ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
          : timeWarning ? "border-amber-400/40 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
          : "border-border bg-muted text-foreground"
        }`}>
          <ClockIcon size={13} />
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>

        {/* Nav grid toggle */}
        <button
          type="button"
          onClick={() => setShowNav((v) => !v)}
          className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted text-xs font-bold text-muted-foreground hover:bg-muted/80 transition-colors"
          title="Question navigator"
        >
          ⊞
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main question area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Vignette */}
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">Q{currentIdx + 1}</span>
                <span className="text-xs text-muted-foreground">{q.subject}</span>
              </div>
              <p className="text-base leading-relaxed text-foreground">{q.vignette}</p>
            </div>

            {/* Options */}
            <div className="space-y-2.5">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => selectAnswer(q.id, opt.id)}
                    className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      selected
                        ? "border-primary bg-primary/8 shadow-sm ring-1 ring-primary/20"
                        : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                    }`}>
                      {opt.id}
                    </span>
                    <span className="text-sm leading-relaxed text-foreground">{opt.text}</span>
                  </button>
                )
              })}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon size={15} /> Previous
              </button>

              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Next <ChevronRightIcon size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting || submitted}
                  onClick={() => submitExam(answers)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : <><CheckIcon size={14} /> Submit Exam</>}
                </button>
              )}
            </div>

            {/* Submit shortcut on any question */}
            {currentIdx < questions.length - 1 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={submitting || submitted}
                  onClick={() => submitExam(answers)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
                >
                  Submit exam early ({answered} of {questions.length} answered)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Question Navigator panel */}
        {showNav && (
          <div className="hidden sm:flex w-52 shrink-0 flex-col border-l border-border bg-muted/30 p-3 overflow-y-auto">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Navigator</p>
            <div className="grid grid-cols-5 gap-1">
              {questions.map((question, idx) => {
                const ans = answers[question.id]
                const isAnswered = ans !== undefined && ans !== null
                const isCurrent = idx === currentIdx
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                      isCurrent ? "bg-primary text-primary-foreground shadow-sm"
                      : isAnswered ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-background border border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/30" /> Answered ({answered})
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="h-3 w-3 rounded border border-border bg-background" /> Unanswered ({questions.length - answered})
              </div>
            </div>

            <div className="mt-auto pt-4">
              <button
                type="button"
                disabled={submitting || submitted}
                onClick={() => submitExam(answers)}
                className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Exam"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Warning banner */}
      {timeCritical && (
        <div className="shrink-0 flex items-center justify-center gap-2 bg-destructive/10 border-t border-destructive/20 px-4 py-2 text-xs font-semibold text-destructive">
          <AlertTriangleIcon size={13} /> Less than 1 minute remaining — exam will auto-submit!
        </div>
      )}
    </div>
  )
}
