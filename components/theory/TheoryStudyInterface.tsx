"use client"

/**
 * TheoryStudyInterface — interactive study session for a Theory Vault question set.
 *
 * Receives server-fetched questions and manages:
 *  – Review vs. Practice mode toggle
 *  – Textarea editor + Web Speech API dictation (Practice mode)
 *  – Reveal answer + self-grading engine
 *  – Prev / Next navigation (Next gated on a self-rating)
 */

import { useState, useRef, useCallback, useEffect } from "react"
import Link from "next/link"
import {
  BookOpenIcon,
  PencilIcon,
  MicIcon,
  MicOffIcon,
  EyeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SmileIcon,
  MinusIcon,
  FrownIcon,
  CheckIcon,
} from "lucide-react"
import { TheoryAnswer } from "./TheoryAnswer"
import type { TheoryQuestion } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

type StudyMode = "review" | "practice"
type RatingValue = "good" | "partial" | "revision"

interface Props {
  questions: TheoryQuestion[]
  setTitle: string
  moduleDisplayName: string
  categoryDisplayName: string
  browseUrl: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RATING_CONFIG: Record<
  RatingValue,
  { label: string; icon: React.ReactNode; classes: string; activeClasses: string }
> = {
  good: {
    label: "Nailed it",
    icon: <SmileIcon size={16} />,
    classes:
      "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700/50 dark:text-emerald-400 dark:hover:bg-emerald-900/20",
    activeClasses:
      "border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-400/60 dark:border-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  partial: {
    label: "Partial",
    icon: <MinusIcon size={16} />,
    classes:
      "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700/50 dark:text-amber-400 dark:hover:bg-amber-900/20",
    activeClasses:
      "border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-400/60 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-400",
  },
  revision: {
    label: "Needs Revision",
    icon: <FrownIcon size={16} />,
    classes:
      "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700/50 dark:text-red-400 dark:hover:bg-red-900/20",
    activeClasses:
      "border-red-500 bg-red-50 text-red-700 ring-1 ring-red-400/60 dark:border-red-500 dark:bg-red-900/30 dark:text-red-400",
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TheoryStudyInterface({
  questions,
  setTitle,
  moduleDisplayName,
  categoryDisplayName,
  browseUrl,
}: Props) {
  // ── Per-session state ──────────────────────────────────────────────────────
  const [mode, setMode] = useState<StudyMode>("review")
  const [currentIdx, setCurrentIdx] = useState(0)

  // Per-question state (reset on navigation)
  const [userAnswer, setUserAnswer] = useState("")
  const [isRevealed, setIsRevealed] = useState(false)
  const [isListening, setIsListening] = useState(false)

  // Ratings persist across navigation so the user sees their previous choice
  const [ratings, setRatings] = useState<Record<number, RatingValue>>({})

  const recognitionRef = useRef<any>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const q = questions[currentIdx]
  const totalQ = questions.length
  const currentRating = ratings[currentIdx]

  // Answer is visible when in review mode, or when revealed in practice mode
  const showAnswer = mode === "review" || isRevealed

  // Next is gated on selecting a rating once the answer is shown
  const canGoNext = showAnswer && !!currentRating && currentIdx < totalQ - 1
  const canGoPrev = currentIdx > 0

  // ── Navigation ─────────────────────────────────────────────────────────────
  const navigateTo = useCallback(
    (idx: number) => {
      stopDictation()
      setCurrentIdx(idx)
      setUserAnswer("")
      setIsRevealed(false)
      // ratings intentionally preserved
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const goNext = () => { if (canGoNext) navigateTo(currentIdx + 1) }
  const goPrev = () => { if (canGoPrev) navigateTo(currentIdx - 1) }

  // ── Mode toggle ────────────────────────────────────────────────────────────
  const switchMode = (newMode: StudyMode) => {
    if (newMode === mode) return
    stopDictation()
    setMode(newMode)
    // When switching to review, reveal is implicit; in practice, start fresh
    setIsRevealed(false)
    setUserAnswer("")
  }

  // ── Rating ─────────────────────────────────────────────────────────────────
  const selectRating = (r: RatingValue) =>
    setRatings((prev) => ({ ...prev, [currentIdx]: r }))

  // ── Reveal ─────────────────────────────────────────────────────────────────
  const revealAnswer = () => {
    stopDictation()
    setIsRevealed(true)
  }

  // ── Web Speech API dictation ───────────────────────────────────────────────
  const stopDictation = () => {
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    setIsListening(false)
  }

  const toggleDictation = () => {
    if (isListening) { stopDictation(); return }

    const SRClass =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition)) as any

    if (!SRClass) {
      alert("Speech recognition is not supported in this browser. Try Chrome or Edge.")
      return
    }

    const rec = new SRClass()
    rec.continuous = true
    rec.interimResults = false
    rec.lang = "en-GB"

    rec.onstart = () => setIsListening(true)
    rec.onend = () => setIsListening(false)
    rec.onerror = () => setIsListening(false)

    rec.onresult = (e: any) => {
      let transcript = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcript += e.results[i][0].transcript + " "
      }
      if (transcript) {
        setUserAnswer((prev) => (prev ? prev.trimEnd() + " " + transcript : transcript))
        // Auto-resize textarea
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
            textareaRef.current.style.height = textareaRef.current.scrollHeight + "px"
          }
        }, 0)
      }
    }

