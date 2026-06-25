"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useApp } from "@/contexts/app-context"
import { computeResult } from "@/lib/modules"
import type { QuizMode, HistoryEntry, BlockResult, Question } from "@/lib/types"
import { CalculatorModal } from "@/components/calculator-modal"
import { LabValuesModal } from "@/components/lab-values-modal"
import {
  XIcon,
  FlagIcon,
  CalculatorIcon,
  FlaskIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  ClockIcon,
  BookOpenIcon,
} from "@/components/icons"

interface QuizSimulatorProps {
  questions: Question[]   // pre-selected and shuffled by the caller
  moduleName: string      // display name
  mode: QuizMode
  onExit: () => void
  onComplete: (result: BlockResult, history: HistoryEntry[]) => void
}

const SECONDS_PER_QUESTION = 90

export function QuizSimulator({ questions, moduleName, mode, onExit, onComplete }: QuizSimulatorProps) {
  const { progress, toggleFlag, recordHistory } = useApp()

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | null>>({})
  const [struck, setStruck] = useState<Record<string, Set<string>>>({})
  const [timeLeft, setTimeLeft] = useState(questions.length * SECONDS_PER_QUESTION)
  const [calcOpen, setCalcOpen] = useState(false)
  const [labsOpen, setLabsOpen] = useState(false)
  const [navOpenMobile, setNavOpenMobile] = useState(false)

  const startedAt = useRef(Date.now())

  const current = questions[index]
  const selected = current ? answers[current.id] ?? null : null
  const isFlagged = current ? progress.flaggedQuestionIds.includes(current.id) : false
  const struckSet = current ? struck[current.id] ?? new Set<string>() : new Set<string>()
  const revealed = mode === "trial" && selected !== null

  const submitBlock = useCallback(() => {
    const timeTakenMs = Date.now() - startedAt.current
    const result: BlockResult = computeResult(questions, answers, timeTakenMs)
    const now = Date.now()
    const history: HistoryEntry[] = questions.map((q) => ({
      id: `${q.id}-${now}-${Math.random().toString(36).slice(2, 7)}`,
      questionId: q.id,
      module: q.module,
      subject: q.subject,
      vignetteSnippet: q.vignette.slice(0, 120) + (q.vignette.length > 120 ? "…" : ""),
      mode,
      selectedOption: answers[q.id] ?? null,
      correctOption: q.correctAnswer,
      isCorrect: answers[q.id] === q.correctAnswer,
      timestamp: now,
    }))
    recordHistory(history)
    onComplete(result, history)
  }, [questions, answers, mode, recordHistory, onComplete])

  // Exam timer
  useEffect(() => {
    if (mode !== "exam") return
    if (timeLeft <= 0) { submitBlock(); return }
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [mode, timeLeft, submitBlock])

  if (!current) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        This block has no questions.
      </div>
    )
  }

  function selectOption(optionId: string) {
    if (struckSet.has(optionId)) return
    if (mode === "trial" && selected !== null) return
    setAnswers((prev) => ({ ...prev, [current.id]: optionId }))
  }

  function toggleStrike(e: React.MouseEvent, optionId: string) {
    e.stopPropagation()
    setStruck((prev) => {
      const next = { ...prev }
      const set = new Set(next[current.id] ?? [])
      if (set.has(optionId)) set.delete(optionId)
      else {
        set.add(optionId)
        if (answers[current.id] === optionId && !(mode === "trial" && selected !== null)) {
          setAnswers((a) => ({ ...a, [current.id]: null }))
        }
      }
      next[current.id] = set
      return next
    })
  }

  const answeredCount = questions.filter((q) => answers[q.id] != null).length

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-1 border-b border-border bg-card px-3 py-2.5 sm:gap-2 sm:px-4 sm:py-3">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <XIcon size={18} />
          <span className="hidden sm:inline">Exit</span>
        </button>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <BookOpenIcon size={15} className="shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">{moduleName}</span>
          <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
            {mode === "trial" ? "Tutor" : "Exam"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {mode === "exam" && (
            <div className={`mr-0.5 flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold tabular-nums sm:mr-1 sm:px-2.5 ${timeLeft < 60 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>
              <ClockIcon size={15} />
              <span className="text-xs sm:text-sm">{formatTime(timeLeft)}</span>
            </div>
          )}
          <ToolButton label="Labs" onClick={() => setLabsOpen(true)}>
            <FlaskIcon size={17} />
          </ToolButton>
          <ToolButton label="Calc" onClick={() => setCalcOpen(true)}>
            <CalculatorIcon size={17} />
          </ToolButton>
          <button
            type="button"
            onClick={() => toggleFlag(current.id)}
            aria-pressed={isFlagged}
            className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors sm:gap-1.5 sm:px-2.5 ${isFlagged ? "bg-warning/15 text-warning" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <FlagIcon size={17} />
            <span className="hidden sm:inline">{isFlagged ? "Flagged" : "Flag"}</span>
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-5 sm:px-6 sm:py-8">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Question {index + 1} of {questions.length}
              </span>
              <button
                type="button"
                onClick={() => setNavOpenMobile((v) => !v)}
                className="rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground lg:hidden"
              >
                {answeredCount}/{questions.length} answered
              </button>
            </div>

            <p className="text-[15px] leading-relaxed text-foreground text-pretty sm:text-base">{current.vignette}</p>

            <div className="mt-5 flex flex-col gap-2.5 sm:mt-6 sm:gap-3">
              {current.options.map((opt) => {
                const isStruck = struckSet.has(opt.id)
                const isSelected = selected === opt.id
                const isCorrect = opt.id === current.correctAnswer

                let stateClass = "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
                if (revealed) {
                  if (isCorrect) stateClass = "border-success bg-success/10"
                  else if (isSelected) stateClass = "border-destructive bg-destructive/10"
                  else stateClass = "border-border bg-card opacity-70"
                } else if (isSelected) {
                  stateClass = "border-primary bg-primary/5 ring-1 ring-primary/30"
                }

                return (
                  <div
                    key={opt.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectOption(opt.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectOption(opt.id) }
                    }}
                    className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.99] ${stateClass} ${isStruck ? "opacity-50" : ""}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                      revealed && isCorrect ? "border-success bg-success text-success-foreground"
                        : revealed && isSelected ? "border-destructive bg-destructive text-destructive-foreground"
                          : isSelected ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted text-muted-foreground"
                    }`}>
                      {opt.id}
                    </span>
                    <span className={`flex-1 text-sm leading-snug ${isStruck ? "text-muted-foreground line-through" : ""}`}>
                      {opt.text}
                    </span>
                    {revealed && isCorrect && <CheckIcon size={18} className="shrink-0 text-success" />}
                    {revealed && isSelected && !isCorrect && <XIcon size={18} className="shrink-0 text-destructive" />}
                    {!revealed && (
                      <button
                        type="button"
                        onClick={(e) => toggleStrike(e, opt.id)}
                        aria-label={isStruck ? `Restore option ${opt.id}` : `Cross out option ${opt.id}`}
                        className={`shrink-0 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${isStruck ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                      >
                        {isStruck ? "Undo" : "✕"}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {revealed && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-border sm:mt-6">
                <div className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold sm:px-5 ${selected === current.correctAnswer ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                  {selected === current.correctAnswer ? <CheckIcon size={18} /> : <XIcon size={18} />}
                  {selected === current.correctAnswer ? "Correct" : "Incorrect"} — Answer is {current.correctAnswer}
                </div>
                <div className="flex flex-col gap-4 bg-card p-4 sm:p-5">
                  <ExplanationBlock title="Learning Objective" body={current.explanation.objective} />
                  <ExplanationBlock title="Why It's Correct" body={current.explanation.details} />
                  <ExplanationBlock title="Distractor Reasoning" body={current.explanation.incorrectReasoning} />
                </div>
              </div>
            )}
          </div>

          {/* Bottom bar */}
          <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted active:bg-muted disabled:opacity-40 sm:py-2.5"
            >
              <ChevronLeftIcon size={18} />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {index === questions.length - 1 ? (
              <button
                type="button"
                onClick={submitBlock}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80 sm:py-2.5"
              >
                Submit Block
                <CheckIcon size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80 sm:py-2.5"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next →</span>
                <ChevronRightIcon size={18} className="hidden sm:block" />
              </button>
            )}
          </div>
        </div>

        <NavGrid
          className="hidden w-60 shrink-0 lg:flex"
          questions={questions}
          index={index}
          answers={answers}
          flagged={progress.flaggedQuestionIds}
          onJump={(i) => setIndex(i)}
        />
      </div>

      {navOpenMobile && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Close navigator"
            onClick={() => setNavOpenMobile(false)}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          <NavGrid
            className="absolute right-0 top-0 flex h-full w-64 max-w-[80%] animate-in slide-in-from-right duration-200"
            questions={questions}
            index={index}
            answers={answers}
            flagged={progress.flaggedQuestionIds}
            onJump={(i) => { setIndex(i); setNavOpenMobile(false) }}
          />
        </div>
      )}

      <CalculatorModal open={calcOpen} onClose={() => setCalcOpen(false)} />
      <LabValuesModal open={labsOpen} onClose={() => setLabsOpen(false)} />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function NavGrid({ className, questions, index, answers, flagged, onJump }: {
  className: string
  questions: Question[]
  index: number
  answers: Record<string, string | null>
  flagged: string[]
  onJump: (i: number) => void
}) {
  return (
    <aside className={`flex-col border-l border-border bg-card ${className}`}>
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">Question Navigator</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {questions.filter((q) => answers[q.id] != null).length} / {questions.length} answered
        </p>
      </div>
      <div className="grid grid-cols-5 content-start gap-2 overflow-y-auto p-4">
        {questions.map((q, i) => {
          const answered = answers[q.id] != null
          const isCurrent = i === index
          const isFlagged = flagged.includes(q.id)
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJump(i)}
              className={`relative flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                  : answered ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
              }`}
            >
              {i + 1}
              {isFlagged && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-auto flex flex-col gap-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <Legend swatch="bg-success/15" label="Answered" />
        <Legend swatch="bg-muted" label="Unanswered" />
        <div className="flex items-center gap-2">
          <span className="relative flex h-4 w-4 items-center justify-center rounded bg-muted">
            <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-warning" />
          </span>
          Flagged
        </div>
      </div>
    </aside>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-4 w-4 rounded ${swatch}`} />
      {label}
    </div>
  )
}

function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:gap-1.5 sm:px-2.5"
    >
      {children}
      <span className="hidden sm:inline text-xs">{label}</span>
    </button>
  )
}

function ExplanationBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{title}</h4>
      <p className="text-sm leading-relaxed text-foreground text-pretty">{body}</p>
    </div>
  )
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}
