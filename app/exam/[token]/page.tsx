"use client"

import { useState, useEffect, use } from "react"
import type { Question, LiveAssessment } from "@/lib/types"
import { AssessmentExamRunner } from "@/components/assessment-exam-runner"
import { AssessmentReview } from "@/components/assessment-review"
import { StethoscopeIcon, ClockIcon, AlertTriangleIcon, CheckIcon, TrophyIcon, RefreshCwIcon } from "@/components/icons"

type Phase = "loading" | "unavailable" | "name-entry" | "exam" | "results"

interface Result {
  score: number
  total: number
  percentage: number
  passed: boolean
  answers: Record<string, string | null>
  questions: Question[]
}

interface StoredAttempt {
  guestName: string
  guestId: string
  attemptCount: number
  triesAllowed: number
  latestResult: {
    score: number
    total: number
    percentage: number
    passed: boolean
    answers: Record<string, string | null>
  }
  questions: Question[]
}

function storageKey(token: string) {
  return `mednexus-exam-${token}`
}

function saveAttempt(token: string, stored: StoredAttempt) {
  try {
    localStorage.setItem(storageKey(token), JSON.stringify(stored))
  } catch { /* storage may be unavailable */ }
}

function loadAttempt(token: string): StoredAttempt | null {
  try {
    const raw = localStorage.getItem(storageKey(token))
    if (!raw) return null
    return JSON.parse(raw) as StoredAttempt
  } catch {
    return null
  }
}

