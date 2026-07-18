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
import { GrandFinaleModal } from "@/components/grand-finale-modal"
import {
  XIcon,
  FlagIcon,
  CalculatorIcon,
  FlaskIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
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
  const [focusNavOpen, setFocusNavOpen] = useState(false)
  const [showGrandFinale, setShowGrandFinale] = useState(false)

  const startedAt = useRef(Date.now())
  const finaleTriggeredRef = useRef(false)
  const historyRecordedRef = useRef(false)

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
    // Guard: Grand Finale (gamification path) records history eagerly when the
    // finale fires so that weak areas clear even if the user exits without
    // pressing Submit Block. Avoid double-recording here.
    if (!historyRecordedRef.current) {
      recordHistory(history)
      historyRecordedRef.current = true
    }
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

  // Grand Finale trigger — fires the exact moment the last question is answered.
  // Placed before the early-return guard so hook call order is stable.
  // answeredCount is computed inline to avoid a forward-reference issue.
  // History is recorded HERE (not only in submitBlock) so that weak areas clear
  // immediately even when the user exits via "Return to Menu" without ever
  // pressing Submit Block.
  useEffect(() => {
    if (!gamificationEnabled || mode !== "trial" || questions.length === 0) return
    if (finaleTriggeredRef.current) return
    const count = questions.filter((q) => {
      const isSataQ = Array.isArray(q.correctAnswer) && (q.correctAnswer as string[]).length > 1
      return isSataQ ? sataLocked.has(q.id) : answers[q.id] != null
    }).length
    if (count === questions.length) {
      finaleTriggeredRef.current = true
      // Eagerly persist history so weak-area state reflects the correct answers
      // right now, regardless of which exit path the user takes afterward.
      if (!historyRecordedRef.current) {
        const now = Date.now()
        const historyEntries: HistoryEntry[] = questions.map((q) => ({
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
        recordHistory(historyEntries)
        historyRecordedRef.current = true
      }
      setShowGrandFinale(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, sataLocked])

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

  // ── Dynamic Milestone Tier (Task 5) ──────────────────────────────────────
  // Percentage-based so pacing feels correct for any quiz length.
  // Strictly dormant unless Trial Mode + gamification opt-in.
  const milestoneTier: 0 | 1 | 2 | 3 = (() => {
    if (!gamificationEnabled || mode !== "trial" || questions.length === 0) return 0
    const pct = answeredCount / questions.length
    if (pct >= 0.75) return 3
    if (pct >= 0.50) return 2
    if (pct >= 0.25) return 1
    return 0
  })()

  // ── Grand Finale stats (Task 6) ──────────────────────────────────────────
  // Computed once when the finale modal is visible; zeroed otherwise.
  const { finaleAccuracy, finaleCorrectCount } = (() => {
    if (!showGrandFinale || questions.length === 0) return { finaleAccuracy: 0, finaleCorrectCount: 0 }
    let correct = 0
    for (const q of questions) {
      const isSataQ = Array.isArray(q.correctAnswer) && (q.correctAnswer as string[]).length > 1
      if (isSataQ) {
        const sel = [...(sataSelections[q.id] ?? [])].sort()
        const cor = [...(q.correctAnswer as string[])].sort()
        if (sataLocked.has(q.id) && sel.length === cor.length && sel.every((v, i) => v === cor[i])) correct++
      } else {
        if (answers[q.id] === (q.correctAnswer as string)) correct++
      }
    }
    return { finaleCorrectCount: correct, finaleAccuracy: Math.round((correct / questions.length) * 100) }
  })()
  const finaleTimeTaken = showGrandFinale ? Math.round((Date.now() - startedAt.current) / 1000) : 0

  // ── Grand Finale retry handler ────────────────────────────────────────────
  // Resets all quiz state so the user can replay the same question pool.
  function handleRetry() {
    setShowGrandFinale(false)
    finaleTriggeredRef.current = false
    historyRecordedRef.current = false
    setIndex(0)
    setAnswers({})
    setStruck({})
    setSataSelections({})
    setSataLocked(new Set())
    setTimeLeft(questions.length * SECONDS_PER_QUESTION)
    startedAt.current = Date.now()
    streakEngine.reset()
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background md:relative md:inset-auto md:z-auto md:h-full">
      {/* Dynamic Streak Engine cheer — Trial Mode + gamification only, dormant otherwise */}
      <StreakCheer event={streakEngine.cheerEvent} onDone={streakEngine.clearCheer} />

      {/* Grand Finale — intercepts session end, Trial Mode + gamification only */}
      {showGrandFinale && (
        <GrandFinaleModal
          bestStreak={streakEngine.bestStreak}
          milestoneTier={milestoneTier}
          accuracy={finaleAccuracy}
          correctCount={finaleCorrectCount}
          totalQuestions={questions.length}
          timeTakenSeconds={finaleTimeTaken}
          questions={questions}
          answers={answers}
          onReturnToMenu={onExit}
          onRetry={handleRetry}
        />
      )}

      {/* ── Mobile focus-mode top bar (hidden on md+) ── */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2 md:hidden">
        {/* Exit */}
        <button
          type="button"
          onClick={onExit}
          className="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:bg-muted"
          aria-label="Exit session"
        >
          <XIcon size={20} />
        </button>

        {/* Center: clickable progress indicator that opens the navigator */}
        <button
          type="button"
          onClick={() => setFocusNavOpen((v) => !v)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold tabular-nums transition-colors hover:bg-muted active:bg-muted"
        >
          <span>Question {index + 1} of {questions.length}</span>
          <ChevronDownIcon size={14} className="text-muted-foreground" />
        </button>

        {/* Tools */}
        <div className="flex items-center gap-1">
          {mode === "exam" && (
            <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums ${timeLeft < 60 ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>
              <ClockIcon size={13} />
              {formatTime(timeLeft)}
            </div>
          )}
          <button type="button" onClick={() => setLabsOpen(true)} className="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <FlaskIcon size={18} />
          </button>
          <button type="button" onClick={() => setCalcOpen(true)} className="flex min-h-10 min-w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <CalculatorIcon size={18} />
          </button>
        </div>
      </header>

      {/* ── Desktop top bar (hidden on mobile) ── */}
      <header className="hidden shrink-0 items-center gap-1 border-b border-border bg-card px-3 py-2.5 sm:gap-2 sm:px-4 sm:py-3 md:flex">
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
          {milestoneTier > 0 && (
            <MilestoneTag key={milestoneTier} tier={milestoneTier} />
          )}
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
            <div className="pointer-events-none absolute inset-0 z-10 bg-rose-500/[0.12]" />
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
                className="mt-4 h-auto w-full rounded-lg border border-border object-contain md:max-h-80 md:w-auto md:max-w-full"
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
                      className={`flex min-h-14 items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${isLocked ? "cursor-default" : "cursor-pointer active:scale-[0.99]"} ${stateClass}`}
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
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-left transition-all active:scale-[0.99] ${stateClass} ${isStruck ? "opacity-50" : ""}`}
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

      {/* ── Mobile focus-mode sticky bottom bar (hidden on md+) ── */}
      <div className="shrink-0 flex items-center justify-between gap-2 border-t border-border bg-card px-3 py-2.5 md:hidden">
        {/* Previous */}
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="flex min-h-14 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold transition-colors hover:bg-muted active:bg-muted disabled:opacity-40"
        >
          <ChevronLeftIcon size={20} />
          <span>Prev</span>
        </button>

        {/* Flag */}
        <button
          type="button"
          onClick={() => toggleFlag(current.id)}
          aria-pressed={isFlagged}
          className={`flex min-h-14 w-14 items-center justify-center rounded-xl border transition-colors ${isFlagged ? "border-warning/40 bg-warning/10 text-warning" : "border-border text-muted-foreground hover:bg-muted"}`}
          aria-label={isFlagged ? "Unflag question" : "Flag question"}
        >
          <FlagIcon size={20} />
        </button>

        {/* Next / Submit */}
        {index === questions.length - 1 ? (
          <button
            type="button"
            onClick={submitBlock}
            className="flex min-h-14 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            <CheckIcon size={18} />
            <span>Submit</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="flex min-h-14 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
          >
            <span>Next</span>
            <ChevronRightIcon size={20} />
          </button>
        )}
      </div>

      {/* ── Desktop bottom nav bar (hidden on mobile) ── */}
      <div className="hidden shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-4 py-3 sm:px-5 md:flex">
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

      {/* ── Mobile: full-screen question navigator (slide up from bottom) ── */}
      {focusNavOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-background animate-in slide-in-from-bottom duration-250 md:hidden">
          {/* Nav header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3.5">
            <div>
              <h2 className="text-sm font-bold">Question Navigator</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {answeredCount} / {questions.length} answered
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFocusNavOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Close navigator"
            >
              <XIcon size={20} />
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-6 content-start gap-2.5 overflow-y-auto p-4">
            {questions.map((q, i) => {
              const answered = answers[q.id] != null
              const isCurrent = i === index
              const isFlaggedQ = progress.flaggedQuestionIds.includes(q.id)
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => { setIndex(i); setFocusNavOpen(false) }}
                  className={`relative flex h-11 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
                    isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
                      : answered ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {i + 1}
                  {isFlaggedQ && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="shrink-0 flex items-center gap-4 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <Legend swatch="bg-primary" label="Current" />
            <Legend swatch="bg-success/15" label="Answered" />
            <Legend swatch="bg-muted" label="Unanswered" />
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted">
                <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-warning" />
              </span>
              Flagged
            </div>
          </div>
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

// ── Milestone Tag (Task 5) ────────────────────────────────────────────────────
// Displays the highest earned session milestone in the quiz header.
// Percentage thresholds: 25% → tier 1, 50% → tier 2, 75% → tier 3.
// The `key` prop on the mount site is set to `milestoneTier` so React remounts
// the element (re-triggering the CSS animation) each time a new tier is earned.

const MILESTONE_DATA: Record<1 | 2 | 3, { label: string; emoji: string; pill: string; dot: string }> = {
  1: {
    label: "Warming Up",
    emoji: "🏃",
    pill: "border-sky-400/40 bg-sky-400/10 text-sky-600 dark:text-sky-400",
    dot:  "bg-sky-400",
  },
  2: {
    label: "In the Zone",
    emoji: "🧠",
    pill: "border-violet-400/40 bg-violet-400/10 text-violet-600 dark:text-violet-400",
    dot:  "bg-violet-400",
  },
  3: {
    label: "Heavyweight",
    emoji: "🦍",
    pill: "border-amber-400/40 bg-amber-400/10 text-amber-600 dark:text-amber-400",
    dot:  "bg-amber-400",
  },
}

function MilestoneTag({ tier }: { tier: 1 | 2 | 3 }) {
  const d = MILESTONE_DATA[tier]
  return (
    <span
      className={`animate-milestone-tag-in inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 ${d.pill}`}
      title={`Session milestone: ${d.label} ${d.emoji}`}
    >
      {/* Pulsing dot — accent for the current tier colour */}
      <span className={`relative flex h-1.5 w-1.5 shrink-0 rounded-full ${d.dot}`}>
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${d.dot} opacity-60`} />
      </span>
      {/* Full label on sm+, emoji-only on xs */}
      <span className="hidden text-[10px] font-bold uppercase tracking-wide sm:inline">
        {d.label}
      </span>
      <span className="text-[11px] sm:hidden">{d.emoji}</span>
      <span className="hidden text-[10px] sm:inline">{d.emoji}</span>
    </span>
  )
}
