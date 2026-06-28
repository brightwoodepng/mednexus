"use client"

import { useState, useEffect, useRef } from "react"
import { useQuestions } from "@/contexts/questions-context"
import type { Question } from "@/lib/types"

const MAX_LIVES = 3
const TIME_PER_Q = 15
const BASE_SCORE = 100
const HIGH_SCORE_KEY = "mednexus-game-highscore"

type Phase = "menu" | "playing" | "over"
type Feedback = "correct" | "wrong" | null

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function bonusFor(streak: number): number {
  if (streak >= 10) return 150
  if (streak >= 5) return 100
  if (streak >= 3) return 50
  return 0
}

function streakMsg(streak: number): string {
  if (streak >= 10) return "🔥🔥 ON FIRE!"
  if (streak >= 5) return "🔥 Hot streak!"
  if (streak >= 3) return "⚡ Streak!"
  return ""
}

// ── Option button ──────────────────────────────────────────────────────────────
function OptionButton({
  id, text, selected, isCorrect, feedback, onSelect,
}: {
  id: string; text: string; selected: boolean; isCorrect: boolean; feedback: Feedback; onSelect: () => void
}) {
  let base =
    "w-full rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium transition-all duration-200 "
  if (feedback === null) {
    base += selected
      ? "border-primary bg-primary/10 text-foreground"
      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]"
  } else if (isCorrect) {
    base +=
      "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
  } else if (selected) {
    base +=
      "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
  } else {
    base += "border-border bg-card text-muted-foreground/50"
  }

  const labelCls =
    feedback !== null && isCorrect
      ? "border-emerald-500 bg-emerald-500 text-white"
      : feedback !== null && selected
        ? "border-rose-500 bg-rose-500 text-white"
        : selected
          ? "border-primary bg-primary/20 text-primary"
          : "border-border text-muted-foreground"

  return (
    <button type="button" onClick={onSelect} disabled={feedback !== null} className={base}>
      <span className="inline-flex items-center gap-3">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${labelCls}`}
        >
          {id}
        </span>
        <span>{text}</span>
      </span>
    </button>
  )
}

// ── Menu Screen ────────────────────────────────────────────────────────────────
function MenuScreen({
  highScore, questionCount, onStart, onExit,
}: {
  highScore: number; questionCount: number; onStart: () => void; onExit: () => void
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-xl shadow-violet-500/25">
            <svg
              viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
              width={46} height={46}
            >
              <line x1="6" x2="10" y1="12" y2="12" />
              <line x1="8" x2="8" y1="10" y2="14" />
              <line x1="15" x2="17" y1="11" y2="11" />
              <line x1="15" x2="17" y1="13" y2="13" />
              <rect width="20" height="12" x="2" y="6" rx="2" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Game Mode</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Rapid-fire medical Q&A — lives, streaks, and high scores
          </p>
          {highScore > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-4 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
              🏆 High Score: {highScore.toLocaleString()}
            </div>
          )}
        </div>

        <div className="mb-5 rounded-3xl border border-border bg-card p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            How to Play
          </p>
          <div className="grid gap-3">
            {[
              { icon: "❤️", title: "3 Lives", desc: "Wrong answer or timeout costs 1 life" },
              { icon: "⏱️", title: "15 Seconds", desc: "Per question — think fast!" },
              { icon: "⚡", title: "Streak Bonus", desc: "3+ correct in a row = bonus points" },
              { icon: "📚", title: `${questionCount} Questions`, desc: "Shuffled from the full Q-Bank" },
            ].map(r => (
              <div key={r.title} className="flex items-center gap-3">
                <span className="w-7 shrink-0 text-center text-xl">{r.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-5 flex items-center justify-center gap-2">
          {[
            { label: "Correct", pts: "+100", cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
            { label: "3× Streak", pts: "+150", cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
            { label: "5× Streak", pts: "+200", cls: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400" },
            { label: "10× Streak", pts: "+250", cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
          ].map(s => (
            <div key={s.label} className={`flex flex-col items-center rounded-2xl px-2.5 py-2 text-center ${s.cls}`}>
              <span className="text-sm font-extrabold">{s.pts}</span>
              <span className="mt-0.5 text-[10px] font-medium">{s.label}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
        >
          Start Game
        </button>
        <button
          type="button"
          onClick={onExit}
          className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}

// ── Game Over Screen ───────────────────────────────────────────────────────────
function GameOverScreen({
  score, highScore, bestStreak, totalQ, totalRight, isNewHigh, onRestart, onExit,
}: {
  score: number; highScore: number; bestStreak: number; totalQ: number; totalRight: number
  isNewHigh: boolean; onRestart: () => void; onExit: () => void
}) {
  const accuracy = totalQ > 0 ? Math.round((totalRight / totalQ) * 100) : 0
  const trophy = accuracy >= 80 ? "🏆" : accuracy >= 60 ? "🎯" : "💪"

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 text-6xl">{trophy}</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Game Over!</h1>
          {isNewHigh && score > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
              🏆 New High Score!
            </div>
          )}
        </div>

        <div className="mb-5 rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-7 text-center">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Final Score
          </p>
          <p className="text-5xl font-extrabold tabular-nums text-foreground">
            {score.toLocaleString()}
          </p>
          {!isNewHigh && highScore > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">Best: {highScore.toLocaleString()}</p>
          )}
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { label: "Answered", value: String(totalQ) },
            { label: "Accuracy", value: `${accuracy}%` },
            { label: "Best Streak", value: `${bestStreak}×` },
          ].map(s => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
              <p className="text-xl font-extrabold text-foreground">{s.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]"
        >
          Play Again
        </button>
        <button
          type="button"
          onClick={onExit}
          className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}

// ── Playing Screen ─────────────────────────────────────────────────────────────
function PlayingScreen({
  question, lives, score, streak, timeLeft, feedback, picked, onAnswer, onQuit,
}: {
  question: Question; lives: number; score: number; streak: number
  timeLeft: number; feedback: Feedback; picked: string | null
  onAnswer: (id: string) => void; onQuit: () => void
}) {
  const pct = (timeLeft / TIME_PER_Q) * 100
  const timerColor =
    timeLeft <= 5 ? "bg-rose-500" : timeLeft <= 9 ? "bg-amber-500" : "bg-emerald-500"
  const msg = streakMsg(streak)
  const bonus = bonusFor(streak + 1)

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 sm:gap-4 sm:p-5 max-w-2xl mx-auto">
      {/* HUD */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <svg
              key={i}
              viewBox="0 0 24 24" width={22} height={22}
              fill={i < lives ? "currentColor" : "none"}
              stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
              className={`transition-all duration-300 ${i < lives ? "text-rose-500" : "text-border"}`}
            >
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
          ))}
        </div>
        <div className="flex-1" />
        {streak >= 3 && (
          <div className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
            🔥 {streak}×
          </div>
        )}
        <p className="text-xl font-extrabold tabular-nums text-foreground">
          {score.toLocaleString()}
        </p>
      </div>

      {/* Timer bar */}
      <div className="relative h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-linear ${timerColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Timer label + streak message */}
      <div className="-mt-1.5 flex items-center justify-between px-0.5">
        <span
          className={`text-xs font-bold tabular-nums ${timeLeft <= 5 ? "text-rose-500" : "text-muted-foreground"}`}
        >
          {timeLeft}s
        </span>
        {msg ? (
          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{msg}</span>
        ) : bonus > 0 && feedback === null ? (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            +{BASE_SCORE + bonus} if correct
          </span>
        ) : null}
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto rounded-3xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="max-w-[200px] truncate rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {question.subject}
          </span>
          {question.module && (
            <span className="max-w-[200px] truncate rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
              {question.module}
            </span>
          )}
        </div>
        <p className="text-sm leading-relaxed text-foreground sm:text-base">{question.vignette}</p>
      </div>

      {/* Options */}
      <div className="grid gap-2">
        {question.options.map(opt => (
          <OptionButton
            key={opt.id}
            id={opt.id}
            text={opt.text}
            selected={picked === opt.id}
            isCorrect={opt.id === question.correctAnswer}
            feedback={feedback}
            onSelect={() => onAnswer(opt.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onQuit}
        className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Quit Game
      </button>
    </div>
  )
}

// ── Root Component ─────────────────────────────────────────────────────────────
export function GameMode({ onExit }: { onExit: () => void }) {
  const { questions: allQ } = useQuestions()

  const [phase, setPhase] = useState<Phase>("menu")
  const [pool, setPool] = useState<Question[]>([])
  const [qi, setQi] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [totalQ, setTotalQ] = useState(0)
  const [totalRight, setTotalRight] = useState(0)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [highScore, setHighScore] = useState<number>(() => {
    try { return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0 } catch { return 0 }
  })

  // Mutable refs so timer callbacks always read the latest state
  const poolRef = useRef<Question[]>([])
  const qiRef = useRef(0)
  const feedbackRef = useRef<Feedback>(null)
  const phaseRef = useRef<Phase>("menu")
  const livesRef = useRef(MAX_LIVES)
  const scoreRef = useRef(0)
  const streakRef = useRef(0)
  const bestStreakRef = useRef(0)
  const totalQRef = useRef(0)
  const totalRightRef = useRef(0)
  const highScoreRef = useRef(0)

  // Keep refs in sync every render
  poolRef.current = pool
  qiRef.current = qi
  feedbackRef.current = feedback
  phaseRef.current = phase
  livesRef.current = lives
  scoreRef.current = score
  streakRef.current = streak
  bestStreakRef.current = bestStreak
  totalQRef.current = totalQ
  totalRightRef.current = totalRight
  highScoreRef.current = highScore

  // Ref to the answer handler — always points to the latest version
  const doAnswerRef = useRef<((choice: string | null) => void) | null>(null)

  function advance(nextLives: number, nextScore: number) {
    if (nextLives <= 0) {
      const best = Math.max(highScoreRef.current, nextScore)
      setIsNewHigh(nextScore > 0 && nextScore >= highScoreRef.current)
      setHighScore(best)
      try { localStorage.setItem(HIGH_SCORE_KEY, String(best)) } catch {}
      setPhase("over")
      phaseRef.current = "over"
      return
    }
    setFeedback(null)
    feedbackRef.current = null
    setPicked(null)
    setTimeLeft(TIME_PER_Q)
    setQi(prev => (prev + 1 >= poolRef.current.length ? 0 : prev + 1))
  }

  function doAnswer(choice: string | null) {
    if (feedbackRef.current !== null || phaseRef.current !== "playing") return

    const currentQ = poolRef.current[qiRef.current]
    if (!currentQ) return

    const isRight = choice !== null && choice === currentQ.correctAnswer
    const fb: Feedback = isRight ? "correct" : "wrong"
    setFeedback(fb)
    feedbackRef.current = fb
    setPicked(choice)

    const nextStreak = isRight ? streakRef.current + 1 : 0
    const nextBest = Math.max(bestStreakRef.current, nextStreak)
    const nextScore = isRight
      ? scoreRef.current + BASE_SCORE + bonusFor(nextStreak)
      : scoreRef.current
    const nextLives = isRight ? livesRef.current : livesRef.current - 1
    const nextTotalQ = totalQRef.current + 1
    const nextTotalRight = isRight ? totalRightRef.current + 1 : totalRightRef.current

    setLives(nextLives)
    setScore(nextScore)
    setStreak(nextStreak)
    setBestStreak(nextBest)
    setTotalQ(nextTotalQ)
    setTotalRight(nextTotalRight)

    // Update refs immediately so advance() sees latest values
    livesRef.current = nextLives
    scoreRef.current = nextScore
    streakRef.current = nextStreak
    bestStreakRef.current = nextBest
    totalQRef.current = nextTotalQ
    totalRightRef.current = nextTotalRight

    setTimeout(() => advance(nextLives, nextScore), 1100)
  }

  // Always point ref at the latest doAnswer closure
  doAnswerRef.current = doAnswer

  // ── Timer ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || feedback !== null) return

    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(id)
          doAnswerRef.current?.(null)
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(id)
  // qi in deps resets the interval for each new question
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, feedback, qi])

  function startGame() {
    const src = allQ.filter(q => !q.moduleStatus || q.moduleStatus === "live")
    const base = src.length >= 5 ? src : [...allQ]
    const shuffled = shuffle([...base])

    setPool(shuffled)
    poolRef.current = shuffled
    setQi(0)
    qiRef.current = 0
    setLives(MAX_LIVES)
    livesRef.current = MAX_LIVES
    setScore(0)
    scoreRef.current = 0
    setStreak(0)
    streakRef.current = 0
    setBestStreak(0)
    bestStreakRef.current = 0
    setTimeLeft(TIME_PER_Q)
    setFeedback(null)
    feedbackRef.current = null
    setPicked(null)
    setTotalQ(0)
    totalQRef.current = 0
    setTotalRight(0)
    totalRightRef.current = 0
    setIsNewHigh(false)
    setPhase("playing")
    phaseRef.current = "playing"
  }

  if (phase === "menu") {
    return (
      <MenuScreen
        highScore={highScore}
        questionCount={allQ.length}
        onStart={startGame}
        onExit={onExit}
      />
    )
  }

  if (phase === "over") {
    return (
      <GameOverScreen
        score={score}
        highScore={highScore}
        bestStreak={bestStreak}
        totalQ={totalQ}
        totalRight={totalRight}
        isNewHigh={isNewHigh}
        onRestart={startGame}
        onExit={onExit}
      />
    )
  }

  const currentQuestion = pool[qi]
  if (!currentQuestion) return null

  return (
    <PlayingScreen
      question={currentQuestion}
      lives={lives}
      score={score}
      streak={streak}
      timeLeft={timeLeft}
      feedback={feedback}
      picked={picked}
      onAnswer={doAnswer}
      onQuit={onExit}
    />
  )
}
