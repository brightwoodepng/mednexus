"use client"

import { useState, useEffect, useRef } from "react"
import { useQuestions } from "@/contexts/questions-context"
import type { Question } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────
type GameModeId = "rapid" | "sudden" | "timeatk" | "streak"
type Phase = "menu" | "playing" | "over"
type Feedback = "correct" | "wrong" | null

interface ModeConfig {
  id: GameModeId
  name: string
  badge: string
  badgeColor: string
  icon: string
  gradient: string
  shadow: string
  desc: string
  rules: string[]
  hsKey: string
  hsLabel: string
}

// ── Mode definitions ──────────────────────────────────────────────────────────
const MODES: ModeConfig[] = [
  {
    id: "rapid", name: "Rapid Fire", badge: "Classic",
    badgeColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    icon: "⚡", gradient: "from-violet-500 to-fuchsia-600", shadow: "shadow-violet-500/20",
    desc: "Race the clock — 3 lives, 15s per question, streak multipliers.",
    rules: ["3 lives — wrong or timeout costs 1", "15 seconds per question", "Streak bonuses up to +150 pts"],
    hsKey: "mednexus-hs-rapid", hsLabel: "Best Score",
  },
  {
    id: "sudden", name: "Sudden Death", badge: "High Risk",
    badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    icon: "💀", gradient: "from-rose-500 to-orange-500", shadow: "shadow-rose-500/20",
    desc: "One mistake ends everything. How many can you survive?",
    rules: ["Any wrong answer = instant game over", "20 seconds per question", "Score = questions survived × 100"],
    hsKey: "mednexus-hs-sudden", hsLabel: "Best Survived",
  },
  {
    id: "timeatk", name: "Time Attack", badge: "Speed",
    badgeColor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
    icon: "⏱️", gradient: "from-cyan-500 to-blue-600", shadow: "shadow-cyan-500/20",
    desc: "90 seconds on the clock. Right answers add time, wrong ones drain it.",
    rules: ["90-second total bank", "Correct: +100 pts +3 seconds", "Wrong: −5 seconds (no lives)"],
    hsKey: "mednexus-hs-timeatk", hsLabel: "Best Score",
  },
  {
    id: "streak", name: "Streak Master", badge: "Endurance",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: "🔥", gradient: "from-amber-400 to-rose-500", shadow: "shadow-amber-500/20",
    desc: "No game over. Build the longest streak you can, finish whenever you're ready.",
    rules: ["Wrong answer resets streak — game continues", "No timer, no pressure", "Finish anytime to bank your best streak"],
    hsKey: "mednexus-hs-streak", hsLabel: "Best Streak",
  },
]

// ── Utilities ─────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
function readHs(key: string): number {
  try { return Number(localStorage.getItem(key)) || 0 } catch { return 0 }
}
function writeHs(key: string, v: number) {
  try { localStorage.setItem(key, String(v)) } catch {}
}
function rapidBonus(streak: number): number {
  if (streak >= 10) return 150
  if (streak >= 5) return 100
  if (streak >= 3) return 50
  return 0
}
function streakMsg(streak: number): string {
  if (streak >= 10) return "🔥🔥 ON FIRE!"
  if (streak >= 5) return "🔥 Hot!"
  if (streak >= 3) return "⚡ Streak!"
  return ""
}
function makeSrc(allQ: Question[]): Question[] {
  const src = allQ.filter(q => !q.moduleStatus || q.moduleStatus === "live")
  return shuffle(src.length >= 5 ? src : [...allQ])
}

