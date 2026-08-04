"use client"

import { useState, useEffect, use } from "react"
import type { Question, LiveAssessment } from "@/lib/types"
import { AssessmentExamRunner } from "@/components/assessment-exam-runner"
import { AssessmentReview } from "@/components/assessment-review"
import { StethoscopeIcon, ClockIcon, AlertTriangleIcon, CheckIcon, TrophyIcon, RefreshCwIcon } from "@/components/icons"
import { ThemeProvider } from "@/contexts/theme-context"
import { ThemeModal } from "@/components/theme-modal"

type Phase = "loading" | "unavailable" | "name-entry" | "exam" | "blind-review" | "results"

interface Result {
  score: number
  total: number
  percentage: number
  passed: boolean
  breakdown?: { correct: number; wrong: number; unanswered: number }
  gradingMode?: "standard" | "negative"
  answers: Record<string, string | null>
  questions: Question[]
  timeTaken?: number
  attemptsUsed?: number
}

interface HighScore {
  score: number
  total: number
  percentage: number
  passed: boolean
}

// Stored after a completed attempt — latestResult/questions optional for in-progress state
interface StoredAttempt {
  guestName: string
  guestId: string
  attemptCount: number
  triesAllowed: number
  latestResult?: {
    score: number
    total: number
    percentage: number
    passed: boolean
    breakdown?: { correct: number; wrong: number; unanswered: number }
    gradingMode?: "standard" | "negative"
    answers: Record<string, string | null>
    timeTaken?: number
  }
  highScore?: HighScore
  questions?: Question[]
  guestToken?: string
}

function attemptKey(token: string) { return `mednexus-exam-${token}` }
function sessionKey(assessmentId: string, guestId: string) {
  return `mednexus-exam-session-${assessmentId}-${guestId}`
}

