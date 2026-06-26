"use client"

import { useState, useEffect, useCallback } from "react"
import { useApp } from "@/contexts/app-context"
import type { LiveAssessment, Question } from "@/lib/types"
import { AssessmentExamRunner } from "@/components/assessment-exam-runner"
import { AssessmentReview } from "@/components/assessment-review"
import {
  ClipboardListIcon, ClockIcon, PlayIcon, CheckIcon, AlertTriangleIcon,
  RadioIcon, UsersIcon, TrophyIcon, RefreshCwIcon,
} from "@/components/icons"

interface AssessmentWithMeta extends LiveAssessment {
  attemptsUsed: number
  lastAttempt?: { score: number; total: number; percentage: number; submittedAt: string }
}

type Phase = "list" | "exam" | "results"

interface Result {
  score: number
  total: number
  percentage: number
  passed: boolean
  answers: Record<string, string | null>
  questions: Question[]
}

interface StoredResult {
  score: number
  total: number
  percentage: number
  passed: boolean
  answers: Record<string, string | null>
  questions: Question[]
}

function userStorageKey(assessmentId: string) {
  return `mednexus-user-exam-${assessmentId}`
}

function saveUserResult(assessmentId: string, result: StoredResult) {
  try {
    localStorage.setItem(userStorageKey(assessmentId), JSON.stringify(result))
  } catch { /* ignore */ }
}