// ── Option button ─────────────────────────────────────────────────────────────
function OptionBtn({ id, text, sel, correct, fb, onSel }: {
  id: string; text: string; sel: boolean; correct: boolean; fb: Feedback; onSel: () => void
}) {
  let cls = "w-full rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium transition-all duration-200 "
  if (fb === null) {
    cls += sel ? "border-primary bg-primary/10 text-foreground"
      : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]"
  } else if (correct) {
    cls += "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
  } else if (sel) {
    cls += "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
  } else {
    cls += "border-border bg-card text-muted-foreground/50"
  }
  const lblCls =
    fb !== null && correct ? "border-emerald-500 bg-emerald-500 text-white"
    : fb !== null && sel ? "border-rose-500 bg-rose-500 text-white"
    : sel ? "border-primary bg-primary/20 text-primary"
    : "border-border text-muted-foreground"

  return (
    <button type="button" disabled={fb !== null} onClick={onSel} className={cls}>
      <span className="inline-flex items-center gap-3">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${lblCls}`}>{id}</span>
        <span>{text}</span>
      </span>
    </button>
  )
}

// ── Shared question layout ────────────────────────────────────────────────────
function QuestionView({ question, fb, picked, onAnswer, hud, footer }: {
  question: Question; fb: Feedback; picked: string | null
  onAnswer: (id: string) => void
  hud: React.ReactNode; footer?: React.ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col gap-3 p-3 sm:gap-4 sm:p-5 max-w-2xl mx-auto">
      {hud}
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
      <div className="grid gap-2">
        {question.options.map(opt => (
          <OptionBtn
            key={opt.id} id={opt.id} text={opt.text}
            sel={picked === opt.id} correct={opt.id === question.correctAnswer}
            fb={fb} onSel={() => onAnswer(opt.id)}
          />
        ))}
      </div>
      {footer}
    </div>
  )
}

// ── Shared game-over screen ───────────────────────────────────────────────────
function GameOver({ emoji, headline, scoreLabel, score, stats, isNewHigh, onReplay, onExit }: {
  emoji: string; headline: string; scoreLabel: string; score: number
  stats: { label: string; value: string }[]
  isNewHigh: boolean; onReplay: () => void; onExit: () => void
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mb-3 text-6xl">{emoji}</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{headline}</h1>
          {isNewHigh && score > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">
              🏆 New Best!
            </div>
          )}
        </div>
        <div className="mb-5 rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">{scoreLabel}</p>
          <p className="text-5xl font-extrabold tabular-nums text-foreground">{score.toLocaleString()}</p>
        </div>
        {stats.length > 0 && (
          <div className="mb-6 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)` }}>
            {stats.map(s => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
                <p className="text-xl font-extrabold text-foreground">{s.value}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={onReplay} className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]">
          Play Again
        </button>
        <button type="button" onClick={onExit} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Choose Mode
        </button>
      </div>
    </div>
  )
}

// ── Shared per-mode menu (start screen) ──────────────────────────────────────
function ModeMenu({ mode, hs, onStart, onBack }: {
  mode: ModeConfig; hs: number; onStart: () => void; onBack: () => void
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className={`mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br ${mode.gradient} shadow-xl ${mode.shadow} text-5xl`}>
            {mode.icon}
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{mode.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${mode.badgeColor}`}>{mode.badge}</span>
          </div>
          <p className="text-sm text-muted-foreground">{mode.desc}</p>
          {hs > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-4 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
              🏆 {mode.hsLabel}: {hs.toLocaleString()}
            </div>
          )}
        </div>
        <div className="mb-6 rounded-3xl border border-border bg-card p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rules</p>
          <div className="grid gap-2.5">
            {mode.rules.map(r => (
              <div key={r} className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${mode.gradient} text-[9px] font-bold text-white`}>✓</span>
                <span className="text-sm text-foreground">{r}</span>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button" onClick={onStart}
          className={`w-full rounded-2xl bg-gradient-to-r ${mode.gradient} py-4 text-base font-bold text-white shadow-lg ${mode.shadow} transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]`}
        >
          Start Game
        </button>
        <button type="button" onClick={onBack} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Back to Mode Select
        </button>
      </div>
    </div>
  )
}

