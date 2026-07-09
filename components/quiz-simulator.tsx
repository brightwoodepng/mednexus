"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useApp } from "@/contexts/app-context"
import { computeResult } from "@/lib/modules"
import type { QuizMode, HistoryEntry, BlockResult, Question } from "@/lib/types"
import { CalculatorModal } from "@/components/calculator-modal"
import { LabValuesModal } from "@/components/lab-values-modal"
import { RichText } from "@/components/rich-text"
import { useErrorFeedback } from "@/hooks/use-error-feedback"
import { useStreakEngine } from "@/hooks/use-streak-engine"
import { StreakCheer } from "@/components/streak-cheer"
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
  /** Whether the user opted into gamification for this Trial Mode session */
  gamificationEnabled?: boolean
  onExit: () => void
  onComplete: (result: BlockResult, history: HistoryEntry[]) => void
}

const SECONDS_PER_QUESTION = 90

export function QuizSimulator({ questions, moduleName, mode, gamificationEnabled = false, onExit, onComplete }: QuizSimulatorProps) {
  const { progress, toggleFlag, recordHistory } = useApp()
  const { triggerError, isShaking, isFlashing } = useErrorFeedback()
  // Dynamic Streak Engine — strictly Trial Mode + gamification opt-in. Dormant otherwise.
  const streakEngine = useStreakEngine(questions.length, mode === "trial" && gamificationEnabled)

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[] | null>>({})
  const [struck, setStruck] = useState<Record<string, Set<string>>>({})
  const [sataSelections, setSataSelections] = useState<Record<string, string[]>>({})
  const [sataLocked, setSataLocked] = useState<Set<string>>(new Set())
  const [timeLeft, setTimeLeft] = useState(questions.length * SECONDS_PER_QUESTION)
  const [calcOpen, setCalcOpen] = useState(false)
  const [labsOpen, setLabsOpen] = useState(false)
  const [navOpenMobile, setNavOpenMobile] = useState(false)

  const startedAt = useRef(Date.now())

  const current = questions[index]
  const isSATA = current
    ? Array.isArray(current.correctAnswer) && (current.correctAnswer as string[]).length > 1
    : false
  const sataSelected = current ? (sataSelections[current.id] ?? []) : []
  const isLocked = current ? sataLocked.has(current.id) : false
  const sataCorrectAnswers: string[] = isSATA ? (current!.correctAnswer as string[]) : []
  const sataIsCorrect =
    isSATA && isLocked &&
    sataSelected.length === sataCorrectAnswers.length &&
    sataCorrectAnswers.length > 0 &&
    sataSelected.every(id => sataCorrectAnswers.includes(id))
  const selected = current ? (answers[current.id] ?? null) : null
  const isFlagged = current ? progress.flaggedQuestionIds.includes(current.id) : false
  const struckSet = current ? struck[current.id] ?? new Set<string>() : new Set<string>()
  const revealed = mode === "trial" && (isSATA ? isLocked : selected !== null)

  function isAnswerCorrect(
    ans: string | string[] | null,
    correct: string | string[] | null,
  ): boolean {
    if (ans == null || correct == null) return false
    if (Array.isArray(correct) && Array.isArray(ans)) {
      const ca = [...(correct as string[])].sort()
      const sa = [...(ans as string[])].sort()
      return ca.length === sa.length && ca.every((c, i) => c === sa[i])
    }
    return ans === correct
  }

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
      correctOption: q.correctAnswer ?? null,
      isCorrect: isAnswerCorrect(answers[q.id] ?? null, q.correctAnswer ?? null),
      timestamp: now,
    }))
    recordHistory(history)
    onComplete(result, history)
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (isSATA) {
      if (isLocked) return
      setSataSelections(prev => {
        const cur = prev[current.id] ?? []
        const next = cur.includes(optionId)
          ? cur.filter(x => x !== optionId)
          : [...cur, optionId]
        return { ...prev, [current.id]: next }
      })
      return
    }
    if (struckSet.has(optionId)) return
    if (mode === "trial" && selected !== null) return
    setAnswers(prev => ({ ...prev, [current.id]: optionId }))
    // Error feedback + Streak Engine: explicitly gated on Trial mode + gamification opt-in
    if (mode === "trial" && gamificationEnabled) {
      const isCorrect = optionId === (current.correctAnswer as string)
      if (!isCorrect) triggerError()
      streakEngine.recordAnswer(isCorrect)
    }
  }

  function lockInSata() {
    if (!isSATA || isLocked || sataSelected.length === 0) return
    setAnswers(prev => ({ ...prev, [current.id]: sataSelected }))
    setSataLocked(prev => { const n = new Set(prev); n.add(current.id); return n })
    // Error feedback + Streak Engine for SATA: explicitly gated on Trial mode + gamification opt-in
    if (mode === "trial" && gamificationEnabled) {
      const ca = [...sataCorrectAnswers].sort()
      const sa = [...sataSelected].sort()
      const correct = ca.length === sa.length && ca.every((c, i) => c === sa[i])
      if (!correct) triggerError()
      streakEngine.recordAnswer(correct)
    }
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

  const answeredCount = questions.filter((q) => {
    const isSataQ = Array.isArray(q.correctAnswer) && (q.correctAnswer as string[]).length > 1
    return isSataQ ? sataLocked.has(q.id) : answers[q.id] != null
  }).length

  return (
    <div className="flex h-full flex-col">
      {/* Dynamic Streak Engine cheer — Trial Mode + gamification only, dormant otherwise */}
      <StreakCheer event={streakEngine.cheerEvent} onDone={streakEngine.clearCheer} />

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
          {/* Mobile nav toggle — always visible in header on phones */}
          <button
            type="button"
            onClick={() => setNavOpenMobile((v) => !v)}
            className={`flex md:hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold tabular-nums transition-colors ${navOpenMobile ? "bg-primary/10 text-primary" : "bg-muted text-foreground hover:bg-muted/80"}`}
            title="Question navigator"
          >
            ⊞ {answeredCount}/{questions.length}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Shared context panel — left column, sticky ─────────────────────
            Rendered only when the current question is linked to a Context.
            The inner wrapper is sticky so the content stays pinned while the
            right column (question + options) scrolls independently.          */}
        {current.contextId && current.contextContent && (
          <div className="hidden md:flex w-[42%] max-w-xs xl:max-w-sm shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/20">
            <div className="sticky top-0 p-5 sm:p-6">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-primary">
                Shared Clinical Context
              </p>
              <RichText content={current.contextContent} className="text-[14px] text-foreground" />
            </div>
          </div>
        )}

        {/* ── Question + options column — scrolls independently ── */}
        <div className={`relative flex flex-1 flex-col overflow-y-auto min-w-0 ${isShaking ? "animate-error-shake" : ""}`}>
          {/* Glassmorphic error flash overlay */}
          {isFlashing && (
            <div className="pointer-events-none absolute inset-0 z-10 bg-rose-500/[0.12] backdrop-blur-[6px]" />
          )}
          <div className={`flex-1 px-4 pt-5 pb-6 sm:px-6 sm:pt-8 sm:pb-8 ${current.contextId ? "" : "mx-auto w-full max-w-3xl"}`}>
            <div className="mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Question {index + 1} of {questions.length}
              </span>
            </div>

            <RichText content={current.vignette} className="text-[15px] text-foreground text-pretty sm:text-base" />

            {current.mediaBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.mediaBase64}
                alt="Question image"
                className="mt-4 max-h-80 w-auto max-w-full rounded-lg border border-border object-contain"
              />
            )}

            {/* SATA instruction badge */}
            {isSATA && (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 sm:mt-6">
                <span className="text-sm">☑️</span>
                <span className="text-xs font-semibold text-primary">
                  Select ALL that apply — choose every correct option, then press Lock In Answers.
                </span>
              </div>
            )}

            <div className={`flex flex-col gap-2.5 sm:gap-3 ${isSATA ? "mt-3" : "mt-5 sm:mt-6"}`}>
              {current.options.map((opt) => {
                /* ── SATA multi-select rendering ─────────────────────────── */
                if (isSATA) {
                  const isSataSelected = sataSelected.includes(opt.id)
                  const isOptCorrect = sataCorrectAnswers.includes(opt.id)
                  const isWrongSelected = revealed && isSataSelected && !isOptCorrect
                  const isMissed = revealed && isOptCorrect && !isSataSelected

                  let stateClass = "border-border bg-card"
                  if (revealed) {
                    if (isOptCorrect && isSataSelected) stateClass = "border-success bg-success/10"
                    else if (isWrongSelected) stateClass = "border-destructive bg-destructive/10"
                    else if (isMissed) stateClass = "border-warning bg-warning/10"
                    else stateClass = "border-border bg-card opacity-60"
                  } else if (isSataSelected) {
                    stateClass = "border-primary bg-primary/5 ring-1 ring-primary/30"
                  } else if (!isLocked) {
                    stateClass = "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
                  }

                  const badgeCls = revealed && isOptCorrect && isSataSelected
                    ? "border-success bg-success text-success-foreground"
                    : revealed && isWrongSelected
                      ? "border-destructive bg-destructive text-destructive-foreground"
                      : revealed && isMissed
                        ? "border-warning bg-warning/20 text-warning"
                        : isSataSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-muted text-muted-foreground"

                  return (
                    <div
                      key={opt.id}
                      role="checkbox"
                      aria-checked={isSataSelected}
                      tabIndex={isLocked ? -1 : 0}
                      onClick={() => selectOption(opt.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectOption(opt.id) }
                      }}
                      className={`flex min-h-[52px] items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${isLocked ? "cursor-default" : "cursor-pointer active:scale-[0.99]"} ${stateClass}`}
                    >
                      {/* Square checkbox indicator */}
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${badgeCls}`}>
                        {(isSataSelected || (revealed && isOptCorrect)) ? <CheckIcon size={13} /> : null}
                      </span>
                      <span className="flex-1 text-sm leading-snug">{opt.text}</span>
                      {revealed && isOptCorrect && isSataSelected && <CheckIcon size={18} className="shrink-0 text-success" />}
                      {revealed && isWrongSelected && <XIcon size={18} className="shrink-0 text-destructive" />}
                      {revealed && isMissed && (
                        <span className="shrink-0 rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning">Missed</span>
                      )}
                    </div>
                  )
                }

                /* ── Standard single-answer rendering ────────────────────── */
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

            {/* ── Lock In Answers button (SATA only, before lock) ── */}
            {isSATA && !isLocked && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={lockInSata}
                  disabled={sataSelected.length === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  🔒 Lock In Answers
                  {sataSelected.length > 0 && (
                    <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-extrabold">
                      {sataSelected.length} selected
                    </span>
                  )}
                </button>
              </div>
            )}

            {revealed && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-border sm:mt-6">
                {/* Result banner */}
                <div className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold sm:px-5 ${
                  isSATA
                    ? (sataIsCorrect ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")
                    : current.correctAnswer === null
                      ? "bg-muted text-muted-foreground"
                      : selected === current.correctAnswer
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                }`}>
                  {isSATA ? (
                    <>
                      {sataIsCorrect ? <CheckIcon size={18} /> : <XIcon size={18} />}
                      {sataIsCorrect ? "Correct!" : "Incorrect"} — Correct answers: {sataCorrectAnswers.join(", ")}
                    </>
                  ) : current.correctAnswer === null ? (
                    <span>No answer key — this question is a draft</span>
                  ) : (
                    <>
                      {selected === current.correctAnswer ? <CheckIcon size={18} /> : <XIcon size={18} />}
                      {selected === current.correctAnswer ? "Correct" : "Incorrect"} — Answer is {current.correctAnswer}
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-4 bg-card p-4 sm:p-5">
                  <ExplanationBlock title="Learning Objective" body={current.explanation?.objective ?? ""} />
                  <ExplanationBlock title="Why It's Correct" body={current.explanation?.details ?? ""} />
                  <ExplanationBlock title="Distractor Reasoning" body={current.explanation?.incorrectReasoning ?? ""} />
                </div>
              </div>
            )}
          </div>
        </div>

        <NavGrid
          className="hidden w-60 shrink-0 md:flex"
          questions={questions}
          index={index}
          answers={answers}
          flagged={progress.flaggedQuestionIds}
          onJump={(i) => setIndex(i)}
        />
      </div>

      {/* ── Bottom nav bar — always visible, outside the scroll area ── */}
      <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted active:bg-muted disabled:opacity-40"
        >
          <ChevronLeftIcon size={18} />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {index === questions.length - 1 ? (
          <button
            type="button"
            onClick={submitBlock}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            Submit Block
            <CheckIcon size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            Next <ChevronRightIcon size={18} />
          </button>
        )}
      </div>

      {navOpenMobile && (
        <div className="fixed inset-0 z-30 md:hidden">
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
      <LabValuesModal open={labsOpen} onClose={() => setLabsOpen(false)} question={current} />
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function NavGrid({ className, questions, index, answers, flagged, onJump }: {
  className: string
  questions: Question[]
  index: number
  answers: Record<string, string | string[] | null>
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