function loadUserResult(assessmentId: string): StoredResult | null {
  try {
    const raw = localStorage.getItem(userStorageKey(assessmentId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function LiveAssessmentsScreen() {
  const { user } = useApp()
  const [assessments, setAssessments] = useState<AssessmentWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>("list")
  const [activeAssessment, setActiveAssessment] = useState<AssessmentWithMeta | null>(null)
  const [activeQuestions, setActiveQuestions] = useState<Question[]>([])
  const [result, setResult] = useState<Result | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [loadingExam, setLoadingExam] = useState<string | null>(null)
  const [storedResultIds, setStoredResultIds] = useState<Set<string>>(new Set())

  const fetchAssessments = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch("/api/assessments")
      const data = await res.json()
      const list: LiveAssessment[] = data.assessments ?? []

      const withMeta: AssessmentWithMeta[] = await Promise.all(
        list.map(async (asmt) => {
          try {
            const attRes = await fetch(`/api/assessments/${asmt.id}/attempt?userId=${user.uid}`)
            const attData = await attRes.json()
            const attempts: Array<{ score: number; total: number; submittedAt: string }> = attData.attempts ?? []
            const lastAttempt = attempts[0]
            return {
              ...asmt,
              attemptsUsed: attData.count ?? 0,
              lastAttempt: lastAttempt
                ? {
                    score: lastAttempt.score,
                    total: lastAttempt.total,
                    percentage: lastAttempt.total > 0 ? Math.round((lastAttempt.score / lastAttempt.total) * 100) : 0,
                    submittedAt: lastAttempt.submittedAt,
                  }
                : undefined,
            }
          } catch {
            return { ...asmt, attemptsUsed: 0 }
          }
        })
      )
      setAssessments(withMeta)

      // Check localStorage for stored results for assessments with prior attempts
      const ids = new Set<string>()
      for (const asmt of withMeta) {
        if (asmt.attemptsUsed > 0 && loadUserResult(asmt.id)) {
          ids.add(asmt.id)
        }
      }
      setStoredResultIds(ids)
    } catch {
      setAssessments([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchAssessments() }, [fetchAssessments])

  async function startExam(asmt: AssessmentWithMeta) {
    setLoadingExam(asmt.id)
    try {
      const res = await fetch(`/api/assessments/${asmt.id}`)
      const data = await res.json()
      setActiveQuestions(data.questions ?? [])
      setActiveAssessment(asmt)
      setPhase("exam")
    } catch {
      alert("Failed to load assessment. Please try again.")
    } finally {
      setLoadingExam(null)
    }
  }

  function handleComplete(res: Result) {
    // Persist result so the "Review" button works after navigating away
    if (activeAssessment) {
      saveUserResult(activeAssessment.id, {
        score: res.score,
        total: res.total,
        percentage: res.percentage,
        passed: res.passed,
        answers: res.answers,
        questions: res.questions,
      })
      setStoredResultIds((prev) => new Set([...prev, activeAssessment.id]))
    }
    setResult(res)
    setPhase("results")
    fetchAssessments()
  }

  function reviewFromList(asmt: AssessmentWithMeta) {
    const stored = loadUserResult(asmt.id)
    if (!stored) return
    setActiveAssessment(asmt)
    setResult(stored)
    setShowReview(true)
    setPhase("results")
  }

  // Full-screen exam
  if (phase === "exam" && activeAssessment && user) {
    return (
      <AssessmentExamRunner
        assessmentId={activeAssessment.id}
        title={activeAssessment.title}
        timeLimitMins={activeAssessment.timeLimitMins}
        passMark={activeAssessment.passMark}
        questions={activeQuestions}
        userName={user.name}
        userId={user.uid}
        isGuest={false}
        onComplete={handleComplete}
        onExit={() => setPhase("list")}
      />
    )
  }

  // Results + review
  if (phase === "results" && result && activeAssessment) {
    if (showReview) {
      return (
        <div className="mx-auto max-w-3xl py-4">
          <AssessmentReview
            questions={result.questions}
            answers={result.answers}
            score={result.score}
            total={result.total}
            percentage={result.percentage}
            passed={result.passed}
            passMark={activeAssessment.passMark}
            title={activeAssessment.title}
            userName={user?.name ?? ""}
            onClose={() => setShowReview(false)}
          />
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-md py-10 space-y-6 text-center">
        <div className={`mx-auto flex h-24 w-24 items-center justify-center rounded-3xl text-4xl font-bold ${result.passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
          {result.percentage}%
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">{result.passed ? "Congratulations!" : "Exam Complete"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.score}/{result.total} correct · Pass mark {activeAssessment.passMark}%
          </p>
          <p className={`mt-2 font-semibold ${result.passed ? "text-emerald-600" : "text-destructive"}`}>
            {result.passed ? "✓ Passed" : "✗ Did not pass"}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowReview(true)}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Review Exam
          </button>
          <button
            type="button"
            onClick={() => { setPhase("list"); setResult(null); setShowReview(false); setActiveAssessment(null) }}
            className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Back to Assessments
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <RadioIcon size={20} className="text-primary" />
            Live Assessments
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Exams published by your instructor</p>
        </div>
        <button type="button" onClick={fetchAssessments} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors" title="Refresh">
          <RefreshCwIcon size={14} />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : assessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <ClipboardListIcon size={28} />
          </div>
          <div>
            <p className="font-semibold text-foreground">No live assessments</p>
            <p className="mt-1 text-sm text-muted-foreground">Your instructor hasn't published any assessments yet.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((asmt) => {
            const triesLeft = asmt.triesAllowed - asmt.attemptsUsed
            const exhausted = triesLeft <= 0
            const hasAttempted = asmt.attemptsUsed > 0
            const hasStoredResult = storedResultIds.has(asmt.id)

            return (
              <div key={asmt.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          LIVE
                        </span>
                        <span className="text-xs text-muted-foreground">{asmt.moduleName}</span>
                      </div>
                      <h3 className="font-bold text-foreground truncate">{asmt.title}</h3>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <ClipboardListIcon size={11} /> {asmt.questionCount} questions
                        </span>
                        <span className="flex items-center gap-1">
                          <ClockIcon size={11} /> {asmt.timeLimitMins} min
                        </span>
                        <span className="flex items-center gap-1">
                          <TrophyIcon size={11} /> Pass: {asmt.passMark}%
                        </span>
                        <span className="flex items-center gap-1">
                          <UsersIcon size={11} />
                          {exhausted ? "No tries left" : `${triesLeft} tr${triesLeft === 1 ? "y" : "ies"} remaining`}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button
                        type="button"
                        disabled={exhausted || loadingExam === asmt.id}
                        onClick={() => startExam(asmt)}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors shadow-sm ${
                          exhausted
                            ? "bg-muted text-muted-foreground cursor-not-allowed"
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                        }`}
                      >
                        {loadingExam === asmt.id ? (
                          <span className="animate-pulse">Loading…</span>
                        ) : (
                          <><PlayIcon size={12} /> {hasAttempted ? "Retry" : "Start"}</>
                        )}
                      </button>

                      {/* Review button — shown while session is live and result exists */}
                      {hasStoredResult && (
                        <button
                          type="button"
                          onClick={() => reviewFromList(asmt)}
                          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <TrophyIcon size={11} /> Review Last Attempt
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Last attempt summary */}
                  {asmt.lastAttempt && (
                    <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs ${asmt.lastAttempt.percentage >= asmt.passMark ? "bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/40" : "bg-muted border border-border"}`}>
                      {asmt.lastAttempt.percentage >= asmt.passMark
                        ? <CheckIcon size={11} className="text-emerald-600 shrink-0" />
                        : <AlertTriangleIcon size={11} className="text-muted-foreground shrink-0" />
                      }
                      <span className="text-muted-foreground">
                        Last attempt: <span className="font-semibold text-foreground">{asmt.lastAttempt.percentage}%</span>
                        {" "}({asmt.lastAttempt.score}/{asmt.lastAttempt.total} correct)
                        {" "}· {asmt.attemptsUsed}/{asmt.triesAllowed} tries used
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