// ── Mode Select Screen ────────────────────────────────────────────────────────
function ModeSelectScreen({ onSelect, onBack }: {
  onSelect: (id: GameModeId) => void; onBack: () => void
}) {
  return (
    <div className="flex min-h-full flex-col p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 shadow-xl shadow-violet-500/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={38} height={38}>
              <line x1="6" x2="10" y1="12" y2="12" /><line x1="8" x2="8" y1="10" y2="14" />
              <line x1="15" x2="17" y1="11" y2="11" /><line x1="15" x2="17" y1="13" y2="13" />
              <rect width="20" height="12" x="2" y="6" rx="2" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Game Mode</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pick a game type and start playing</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {MODES.map(m => {
            const hs = readHs(m.hsKey)
            return (
              <button
                key={m.id} type="button" onClick={() => onSelect(m.id)}
                className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/8 hover:scale-[1.01] active:scale-[0.99]"
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${m.gradient}`} />
                <div className="flex items-start gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${m.gradient} shadow-md ${m.shadow} text-2xl`}>
                    {m.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-bold text-foreground">{m.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.badgeColor}`}>{m.badge}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{m.desc}</p>
                  </div>
                </div>
                <div className="mt-3.5 space-y-1.5">
                  {m.rules.map(rule => (
                    <div key={rule} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                      {rule}
                    </div>
                  ))}
                </div>
                {hs > 0 && (
                  <div className="mt-3.5 flex items-center gap-1.5 rounded-xl bg-muted/70 px-3 py-2">
                    <span className="text-xs">🏆</span>
                    <span className="text-xs text-muted-foreground">{m.hsLabel}:</span>
                    <span className="text-xs font-bold text-foreground">{hs.toLocaleString()}</span>
                  </div>
                )}
                <div className={`mt-4 flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r ${m.gradient} py-2.5 text-sm font-bold text-white shadow-sm transition-opacity group-hover:opacity-90`}>
                  Play
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
              </button>
            )
          })}
        </div>

        <button type="button" onClick={onBack} className="mt-6 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}

// ── RAPID FIRE ────────────────────────────────────────────────────────────────
const RAPID_TIME = 15
const MAX_LIVES = 3
const BASE_PTS = 100

function RapidFireMode({ onExit }: { onExit: () => void }) {
  const { questions: allQ } = useQuestions()
  const cfg = MODES[0]

  const [phase, setPhase] = useState<Phase>("menu")
  const [pool, setPool] = useState<Question[]>([])
  const [qi, setQi] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [timeLeft, setTimeLeft] = useState(RAPID_TIME)
  const [fb, setFb] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [totalQ, setTotalQ] = useState(0)
  const [totalRight, setTotalRight] = useState(0)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))

  const r = useRef({ pool: [] as Question[], qi: 0, lives: MAX_LIVES, score: 0, streak: 0, bestStreak: 0, totalQ: 0, totalRight: 0, hs: 0, fb: null as Feedback, phase: "menu" as Phase })
  r.current = { pool, qi, lives, score, streak, bestStreak, totalQ, totalRight, hs, fb, phase }
  const doRef = useRef<((c: string | null) => void) | null>(null)

  function advance(nl: number, ns: number) {
    if (nl <= 0) {
      const best = Math.max(r.current.hs, ns)
      setIsNewHigh(ns > 0 && ns >= r.current.hs)
      setHsState(best); writeHs(cfg.hsKey, best)
      setPhase("over"); r.current.phase = "over"
      return
    }
    setFb(null); r.current.fb = null
    setPicked(null); setTimeLeft(RAPID_TIME)
    setQi(prev => prev + 1 >= r.current.pool.length ? 0 : prev + 1)
  }

  function doAnswer(c: string | null) {
    if (r.current.fb !== null || r.current.phase !== "playing") return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c !== null && c === q.correctAnswer
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    const ns = right ? r.current.streak + 1 : 0
    const nb = Math.max(r.current.bestStreak, ns)
    const nsc = right ? r.current.score + BASE_PTS + rapidBonus(ns) : r.current.score
    const nl = right ? r.current.lives : r.current.lives - 1
    const ntq = r.current.totalQ + 1; const ntr = right ? r.current.totalRight + 1 : r.current.totalRight
    setLives(nl); setScore(nsc); setStreak(ns); setBestStreak(nb); setTotalQ(ntq); setTotalRight(ntr)
    r.current.lives = nl; r.current.score = nsc; r.current.streak = ns; r.current.bestStreak = nb; r.current.totalQ = ntq; r.current.totalRight = ntr
    setTimeout(() => advance(nl, nsc), 1100)
  }
  doRef.current = doAnswer

  useEffect(() => {
    if (phase !== "playing" || fb !== null) return
    const id = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(id); doRef.current?.(null); return 0 } return t - 1 }), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fb, qi])

  function start() {
    const p = makeSrc(allQ)
    setPool(p); r.current.pool = p; setQi(0); r.current.qi = 0
    setLives(MAX_LIVES); r.current.lives = MAX_LIVES
    setScore(0); r.current.score = 0; setStreak(0); r.current.streak = 0
    setBestStreak(0); r.current.bestStreak = 0; setTimeLeft(RAPID_TIME)
    setFb(null); r.current.fb = null; setPicked(null)
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setIsNewHigh(false); setPhase("playing"); r.current.phase = "playing"
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    return <GameOver emoji={acc >= 80 ? "🏆" : acc >= 60 ? "🎯" : "💪"} headline="Game Over!" scoreLabel="Final Score" score={score} stats={[{ label: "Answered", value: String(totalQ) }, { label: "Accuracy", value: `${acc}%` }, { label: "Best Streak", value: `${bestStreak}×` }]} isNewHigh={isNewHigh} onReplay={start} onExit={onExit} />
  }
  const q = pool[qi]; if (!q) return null
  const pct = (timeLeft / RAPID_TIME) * 100
  const tc = timeLeft <= 5 ? "bg-rose-500" : timeLeft <= 9 ? "bg-amber-500" : "bg-emerald-500"
  const msg = streakMsg(streak); const bonus = rapidBonus(streak + 1)

  return (
    <QuestionView question={q} fb={fb} picked={picked} onAnswer={doAnswer}
      hud={
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <svg key={i} viewBox="0 0 24 24" width={22} height={22} fill={i < lives ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={i < lives ? "text-rose-500" : "text-border"}>
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              ))}
            </div>
            <div className="flex-1" />
            {streak >= 3 && <div className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-400">🔥 {streak}×</div>}
            <p className="text-xl font-extrabold tabular-nums text-foreground">{score.toLocaleString()}</p>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-linear ${tc}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className={`text-xs font-bold tabular-nums ${timeLeft <= 5 ? "text-rose-500" : "text-muted-foreground"}`}>{timeLeft}s</span>
            {msg ? <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{msg}</span> : bonus > 0 && fb === null ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{BASE_PTS + bonus} if correct</span> : null}
          </div>
        </div>
      }
      footer={<button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Quit Game</button>}
    />
  )
}