export default function GuestExamPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [phase, setPhase] = useState<Phase>("loading")
  const [assessment, setAssessment] = useState<LiveAssessment | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [guestName, setGuestName] = useState("")
  const [guestId, setGuestId] = useState("")
  const [nameError, setNameError] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [triesUsed, setTriesUsed] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/assessments/by-token?token=${encodeURIComponent(token)}`)
        if (!res.ok) { setPhase("unavailable"); return }
        const data = await res.json()
        if (!data.assessment || data.assessment.status !== "live") { setPhase("unavailable"); return }

        setAssessment(data.assessment)
        setQuestions(data.questions ?? [])

        // Check localStorage for a previous attempt by this guest
        const stored = loadAttempt(token)
        if (stored) {
          setGuestName(stored.guestName)
          setGuestId(stored.guestId)
          setTriesUsed(stored.attemptCount)

          const triesAllowed = data.assessment.triesAllowed ?? 1

          if (stored.attemptCount >= triesAllowed) {
            // All tries exhausted — route directly to review mode
            setResult({
              ...stored.latestResult,
              questions: stored.questions,
            })
            setPhase("results")
            return
          }
        }

        setPhase("name-entry")
      } catch {
        setPhase("unavailable")
      }
    }
    load()
  }, [token])

  function handleStartExam() {
    if (!guestName.trim()) { setNameError("Please enter your name to continue."); return }
    setNameError("")
    const id = `guest-${guestName.trim().toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`
    setGuestId(id)
    setPhase("exam")
  }

  function handleComplete(res: Result) {
    const newAttemptCount = triesUsed + 1
    setTriesUsed(newAttemptCount)

    // Persist attempt to localStorage so revisiting the link goes to review
    saveAttempt(token, {
      guestName: guestName.trim(),
      guestId,
      attemptCount: newAttemptCount,
      triesAllowed: assessment?.triesAllowed ?? 1,
      latestResult: {
        score: res.score,
        total: res.total,
        percentage: res.percentage,
        passed: res.passed,
        answers: res.answers,
      },
      questions: res.questions,
    })

    setResult(res)
    setPhase("results")
  }

  function handleRetake() {
    setResult(null)
    setShowReview(false)
    setGuestName("")
    setGuestId("")
    setNameError("")
    setPhase("name-entry")
  }

  const triesAllowed = assessment?.triesAllowed ?? 1
  const triesRemaining = Math.max(0, triesAllowed - triesUsed)
  const triesExhausted = triesUsed >= triesAllowed

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <StethoscopeIcon size={24} />
          </div>
          <p className="text-sm">Loading assessment…</p>
        </div>
      </div>
    )
  }

  if (phase === "unavailable") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <AlertTriangleIcon size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Assessment Unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This assessment link is no longer active. Contact your instructor for more information.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (phase === "exam" && assessment && questions.length > 0) {
    return (
      <AssessmentExamRunner
        assessmentId={assessment.id}
        title={assessment.title}
        timeLimitMins={assessment.timeLimitMins}
        passMark={assessment.passMark}
        questions={questions}
        userName={guestName.trim()}
        userId={guestId}
        isGuest={true}
        onComplete={handleComplete}
      />
    )
  }

  if (phase === "results" && result && assessment) {
    if (showReview) {
      return (
        <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <AssessmentReview
              questions={result.questions}
              answers={result.answers}
              score={result.score}
              total={result.total}
              percentage={result.percentage}
              passed={result.passed}
              passMark={assessment.passMark}
              title={assessment.title}
              userName={guestName.trim()}
              onClose={() => setShowReview(false)}
            />
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-5">
          {/* Score */}
          <div className="text-center">
            <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-4xl font-bold ${result.passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
              {result.percentage}%
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {result.passed ? "Congratulations!" : "Exam Complete"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.score} of {result.total} correct · Pass mark {assessment.passMark}%
            </p>
            <p className={`mt-2 text-sm font-semibold ${result.passed ? "text-emerald-600" : "text-destructive"}`}>
              {result.passed ? "✓ Passed" : "✗ Did not pass"}
            </p>
          </div>

          {/* Details card */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Candidate</span>
              <span className="font-medium text-foreground">{guestName.trim()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Assessment</span>
              <span className="font-medium text-foreground truncate max-w-40">{assessment.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Score</span>
              <span className="font-bold text-foreground">{result.percentage}%</span>
            </div>
            {triesAllowed > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Attempts used</span>
                <span className={`font-medium ${triesExhausted ? "text-destructive" : "text-foreground"}`}>
                  {triesUsed} / {triesAllowed}
                </span>
              </div>
            )}
          </div>

          {/* Tries exhausted notice */}
          {triesExhausted && triesAllowed > 1 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20">
              <AlertTriangleIcon size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                You have used all {triesAllowed} allowed attempts. You can review your answers below.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <TrophyIcon size={15} /> Review Exam
            </button>

            {/* Retake button — only if tries remaining */}
            {!triesExhausted && (
              <button
                type="button"
                onClick={handleRetake}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCwIcon size={14} />
                Retake Exam
                {triesAllowed > 1 && (
                  <span className="text-xs text-muted-foreground">({triesRemaining} attempt{triesRemaining === 1 ? "" : "s"} left)</span>
                )}
              </button>
            )}
          </div>

          <p className="text-center text-xs text-muted-foreground">Powered by MedNexus</p>
        </div>
      </div>
    )
  }

  // Name entry phase
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <StethoscopeIcon size={26} />
          </div>
          <h1 className="text-xl font-bold text-foreground">{assessment?.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">MedNexus Live Assessment</p>
        </div>

        {/* Exam info */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Questions</span>
            <span className="font-semibold text-foreground">{assessment?.questionCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Time limit</span>
            <span className="font-semibold text-foreground flex items-center gap-1">
              <ClockIcon size={12} /> {assessment?.timeLimitMins} minutes
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Pass mark</span>
            <span className="font-semibold text-foreground">{assessment?.passMark}%</span>
          </div>
          {triesAllowed > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Attempts allowed</span>
              <span className="font-semibold text-foreground">{triesAllowed}</span>
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20">
          <AlertTriangleIcon size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Once started, the timer cannot be paused. Closing or leaving this tab will auto-submit your exam.
          </p>
        </div>

        {/* Name form */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Your Full Name
            </label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => { setGuestName(e.target.value); setNameError("") }}
              onKeyDown={(e) => e.key === "Enter" && handleStartExam()}
              placeholder="Dr. Jane Doe"
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
            {nameError && <p className="mt-1 text-xs text-destructive">{nameError}</p>}
          </div>
          <button
            type="button"
            onClick={handleStartExam}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <CheckIcon size={15} /> Begin Exam
          </button>
        </div>
      </div>
    </div>
  )
}