function saveAttempt(token: string, data: StoredAttempt) {
  try { localStorage.setItem(attemptKey(token), JSON.stringify(data)) } catch { /* ignore */ }
}
function loadAttempt(token: string): StoredAttempt | null {
  try {
    const raw = localStorage.getItem(attemptKey(token))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

async function createGuestSession(name: string) {
  const response = await fetch("/api/auth/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, classLevel: "" }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.sessionToken) throw new Error(data.error ?? "Unable to start guest session")
  return data as { uid: string; name: string; sessionToken: string }
}

function formatTimeTaken(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m === 0) return `${s}s`
  return `${m}m ${s}s`
}

function GuestExamPageInner({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [phase, setPhase] = useState<Phase>("loading")
  const [assessment, setAssessment] = useState<LiveAssessment | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [guestName, setGuestName] = useState("")
  const [guestId, setGuestId] = useState("")
  const [guestToken, setGuestToken] = useState("")
  const [nameError, setNameError] = useState("")
  const [result, setResult] = useState<Result | null>(null)
  const [bestScore, setBestScore] = useState<HighScore | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [triesUsed, setTriesUsed] = useState(0)
  const [themeOpen, setThemeOpen] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/assessments/by-token?token=${encodeURIComponent(token)}`)
        if (!res.ok) { setPhase("unavailable"); return }
        const data = await res.json()
        if (!data.assessment || data.assessment.status !== "live") { setPhase("unavailable"); return }

        const asmt: LiveAssessment = data.assessment
        const qs: Question[] = data.questions ?? []
        setAssessment(asmt)
        setQuestions(qs)

        const stored = loadAttempt(token)
        const triesAllowed = asmt.triesAllowed ?? 1
        let serverAttemptCount = 0
        if (stored?.guestToken) {
          const attemptsResponse = await fetch(`/api/assessments/${asmt.id}/attempt`, {
            headers: { "x-guest-token": stored.guestToken },
          })
          if (attemptsResponse.ok) {
            const attempts = await attemptsResponse.json()
            serverAttemptCount = Number(attempts.count ?? 0)
            setGuestToken(stored.guestToken)
          }
        }

        // 1. Tries exhausted with a completed result → show full review
        if (stored && stored.latestResult && serverAttemptCount >= triesAllowed) {
          setGuestName(stored.guestName)
          setGuestId(stored.guestId)
          setTriesUsed(serverAttemptCount)
          setResult({ ...stored.latestResult, questions: stored.questions ?? qs })
          if (stored.highScore) setBestScore(stored.highScore)
          setPhase("results")
          return
        }

        // 2. Attempt completed but tries remain → show blind review
        if (stored && stored.latestResult && serverAttemptCount > 0 && serverAttemptCount < triesAllowed) {
          setGuestName(stored.guestName)
          setGuestId(stored.guestId)
          setTriesUsed(serverAttemptCount)
          setResult({ ...stored.latestResult, questions: stored.questions ?? qs })
          if (stored.highScore) setBestScore(stored.highScore)
          setPhase("blind-review")
          return
        }

        // 3. In-progress session (reloaded / came back) → resume exam
        if (stored?.guestId && stored.guestToken) {
          try {
            const sk = sessionKey(asmt.id, stored.guestId)
            const sessionRaw = localStorage.getItem(sk)
            if (sessionRaw) {
              const session = JSON.parse(sessionRaw)
              const elapsed = Math.floor((Date.now() - session.startedAt) / 1000)
              const remaining = Math.max(0, asmt.timeLimitMins * 60 - elapsed)
              if (remaining >= 0) {
                setGuestName(stored.guestName)
                setGuestId(stored.guestId)
                setGuestToken(stored.guestToken)
                setTriesUsed(serverAttemptCount)
                if (stored.highScore) setBestScore(stored.highScore)
                setPhase("exam")
                return
              }
            }
          } catch { /* fall through to name-entry */ }
        }

        setPhase("name-entry")
      } catch {
        setPhase("unavailable")
      }
    }
    load()
  }, [token])

  async function handleStartExam() {
    if (!guestName.trim()) { setNameError("Please enter your name to continue."); return }
    setNameError("")
    try {
      const guest = await createGuestSession(guestName.trim())
      setGuestId(guest.uid)
      setGuestName(guest.name)
      setGuestToken(guest.sessionToken)

      // Keep only a resumable display session locally; the server owns attempts.
      const existing = loadAttempt(token)
      saveAttempt(token, { guestName: guest.name, guestId: guest.uid, guestToken: guest.sessionToken, attemptCount: triesUsed, triesAllowed: assessment?.triesAllowed ?? 1, latestResult: existing?.latestResult, highScore: existing?.highScore, questions: existing?.questions })
      setPhase("exam")
    } catch (error) {
      setNameError(error instanceof Error ? error.message : "Unable to start guest session.")
    }
  }

  function handleComplete(res: Result) {
    const newAttemptCount = res.attemptsUsed ?? triesUsed + 1
    setTriesUsed(newAttemptCount)

    const existing = loadAttempt(token)
    const previousBestPct = existing?.highScore?.percentage ?? -1
    const isNewHigh = res.percentage > previousBestPct

    const newHighScore: HighScore = isNewHigh
      ? { score: res.score, total: res.total, percentage: res.percentage, passed: res.passed }
      : (existing?.highScore ?? { score: res.score, total: res.total, percentage: res.percentage, passed: res.passed })

    // Save completed attempt — highScore only updates when strictly better
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
        breakdown: res.breakdown,
        gradingMode: res.gradingMode,
        answers: res.answers,
        timeTaken: res.timeTaken,
      },
      highScore: newHighScore,
      questions: res.questions,
      guestToken,
    })

    setResult(res)
    setBestScore(newHighScore)

    const triesAllowed = assessment?.triesAllowed ?? 1
    // If more attempts remain, go to blind review — full review gated until exhausted
    if (newAttemptCount < triesAllowed) {
      setPhase("blind-review")
    } else {
      setPhase("results")
    }
  }

  async function handleRetake() {
    setResult(null)
    setShowReview(false)
    setNameError("")

    if (guestName.trim() && guestToken) {
      setPhase("exam")
    } else {
      setGuestId("")
      setPhase("name-entry")
    }
  }

  const triesAllowed = assessment?.triesAllowed ?? 1
  const triesRemaining = Math.max(0, triesAllowed - triesUsed)
  const triesExhausted = triesUsed >= triesAllowed

  const themeOverlay = (
    <>
      <button
        type="button"
        onClick={() => setThemeOpen(true)}
        className="fixed right-4 top-4 z-40 flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
          <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        Appearance
      </button>
      <ThemeModal open={themeOpen} onClose={() => setThemeOpen(false)} />
    </>
  )

  // ── Loading ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <StethoscopeIcon size={24} />
            </div>
            <p className="text-sm">Loading assessment…</p>
          </div>
        </div>
        {themeOverlay}
      </>
    )
  }

  // ── Unavailable ──────────────────────────────────────────────────────────
  if (phase === "unavailable") {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-sm sm:max-w-md text-center space-y-4">
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
        {themeOverlay}
      </>
    )
  }

  // ── Exam ─────────────────────────────────────────────────────────────────
  if (phase === "exam" && assessment && questions.length > 0) {
    return (
      <AssessmentExamRunner
        assessmentId={assessment.id}
        title={assessment.title}
        timeLimitMins={assessment.timeLimitMins}
        passMark={assessment.passMark}
        questions={questions}
        userName={guestName.trim() || "Guest"}
        userId={guestId}
        authHeader={{ key: "x-guest-token", value: guestToken }}
        onComplete={handleComplete}
      />
    )
  }

  // ── Blind Review ─────────────────────────────────────────────────────────
  // Shown after each attempt when tries remain — score and time only, no vignettes
  if (phase === "blind-review" && result && assessment) {
    return (
      <>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm sm:max-w-md space-y-5">

          {/* Score badge */}
          <div className="text-center">
            <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-4xl font-bold ${result.passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
              {result.percentage}%
            </div>
            <h1 className="text-xl font-bold text-foreground">Attempt {triesUsed} Complete</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.score}/{result.total} points
            </p>
            <p className={`mt-1.5 text-sm font-semibold ${result.passed ? "text-emerald-600" : "text-destructive"}`}>
              {result.passed ? "✓ Passed" : "✗ Did not pass"}
            </p>
            {result.breakdown && <p className="mt-2 text-xs text-muted-foreground">{result.breakdown.correct} correct · {result.breakdown.wrong} wrong · {result.breakdown.unanswered} unanswered</p>}
          </div>

          {/* Stats */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Candidate</span>
              <span className="font-medium text-foreground">{guestName.trim()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Score</span>
              <span className="font-bold text-foreground">{result.percentage}%</span>
            </div>
            {result.timeTaken != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time taken</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <ClockIcon size={12} />
                  {formatTimeTaken(result.timeTaken)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Attempts used</span>
              <span className="font-medium text-foreground">{triesUsed} / {triesAllowed}</span>
            </div>
          </div>

          {/* Blind warning — the key UX message */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 p-3.5 dark:border-amber-800/40 dark:bg-amber-900/20">
            <AlertTriangleIcon size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Answers and detailed vignettes will remain hidden until all{" "}
              <strong>{triesAllowed} attempts</strong> are exhausted. You have{" "}
              <strong>{triesRemaining} attempt{triesRemaining === 1 ? "" : "s"}</strong> remaining.
            </p>
          </div>

          {/* Retake */}
          <button
            type="button"
            onClick={handleRetake}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <RefreshCwIcon size={14} />
            Retake Exam
            <span className="text-xs opacity-75">({triesRemaining} attempt{triesRemaining === 1 ? "" : "s"} left)</span>
          </button>

          <p className="text-center text-xs text-muted-foreground">Powered by MedNexus</p>
        </div>
      </div>
      {themeOverlay}
      </>
    )
  }

  // ── Results (tries exhausted — full review unlocked) ─────────────────────
  if (phase === "results" && result && assessment) {
    // Show full AssessmentReview with vignettes
    if (showReview) {
      return (
        <>
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
          {themeOverlay}
        </>
      )
    }

    // Determine which score to highlight — best score may differ from last attempt
    const displayScore = bestScore ?? { score: result.score, total: result.total, percentage: result.percentage, passed: result.passed }
    const showBestScoreBadge = bestScore && bestScore.percentage !== result.percentage

    return (
      <>
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm sm:max-w-md space-y-5">
          <div className="text-center">
            <div className={`mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-4xl font-bold ${displayScore.passed ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
              {displayScore.percentage}%
            </div>
            <h1 className="text-xl font-bold text-foreground">
              {displayScore.passed ? "Congratulations!" : "All Attempts Used"}
            </h1>
            {showBestScoreBadge ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Best: {displayScore.score}/{displayScore.total} · Last attempt: {result.percentage}%
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {displayScore.score}/{displayScore.total} points · Pass mark {assessment.passMark}%
              </p>
            )}
            <p className={`mt-2 text-sm font-semibold ${displayScore.passed ? "text-emerald-600" : "text-destructive"}`}>
              {displayScore.passed ? "✓ Passed" : "✗ Did not pass"}
            </p>
            {result.breakdown && <p className="mt-2 text-xs text-muted-foreground">{result.breakdown.correct} correct · {result.breakdown.wrong} wrong · {result.breakdown.unanswered} unanswered</p>}
          </div>

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
              <span className="text-muted-foreground">Best score</span>
              <span className="font-bold text-foreground">{displayScore.percentage}%</span>
            </div>
            {triesAllowed > 1 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Attempts used</span>
                <span className="font-medium text-destructive">
                  {triesUsed} / {triesAllowed}
                </span>
              </div>
            )}
            {result.timeTaken != null && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last attempt time</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <ClockIcon size={12} />
                  {formatTimeTaken(result.timeTaken)}
                </span>
              </div>
            )}
          </div>

          {/* Review vignettes — strictly gated until all tries are exhausted */}
          {triesExhausted && (
            <button
              type="button"
              onClick={() => setShowReview(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <TrophyIcon size={15} /> Review Answers & Vignettes
            </button>
          )}

          <p className="text-center text-xs text-muted-foreground">Powered by MedNexus</p>
        </div>
      </div>
      {themeOverlay}
      </>
    )
  }

  // ── Name entry ────────────────────────────────────────────────────────────
  return (
    <>
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm sm:max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <StethoscopeIcon size={26} />
          </div>
          <h1 className="text-xl font-bold text-foreground">{assessment?.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">MedNexus Live Assessment</p>
        </div>

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
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Grading</span>
            <span className="text-right font-semibold text-foreground">{assessment?.gradingMode === "negative" ? "+1 correct · −1 wrong · 0 unanswered" : "+1 correct · 0 wrong · 0 unanswered"}</span>
          </div>
          {triesAllowed > 1 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Attempts allowed</span>
              <span className="font-semibold text-foreground">{triesAllowed}</span>
            </div>
          )}
          {triesUsed > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Attempts used</span>
              <span className="font-semibold text-foreground">{triesUsed} / {triesAllowed}</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/20">
          <AlertTriangleIcon size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            The timer runs continuously — you can leave and return as needed, but time keeps counting down. The exam auto-submits when the timer reaches zero.
          </p>
        </div>

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
          <button type="button" onClick={handleStartExam}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
            <CheckIcon size={15} /> {triesUsed > 0 ? `Begin Attempt ${triesUsed + 1}` : "Begin Exam"}
          </button>
        </div>
      </div>
    </div>
    {themeOverlay}
    </>
  )
}

export default function GuestExamPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <ThemeProvider>
      <GuestExamPageInner params={params} />
    </ThemeProvider>
  )
}