// ── SUDDEN DEATH ──────────────────────────────────────────────────────────────
const SUDDEN_TIME = 20

function SuddenDeathMode({ onExit }: { onExit: () => void }) {
  const { questions: allQ } = useQuestions()
  const cfg = MODES[1]

  const [phase, setPhase] = useState<Phase>("menu")
  const [pool, setPool] = useState<Question[]>([])
  const [qi, setQi] = useState(0)
  const [survived, setSurvived] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SUDDEN_TIME)
  const [fb, setFb] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))

  const r = useRef({ pool: [] as Question[], qi: 0, survived: 0, hs: 0, fb: null as Feedback, phase: "menu" as Phase })
  r.current = { pool, qi, survived, hs, fb, phase }
  const doRef = useRef<((c: string | null) => void) | null>(null)

  function endGame(finalSurvived: number) {
    const score = finalSurvived * BASE_PTS
    const best = Math.max(r.current.hs, finalSurvived)
    setIsNewHigh(finalSurvived > 0 && finalSurvived >= r.current.hs)
    setHsState(best); writeHs(cfg.hsKey, best)
    setSurvived(finalSurvived)
    setPhase("over"); r.current.phase = "over"
    return score
  }

  function doAnswer(c: string | null) {
    if (r.current.fb !== null || r.current.phase !== "playing") return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c !== null && c === q.correctAnswer
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    if (right) {
      const ns = r.current.survived + 1
      setSurvived(ns); r.current.survived = ns
      setTimeout(() => {
        setFb(null); r.current.fb = null; setPicked(null); setTimeLeft(SUDDEN_TIME)
        setQi(prev => prev + 1 >= r.current.pool.length ? 0 : prev + 1)
      }, 900)
    } else {
      setTimeout(() => endGame(r.current.survived), 900)
    }
  }
  doRef.current = doAnswer

  useEffect(() => {
    if (phase !== "playing" || fb !== null) return
    const id = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(id); doRef.current?.(null); return 0 } return t - 1 }), 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fb, qi])

  function start() {
    const p = makeSrc(allQ)
    setPool(p); r.current.pool = p; setQi(0); r.current.qi = 0
    setSurvived(0); r.current.survived = 0; setTimeLeft(SUDDEN_TIME)
    setFb(null); r.current.fb = null; setPicked(null)
    setIsNewHigh(false); setPhase("playing"); r.current.phase = "playing"
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const score = survived * BASE_PTS
    return <GameOver emoji={survived >= 20 ? "💀🏆" : survived >= 10 ? "😤" : "💀"} headline={survived === 0 ? "Out on Question 1!" : `${survived} Questions Survived`} scoreLabel="Score" score={score} stats={[{ label: "Survived", value: String(survived) }, { label: "Best", value: String(hs) + " questions" }]} isNewHigh={isNewHigh} onReplay={start} onExit={onExit} />
  }
  const q = pool[qi]; if (!q) return null
  const pct = (timeLeft / SUDDEN_TIME) * 100
  const tc = timeLeft <= 5 ? "bg-rose-500" : timeLeft <= 10 ? "bg-amber-500" : "bg-rose-400"

  return (
    <QuestionView question={q} fb={fb} picked={picked} onAnswer={doAnswer}
      hud={
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5">
              <span className="text-sm">💀</span>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400">Survived: {survived}</span>
            </div>
            <div className="flex-1" />
            <p className="text-xl font-extrabold tabular-nums text-foreground">{(survived * BASE_PTS).toLocaleString()}</p>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-linear ${tc}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className={`text-xs font-bold tabular-nums ${timeLeft <= 5 ? "text-rose-600" : "text-muted-foreground"}`}>{timeLeft}s</span>
            <span className="text-[11px] font-semibold text-rose-500/70">One wrong = game over</span>
          </div>
        </div>
      }
      footer={<button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Quit Game</button>}
    />
  )
}

