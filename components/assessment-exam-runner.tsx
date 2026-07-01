"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import type { Question } from "@/lib/types"
import { THEMES, type ThemeId } from "@/lib/themes"
import {
  ClockIcon, CheckIcon, XIcon, ChevronLeftIcon, ChevronRightIcon,
  AlertTriangleIcon, FlagIcon, CalculatorIcon, PaletteIcon,
} from "@/components/icons"

// ── Types ────────────────────────────────────────────────────────────────────
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

// ── Session helpers ───────────────────────────────────────────────────────────
interface ExamSession {
  startedAt: number
  answers: Record<string, string | null>
  flagged: string[]
}

function makeSessionKey(assessmentId: string, userId: string) {
  return `mednexus-exam-session-${assessmentId}-${userId}`
}

function readSession(key: string): ExamSession | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null
    return raw ? (JSON.parse(raw) as ExamSession) : null
  } catch {
    return null
  }
}

function writeSession(key: string, session: ExamSession) {
  try { localStorage.setItem(key, JSON.stringify(session)) } catch { /* ignore */ }
}

function clearSession(key: string) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

function calcRemaining(startedAt: number, totalSecs: number): number {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  return Math.max(0, totalSecs - elapsed)
}

// ── Calculator ────────────────────────────────────────────────────────────────
function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState("0")
  const [memory, setMemory] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [expression, setExpression] = useState("")

  function inputDigit(digit: string) {
    if (waiting) { setDisplay(digit); setWaiting(false) }
    else setDisplay(display === "0" ? digit : display + digit)
  }
  function inputDecimal() {
    if (waiting) { setDisplay("0."); setWaiting(false); return }
    if (!display.includes(".")) setDisplay(display + ".")
  }
  function calculate(a: number, b: number, op: string): number {
    if (op === "+") return a + b
    if (op === "−") return a - b
    if (op === "×") return a * b
    if (op === "÷") return b !== 0 ? a / b : 0
    return b
  }
  function handleOperator(op: string) {
    const val = parseFloat(display)
    if (memory !== null && !waiting) {
      const result = calculate(memory, val, operator!)
      setDisplay(String(result)); setMemory(result); setExpression(`${result} ${op}`)
    } else { setMemory(val); setExpression(`${val} ${op}`) }
    setOperator(op); setWaiting(true)
  }
  function handleEquals() {
    if (operator === null || memory === null) return
    const val = parseFloat(display)
    const result = parseFloat(calculate(memory, val, operator).toPrecision(10))
    setDisplay(String(result)); setExpression(`${memory} ${operator} ${val} =`)
    setMemory(null); setOperator(null); setWaiting(true)
  }
  function handleClear() { setDisplay("0"); setMemory(null); setOperator(null); setWaiting(false); setExpression("") }
  function handleBackspace() { if (!waiting) setDisplay(display.length > 1 ? display.slice(0, -1) : "0") }
  function handleNegate() { setDisplay(String(parseFloat(display) * -1)) }
  function handlePercent() { setDisplay(String(parseFloat(display) / 100)) }

  const btn = (label: string, action: () => void, style = "") => (
    <button key={label} type="button" onClick={action}
      className={`flex h-10 items-center justify-center rounded-xl text-sm font-semibold transition-colors active:scale-95 ${style}`}>
      {label}
    </button>
  )

  return (
    <div className="fixed bottom-20 right-4 z-[70] w-64 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Calculator</span>
        <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
          <XIcon size={13} />
        </button>
      </div>
      <div className="bg-muted/40 px-3 py-3 text-right">
        <p className="h-4 text-[10px] text-muted-foreground truncate">{expression || " "}</p>
        <p className="mt-0.5 text-2xl font-bold text-foreground tabular-nums truncate">{display}</p>
      </div>
      <div className="grid grid-cols-4 gap-1 p-2">
        {btn("C", handleClear, "bg-destructive/15 text-destructive hover:bg-destructive/25")}
        {btn("±", handleNegate, "bg-muted text-foreground hover:bg-muted/80")}
        {btn("%", handlePercent, "bg-muted text-foreground hover:bg-muted/80")}
        {btn("÷", () => handleOperator("÷"), operator === "÷" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary hover:bg-primary/25")}
        {btn("7", () => inputDigit("7"), "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("8", () => inputDigit("8"), "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("9", () => inputDigit("9"), "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("×", () => handleOperator("×"), operator === "×" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary hover:bg-primary/25")}
        {btn("4", () => inputDigit("4"), "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("5", () => inputDigit("5"), "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("6", () => inputDigit("6"), "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("−", () => handleOperator("−"), operator === "−" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary hover:bg-primary/25")}
        {btn("1", () => inputDigit("1"), "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("2", () => inputDigit("2"), "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("3", () => inputDigit("3"), "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("+", () => handleOperator("+"), operator === "+" ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary hover:bg-primary/25")}
        <button type="button" onClick={() => inputDigit("0")}
          className="col-span-2 flex h-10 items-center justify-start rounded-xl bg-card border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted transition-colors">
          0
        </button>
        {btn(".", inputDecimal, "bg-card border border-border hover:bg-muted text-foreground")}
        {btn("=", handleEquals, "bg-primary text-primary-foreground hover:bg-primary/90")}
        <button type="button" onClick={handleBackspace}
          className="col-span-4 flex h-8 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground hover:bg-muted/80 transition-colors">
          ⌫ backspace
        </button>
      </div>
    </div>
  )
}

// ── Theme Picker ──────────────────────────────────────────────────────────────
function ThemePicker({ current, onSelect, onClose }: { current: ThemeId; onSelect: (id: ThemeId) => void; onClose: () => void }) {
  return (
    <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[70] w-[min(340px,92vw)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Exam Theme</span>
        <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
          <XIcon size={13} />
        </button>
      </div>
      <div className="p-3 grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
        {THEMES.map((t) => (
          <button key={t.id} type="button" onClick={() => { onSelect(t.id); onClose() }} title={t.name}
            className={`group flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all ${current === t.id ? "ring-2 ring-primary bg-primary/8" : "hover:bg-muted"}`}>
            <div className="relative h-9 w-9 rounded-xl overflow-hidden border border-border/50 shadow-sm" style={{ background: t.swatch.bg }}>
              <div className="absolute inset-0 flex">
                <div className="w-1/2 h-full" style={{ background: t.swatch.surface }} />
                <div className="w-1/2 h-full" style={{ background: t.swatch.primary }} />
              </div>
            </div>
            <span className="text-[9px] font-medium text-center leading-tight text-muted-foreground group-hover:text-foreground line-clamp-2">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Navigator Panel (shared by desktop sidebar + mobile drawer) ───────────────
interface NavPanelProps {
  questions: Question[]
  answers: Record<string, string | null>
  flagged: Set<string>
  currentIdx: number
  answered: number
  unanswered: number
  flaggedCount: number
  submitting: boolean
  submitted: boolean
  onSelect: (idx: number) => void
  onSubmit: () => void
}

function NavPanel({ questions, answers, flagged, currentIdx, answered, unanswered, flaggedCount, submitting, submitted, onSelect, onSubmit }: NavPanelProps) {
  return (
    <div className="flex flex-col h-full gap-3">
      <div className="grid grid-cols-5 gap-1">
        {questions.map((question, idx) => {
          const isAnswered = answers[question.id] != null
          const isFlagged = flagged.has(question.id)
          const isCurrent = idx === currentIdx
          return (
            <button key={question.id} type="button" onClick={() => onSelect(idx)}
              className={`relative flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                isCurrent ? "bg-primary text-primary-foreground shadow-sm"
                : isFlagged ? "bg-amber-400/80 text-white dark:bg-amber-500/60 dark:text-white"
                : isAnswered ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-background border border-border text-muted-foreground hover:bg-muted"
              }`}>
              {idx + 1}
              {isFlagged && !isCurrent && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 border border-card" />
              )}
            </button>
          )
        })}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-3 w-3 rounded bg-primary/20" /> Current</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-3 w-3 rounded bg-emerald-100 dark:bg-emerald-900/30" /> Answered ({answered})</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-3 w-3 rounded bg-amber-400/80" /> Flagged ({flaggedCount})</div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-3 w-3 rounded border border-border bg-background" /> Unanswered ({unanswered})</div>
      </div>

      {flaggedCount > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Flagged</p>
          <div className="space-y-1">
            {Array.from(flagged).map((qId) => {
              const qIdx = questions.findIndex((q) => q.id === qId)
              if (qIdx === -1) return null
              return (
                <button key={qId} type="button" onClick={() => onSelect(qIdx)}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-left hover:bg-muted transition-colors">
                  <FlagIcon size={9} className="text-amber-500 shrink-0" />
                  <span className="text-muted-foreground truncate">Q{qIdx + 1}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-auto pt-2">
        <button type="button" disabled={submitting || submitted} onClick={onSubmit}
          className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit Exam"}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function AssessmentExamRunner({
  assessmentId, title, timeLimitMins, passMark, questions,
  userName, userId, isGuest = false, onComplete,
}: Props) {
  const totalSecs = timeLimitMins * 60
  const sessionKey = makeSessionKey(assessmentId, userId)

  // ── State — lazily initialised from localStorage session ──────────────────
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const session = readSession(sessionKey)
    return session ? calcRemaining(session.startedAt, totalSecs) : totalSecs
  })

  const [answers, setAnswers] = useState<Record<string, string | null>>(() => {
    return readSession(sessionKey)?.answers ?? {}
  })

  const [flagged, setFlagged] = useState<Set<string>>(() => {
    const session = readSession(sessionKey)
    return session?.flagged ? new Set(session.flagged) : new Set()
  })

  const [currentIdx, setCurrentIdx] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showNav, setShowNav] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showCalc, setShowCalc] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<ThemeId>("clinical-light")

  const submittedRef = useRef(false)
  // Store startedAt so saveSession doesn't need to re-read localStorage
  const startedAtRef = useRef<number>(0)

  // ── Load persisted theme ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("mednexus-theme") as ThemeId | null
      if (stored) setCurrentTheme(stored)
    } catch { /* ignore */ }
  }, [])

  // ── Session init — create if new, or auto-submit if expired ───────────────
  useEffect(() => {
    const session = readSession(sessionKey)
    if (!session) {
      const now = Date.now()
      startedAtRef.current = now
      writeSession(sessionKey, { startedAt: now, answers: {}, flagged: [] })
    } else {
      startedAtRef.current = session.startedAt
      // If they were away long enough that time ran out, submit now
      if (timeLeft === 0 && !submittedRef.current) {
        doSubmit(session.answers)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Timer — wall-clock corrected every second ──────────────────────────────
  useEffect(() => {
    if (submitted) return
    const t = setInterval(() => {
      // Always re-derive from wall clock so resume after leaving is accurate
      const remaining = calcRemaining(startedAtRef.current, totalSecs)
      setTimeLeft(remaining)
      if (remaining === 0) {
        clearInterval(t)
        doSubmit(answersRef.current)
      }
    }, 1000)
    return () => clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted])

  // Keep a ref to latest answers so the timer callback can access them
  const answersRef = useRef(answers)
  useEffect(() => { answersRef.current = answers }, [answers])

  // ── Session save helpers ──────────────────────────────────────────────────
  function saveSession(nextAnswers: Record<string, string | null>, nextFlagged: Set<string>) {
    writeSession(sessionKey, {
      startedAt: startedAtRef.current,
      answers: nextAnswers,
      flagged: Array.from(nextFlagged),
    })
  }

  // ── Core submit ──────────────────────────────────────────────────────────
  const doSubmit = useCallback(async (finalAnswers: Record<string, string | null>) => {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)

    let score = 0
    for (const q of questions) {
      if (finalAnswers[q.id] === q.correctAnswer) score++
    }
    const total = questions.length
    const percentage = total ? Math.round((score / total) * 100) : 0

    clearSession(sessionKey)

    try {
      await fetch(`/api/assessments/${assessmentId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, userName, isGuest, answers: finalAnswers }),
      })
    } catch { /* swallow — result shown locally */ }

    setSubmitted(true)
    setSubmitting(false)
    onComplete({ score, total, percentage, passed: percentage >= passMark, answers: finalAnswers, questions })
  }, [assessmentId, questions, userId, userName, isGuest, passMark, onComplete, sessionKey])

  // ── NO visibilitychange / beforeunload auto-submit ────────────────────────
  // Timer is wall-clock based so leaving and returning correctly deducts time.

  function applyTheme(id: ThemeId) {
    setCurrentTheme(id)
    document.documentElement.setAttribute("data-theme", id)
    try { localStorage.setItem("mednexus-theme", id) } catch { /* ignore */ }
  }

  function selectAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => {
      // Clicking the already-selected option clears it
      const next = { ...prev, [questionId]: prev[questionId] === optionId ? null : optionId }
      saveSession(next, flagged)
      return next
    })
  }

  function toggleFlag(questionId: string) {
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) next.delete(questionId)
      else next.add(questionId)
      saveSession(answersRef.current, next)
      return next
    })
  }

  function requestSubmit() { setShowConfirm(true) }
  function confirmSubmit() { setShowConfirm(false); doSubmit(answers) }

  const q = questions[currentIdx]
  const answered = Object.values(answers).filter((v) => v != null).length
  const unanswered = questions.length - answered
  const flaggedCount = flagged.size
  const mins = Math.floor(timeLeft / 60)
  const secs = timeLeft % 60
  const timeCritical = timeLeft <= 60 && timeLeft > 0
  const timeWarning = timeLeft <= 300 && timeLeft > 60

  if (!q) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 flex items-center gap-2 border-b border-border bg-card px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{userName} · {title}</p>
          <p className="text-sm font-semibold text-foreground">Q{currentIdx + 1}/{questions.length}</p>
        </div>

        {/* Progress */}
        <div className="hidden sm:flex flex-1 max-w-xs items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{answered}/{questions.length}</span>
        </div>

        {/* Timer */}
        <div className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums ${
          timeCritical ? "border-destructive/40 bg-destructive/10 text-destructive animate-pulse"
          : timeWarning ? "border-amber-400/40 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
          : "border-border bg-muted text-foreground"
        }`}>
          <ClockIcon size={12} />
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>

        {/* Tool buttons */}
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => { setShowCalc((v) => !v); setShowThemePicker(false) }} title="Calculator"
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${showCalc ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            <CalculatorIcon size={14} />
          </button>
          <button type="button" onClick={() => { setShowThemePicker((v) => !v); setShowCalc(false) }} title="Change theme"
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${showThemePicker ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            <PaletteIcon size={14} />
          </button>
          <button type="button" onClick={() => setShowNav((v) => !v)}
            className={`flex lg:hidden h-8 w-8 items-center justify-center rounded-lg border transition-colors ${showNav ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted text-muted-foreground hover:bg-muted/80"}`}
            title="Question navigator">
            ⊞
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Question area ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Shared context panel — left column, sticky ───────────────────
              Rendered only when the current question is linked to a Context.
              The inner wrapper is sticky so the content stays pinned while
              the right column (question + options) scrolls independently.   */}
          {q.contextId && q.contextContent && (
            <div className="hidden md:flex w-[42%] max-w-xs xl:max-w-sm shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/20">
              <div className="sticky top-0 p-5 sm:p-6 lg:p-8">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-primary">
                  Shared Clinical Context
                </p>
                <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">
                  {q.contextContent}
                </p>
              </div>
            </div>
          )}

          {/* ── Right: question + options scroll normally ── */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className={q.contextId ? "space-y-5" : "mx-auto max-w-3xl space-y-5"}>

            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">Q{currentIdx + 1}</span>
                  <span className="text-xs text-muted-foreground">{q.subject}</span>
                </div>
                <button type="button" onClick={() => toggleFlag(q.id)} title={flagged.has(q.id) ? "Remove flag" : "Flag this question"}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${
                    flagged.has(q.id)
                      ? "border-amber-400/60 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-400"
                      : "border-border bg-muted text-muted-foreground hover:border-amber-400/60 hover:text-amber-600"
                  }`}>
                  <FlagIcon size={11} />
                  {flagged.has(q.id) ? "Flagged" : "Flag"}
                </button>
              </div>
              <p className="text-base leading-relaxed text-foreground">{q.vignette}</p>
            </div>

            <div className="space-y-2.5">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.id
                return (
                  <button key={opt.id} type="button" onClick={() => selectAnswer(q.id, opt.id)}
                    className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      selected ? "border-primary bg-primary/8 shadow-sm ring-1 ring-primary/20"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                    }`}>
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                    }`}>{opt.id}</span>
                    <span className="text-sm leading-relaxed text-foreground">{opt.text}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center justify-between pt-1">
              <button type="button" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}
                className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeftIcon size={15} /> Previous
              </button>
              {currentIdx < questions.length - 1 ? (
                <button type="button" onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
                  Next <ChevronRightIcon size={15} />
                </button>
              ) : (
                <button type="button" disabled={submitting || submitted} onClick={requestSubmit}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-60">
                  {submitting ? "Submitting…" : <><CheckIcon size={14} /> Submit Exam</>}
                </button>
              )}
            </div>

            {currentIdx < questions.length - 1 && (
              <div className="flex justify-end">
                <button type="button" disabled={submitting || submitted} onClick={requestSubmit}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline">
                  Submit early ({answered}/{questions.length} answered)
                </button>
              </div>
            )}
          </div>{/* closes space-y-5 inner div */}
          </div>{/* closes right column overflow-y-auto */}
        </div>{/* closes outer flex-1 flex overflow-hidden wrapper */}

        {/* ── Desktop navigator sidebar (lg+) ── */}
        <div className="hidden lg:flex w-56 shrink-0 flex-col border-l border-border bg-muted/30 p-3 overflow-y-auto">
          <NavPanel
            questions={questions} answers={answers} flagged={flagged}
            currentIdx={currentIdx} answered={answered} unanswered={unanswered} flaggedCount={flaggedCount}
            submitting={submitting} submitted={submitted}
            onSelect={(idx) => setCurrentIdx(idx)}
            onSubmit={requestSubmit}
          />
        </div>
      </div>

      {/* ── Mobile navigator overlay (< lg) ── */}
      {showNav && (
        <div className="fixed inset-0 z-[58] lg:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowNav(false)} />
          <div className="absolute right-0 top-0 h-full w-64 flex flex-col bg-card border-l border-border overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-3 border-b border-border shrink-0">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Navigator</span>
              <button type="button" onClick={() => setShowNav(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                <XIcon size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavPanel
                questions={questions} answers={answers} flagged={flagged}
                currentIdx={currentIdx} answered={answered} unanswered={unanswered} flaggedCount={flaggedCount}
                submitting={submitting} submitted={submitted}
                onSelect={(idx) => { setCurrentIdx(idx); setShowNav(false) }}
                onSubmit={() => { setShowNav(false); requestSubmit() }}
              />
            </div>
          </div>
        </div>
      )}

      {timeCritical && (
        <div className="shrink-0 flex items-center justify-center gap-2 bg-destructive/10 border-t border-destructive/20 px-4 py-2 text-xs font-semibold text-destructive">
          <AlertTriangleIcon size={13} /> Less than 1 minute remaining!
        </div>
      )}

      {/* ── Submit Confirm ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                  <AlertTriangleIcon size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Submit Exam?</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {unanswered > 0
                      ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. This cannot be undone.`
                      : "All questions answered. This cannot be undone."}
                  </p>
                </div>
              </div>
              {unanswered > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 px-3 py-2.5">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-amber-700 dark:text-amber-400">Answered</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">{answered}/{questions.length}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(answered / questions.length) * 100}%` }} />
                  </div>
                </div>
              )}
              {flaggedCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/50 dark:border-amber-800/30 dark:bg-amber-900/10 px-3 py-2">
                  <FlagIcon size={12} className="text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {flaggedCount} flagged question{flaggedCount === 1 ? "" : "s"} marked for review.
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowConfirm(false)}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  Go Back
                </button>
                <button type="button" onClick={confirmSubmit} disabled={submitting}
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-60">
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}
      {showThemePicker && <ThemePicker current={currentTheme} onSelect={applyTheme} onClose={() => setShowThemePicker(false)} />}
    </div>
  )
}