    try {
      rec.start()
      recognitionRef.current = rec
    } catch {
      setIsListening(false)
    }
  }

  // Clean up on unmount
  useEffect(() => {
    return () => { try { recognitionRef.current?.stop() } catch {} }
  }, [])

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserAnswer(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = e.target.scrollHeight + "px"
  }

  if (!q) return null

  return (
    <div className="flex min-h-screen flex-col bg-background">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">

          {/* Back */}
          <Link
            href={browseUrl}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
            title="Back to browse"
          >
            <ChevronLeftIcon size={16} />
          </Link>

          {/* Breadcrumb + counter */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              {categoryDisplayName} · {moduleDisplayName}
            </p>
            <p className="text-sm font-semibold text-foreground">
              {setTitle}
              <span className="ml-2 font-normal text-muted-foreground">
                — Question {currentIdx + 1} of {totalQ}
              </span>
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => switchMode("review")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === "review"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BookOpenIcon size={13} />
              <span className="hidden sm:inline">Review</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode("practice")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                mode === "practice"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <PencilIcon size={13} />
              <span className="hidden sm:inline">Practice</span>
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-amber-500 transition-all duration-300"
            style={{ width: `${((currentIdx + 1) / totalQ) * 100}%` }}
          />
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-8">
        <div className="space-y-5">

          {/* ── Question prompt card ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                Q{currentIdx + 1}
              </span>
              {q.tags.slice(0, 2).map((tag, i) => (
                <span
                  key={i}
                  className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
            <p className="text-[15px] font-medium leading-relaxed text-foreground">
              {q.prompt}
            </p>
            {q.pastPapers.length > 0 && (
              <p className="mt-3 text-[10px] text-muted-foreground">
                📄 {q.pastPapers.join(" · ")}
              </p>
            )}
          </div>

          {/* ── Review mode: answer immediately ──────────────────────────── */}
          {mode === "review" && (
            <TheoryAnswer modelAnswer={q.modelAnswer} criticalFlags={q.criticalFlags} />
          )}

          {/* ── Practice mode: textarea + reveal flow ────────────────────── */}
          {mode === "practice" && (
            <div className="space-y-4">
              {/* Textarea editor */}
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <span className="text-xs font-medium text-muted-foreground">Your answer</span>
                  <button
                    type="button"
                    onClick={toggleDictation}
                    disabled={isRevealed}
                    title={isListening ? "Stop dictation" : "Dictate answer"}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isListening
                        ? "border-red-400/60 bg-red-50 text-red-600 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-400"
                        : "border-border text-muted-foreground hover:border-teal-400/60 hover:text-teal-600 dark:hover:text-teal-400"
                    }`}
                  >
                    {isListening ? <MicOffIcon size={12} /> : <MicIcon size={12} />}
                    {isListening ? "Stop" : "Dictate"}
                    {isListening && (
                      <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                    )}
                  </button>
                </div>
                <textarea
                  ref={textareaRef}
                  value={userAnswer}
                  onChange={handleTextareaChange}
                  disabled={isRevealed}
                  placeholder="Write your answer here… or use the Dictate button to speak it."
                  rows={6}
                  className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ minHeight: "9rem" }}
                />
              </div>

              {/* Reveal button */}
              {!isRevealed && (
                <button
                  type="button"
                  onClick={revealAnswer}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-teal-300/60 bg-teal-50 py-3 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-100 dark:border-teal-700/40 dark:bg-teal-900/20 dark:text-teal-400 dark:hover:bg-teal-900/30"
                >
                  <EyeIcon size={16} />
                  Reveal Suggested Answer
                </button>
              )}

              {/* Answer revealed */}
              {isRevealed && (
                <TheoryAnswer modelAnswer={q.modelAnswer} criticalFlags={q.criticalFlags} />
              )}
            </div>
          )}

          {/* ── Self-grading panel (visible whenever answer is shown) ─────── */}
          {showAnswer && (
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                How did you do?
              </p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {(["good", "partial", "revision"] as RatingValue[]).map((r) => {
                  const cfg = RATING_CONFIG[r]
                  const isActive = currentRating === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => selectRating(r)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-all ${
                        isActive ? cfg.activeClasses : cfg.classes
                      }`}
                    >
                      <span className="text-base">{cfg.icon}</span>
                      {isActive && <CheckIcon size={10} className="absolute" />}
                      <span className="leading-tight text-center">{cfg.label}</span>
                    </button>
                  )
                })}
              </div>
              {!currentRating && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Select a rating to unlock the Next button
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ── Sticky footer navigation ────────────────────────────────────────── */}
      <footer className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">

          {/* Previous */}
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeftIcon size={15} />
            Previous
          </button>

          {/* Dot indicator */}
          <div className="flex items-center gap-1 overflow-hidden">
            {questions.map((_, i) => {
              const r = ratings[i]
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => navigateTo(i)}
                  title={`Question ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    i === currentIdx
                      ? "w-5 bg-amber-500"
                      : r === "good"
                      ? "w-2 bg-emerald-400"
                      : r === "partial"
                      ? "w-2 bg-amber-400"
                      : r === "revision"
                      ? "w-2 bg-red-400"
                      : "w-2 bg-muted-foreground/30"
                  }`}
                />
              )
            })}
          </div>

          {/* Next / Finish */}
          {currentIdx < totalQ - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext}
              title={
                !showAnswer
                  ? "Reveal the answer first"
                  : !currentRating
                  ? "Rate this question first"
                  : undefined
              }
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next Question
              <ChevronRightIcon size={15} />
            </button>
          ) : (
            <Link
              href={browseUrl}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
                showAnswer && currentRating
                  ? "bg-teal-600 hover:bg-teal-700"
                  : "pointer-events-none bg-muted-foreground/40"
              }`}
            >
              Finish Set
              <CheckIcon size={15} />
            </Link>
          )}
        </div>
      </footer>
    </div>
  )
}