// ── TIME ATTACK ───────────────────────────────────────────────────────────────
const TIMEATK_START = 90

function TimeAttackMode({ onExit }: { onExit: () => void }) {
  const { questions: allQ } = useQuestions()
  const cfg = MODES[2]

  const [phase, setPhase] = useState<Phase>("menu")
  const [pool, setPool] = useState<Question[]>([])
  const [qi, setQi] = useState(0)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(TIMEATK_START)
  const [fb, setFb] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [totalQ, setTotalQ] = useState(0)
  const [totalRight, setTotalRight] = useState(0)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))

  const r = useRef({ pool: [] as Question[], qi: 0, score: 0, timeLeft: TIMEATK_START, hs: 0, fb: null as Feedback, phase: "menu" as Phase, totalQ: 0, totalRight: 0 })
  r.current = { pool, qi, score, timeLeft, hs, fb, phase, totalQ, totalRight }

  function endGame(finalScore: number) {
    const best = Math.max(r.current.hs, finalScore)
    setIsNewHigh(finalScore > 0 && finalScore >= r.current.hs)
    setHsState(best); writeHs(cfg.hsKey, best)
    setPhase("over"); r.current.phase = "over"
  }

  function doAnswer(c: string | null) {
    if (r.current.fb !== null || r.current.phase !== "playing") return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c !== null && c === q.correctAnswer
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    const ns = right ? r.current.score + BASE_PTS : r.current.score
    const nt = right ? Math.min(r.current.timeLeft + 3, 999) : Math.max(r.current.timeLeft - 5, 0)
    const ntq = r.current.totalQ + 1; const ntr = right ? r.current.totalRight + 1 : r.current.totalRight
    setScore(ns); setTimeLeft(nt); setTotalQ(ntq); setTotalRight(ntr)
    r.current.score = ns; r.current.timeLeft = nt; r.current.totalQ = ntq; r.current.totalRight = ntr
    if (nt <= 0) { setTimeout(() => endGame(ns), 700); return }
    setTimeout(() => {
      setFb(null); r.current.fb = null; setPicked(null)
      setQi(prev => prev + 1 >= r.current.pool.length ? 0 : prev + 1)
    }, 700)
  }

  // Global timer — one tick per second, no per-question reset
  useEffect(() => {
    if (phase !== "playing") return
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(id); endGame(r.current.score); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function start() {
    const p = makeSrc(allQ)
    setPool(p); r.current.pool = p; setQi(0); r.current.qi = 0
    setScore(0); r.current.score = 0; setTimeLeft(TIMEATK_START); r.current.timeLeft = TIMEATK_START
    setFb(null); r.current.fb = null; setPicked(null)
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setIsNewHigh(false); setPhase("playing"); r.current.phase = "playing"
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    return <GameOver emoji={acc >= 80 ? "⚡🏆" : acc >= 60 ? "⏱️" : "💨"} headline="Time's Up!" scoreLabel="Final Score" score={score} stats={[{ label: "Answered", value: String(totalQ) }, { label: "Correct", value: String(totalRight) }, { label: "Accuracy", value: `${acc}%` }]} isNewHigh={isNewHigh} onReplay={start} onExit={onExit} />
  }
  const q = pool[qi]; if (!q) return null
  const pct = Math.min((timeLeft / TIMEATK_START) * 100, 100)
  const tc = timeLeft <= 10 ? "bg-rose-500" : timeLeft <= 25 ? "bg-amber-500" : "bg-cyan-500"

  return (
    <QuestionView question={q} fb={fb} picked={picked} onAnswer={doAnswer}
      hud={
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18} className={timeLeft <= 10 ? "text-rose-500" : "text-cyan-500"}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className={`text-2xl font-extrabold tabular-nums ${timeLeft <= 10 ? "text-rose-500" : "text-foreground"}`}>{timeLeft}s</span>
            </div>
            <div className="flex-1" />
            <p className="text-xl font-extrabold tabular-nums text-foreground">{score.toLocaleString()}</p>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-muted">
            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-linear ${tc}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">✓ +100 pts +3s</span>
            <span className="text-xs text-rose-500 font-semibold">✗ −5s</span>
          </div>
        </div>
      }
      footer={<button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Quit Game</button>}
    />
  )
}

// ── STREAK MASTER ─────────────────────────────────────────────────────────────
function StreakMasterMode({ onExit }: { onExit: () => void }) {
  const { questions: allQ } = useQuestions()
  const cfg = MODES[3]

  const [phase, setPhase] = useState<Phase>("menu")
  const [pool, setPool] = useState<Question[]>([])
  const [qi, setQi] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [totalQ, setTotalQ] = useState(0)
  const [totalRight, setTotalRight] = useState(0)
  const [fb, setFb] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))

  const r = useRef({ pool: [] as Question[], qi: 0, streak: 0, bestStreak: 0, totalQ: 0, totalRight: 0, hs: 0, fb: null as Feedback })
  r.current = { pool, qi, streak, bestStreak, totalQ, totalRight, hs, fb }

  function doAnswer(c: string) {
    if (r.current.fb !== null) return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c === q.correctAnswer
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    const ns = right ? r.current.streak + 1 : 0
    const nb = Math.max(r.current.bestStreak, ns)
    const ntq = r.current.totalQ + 1; const ntr = right ? r.current.totalRight + 1 : r.current.totalRight
    setStreak(ns); setBestStreak(nb); setTotalQ(ntq); setTotalRight(ntr)
    r.current.streak = ns; r.current.bestStreak = nb; r.current.totalQ = ntq; r.current.totalRight = ntr
    setTimeout(() => {
      setFb(null); r.current.fb = null; setPicked(null)
      setQi(prev => prev + 1 >= r.current.pool.length ? 0 : prev + 1)
    }, 900)
  }

  function finishGame() {
    const best = Math.max(r.current.hs, r.current.bestStreak)
    setIsNewHigh(r.current.bestStreak > 0 && r.current.bestStreak >= r.current.hs)
    setHsState(best); writeHs(cfg.hsKey, best)
    setPhase("over")
  }

  function start() {
    const p = makeSrc(allQ)
    setPool(p); r.current.pool = p; setQi(0); r.current.qi = 0
    setStreak(0); r.current.streak = 0; setBestStreak(0); r.current.bestStreak = 0
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setFb(null); r.current.fb = null; setPicked(null)
    setIsNewHigh(false); setPhase("playing")
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    const finalScore = bestStreak * 50 + totalRight * 10
    return <GameOver emoji={bestStreak >= 15 ? "🔥🏆" : bestStreak >= 8 ? "🔥" : "💪"} headline="Great run!" scoreLabel="Score" score={finalScore} stats={[{ label: "Best Streak", value: `${bestStreak}×` }, { label: "Answered", value: String(totalQ) }, { label: "Accuracy", value: `${acc}%` }]} isNewHigh={isNewHigh} onReplay={start} onExit={onExit} />
  }

  const q = pool[qi]; if (!q) return null
  const msg = streakMsg(streak)

  return (
    <QuestionView question={q} fb={fb} picked={picked} onAnswer={doAnswer}
      hud={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
            <span className="text-base">🔥</span>
            <div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold leading-none">Streak</p>
              <p className="text-xl font-extrabold tabular-nums text-amber-700 dark:text-amber-300 leading-none mt-0.5">{streak}×</p>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[11px] text-muted-foreground">Best: <span className="font-bold text-foreground">{bestStreak}×</span></p>
            {msg && <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400">{msg}</p>}
          </div>
          <div className="flex-1" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Answered</p>
            <p className="text-sm font-extrabold tabular-nums text-foreground">{totalQ}</p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <button type="button" onClick={finishGame} disabled={fb !== null} className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-rose-500 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50">
            Finish Game
          </button>
          <button type="button" onClick={onExit} className="rounded-2xl border border-border py-2.5 px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Quit
          </button>
        </div>
      }
    />
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export function GameMode({ onExit }: { onExit: () => void }) {
  const [activeMode, setActiveMode] = useState<GameModeId | null>(null)

  if (activeMode === "rapid") return <RapidFireMode onExit={() => setActiveMode(null)} />
  if (activeMode === "sudden") return <SuddenDeathMode onExit={() => setActiveMode(null)} />
  if (activeMode === "timeatk") return <TimeAttackMode onExit={() => setActiveMode(null)} />
  if (activeMode === "streak") return <StreakMasterMode onExit={() => setActiveMode(null)} />

  return <ModeSelectScreen onSelect={setActiveMode} onBack={onExit} />
}
