"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useQuestions } from "@/contexts/questions-context"
import type { Question } from "@/lib/types"
import { MultiplayerClash, CohortReview } from "@/components/game-mode-multiplayer"
import { useEconomy } from "@/contexts/economy-context"
import { WalletBadge, DailyBountiesPanel, StoreModal, PayoutResult } from "@/components/economy-panel"

// ── Types ─────────────────────────────────────────────────────────────────────
type GameModeId = "rapid" | "sudden" | "timeatk" | "streak" | "double" | "clash" | "cohort" | "wager"
type AppView = "hero" | "solo" | "multi" | "quickjoin" | GameModeId
type Phase = "menu" | "playing" | "over"
type Feedback = "correct" | "wrong" | null
type FilterScope = "all" | "module" | "subject"
interface AnswerHistoryEntry { question: Question; selected: string | null }

interface GameFilter {
  scope: FilterScope
  value: string | null
}

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
  {
    id: "double", name: "Double Jeopardy", badge: "Confidence",
    badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    icon: "🎲", gradient: "from-indigo-500 to-purple-600", shadow: "shadow-indigo-500/20",
    desc: "Read the vignette, wager your confidence — then see the options.",
    rules: ["Vignette shown first, options hidden", "Wager: Safe 10% / Moderate 25% / Bold 50% / All In 100%", "Correct = win the wager · Wrong = lose it"],
    hsKey: "mednexus-hs-double", hsLabel: "Best Score",
  },
]

// Multiplayer modes (shown separately in the grid)
interface MultiModeCard {
  id: GameModeId; name: string; badge: string; badgeColor: string
  icon: string; gradient: string; shadow: string; desc: string; rules: string[]
}
const MULTI_MODES: MultiModeCard[] = [
  {
    id: "clash", name: "Multiplayer Clash", badge: "Study Group",
    badgeColor: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
    icon: "⚔️", gradient: "from-fuchsia-500 to-violet-600", shadow: "shadow-fuchsia-500/20",
    desc: "Compete with up to 5 players. Fastest correct answer takes max points.",
    rules: ["Max 5 players per room", "6-digit PIN to join", "Full leaderboard between questions"],
  },
  {
    id: "cohort", name: "Cohort Review", badge: "Kahoot Style",
    badgeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    icon: "🎓", gradient: "from-teal-500 to-cyan-500", shadow: "shadow-teal-500/20",
    desc: "Lecture hall mode — unlimited players, host controls the pace.",
    rules: ["Unlimited players", "Players use phones as buzzers (A/B/C/D)", "Top 5 leaderboard · Personal rank banner"],
  },
  {
    id: "wager", name: "Wager Wars", badge: "High Stakes",
    badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: "🎰", gradient: "from-amber-500 to-rose-500", shadow: "shadow-amber-500/20",
    desc: "Bet before seeing options. Win big or lose it all — spectate when broke.",
    rules: ["Vignette shown first, options hidden", "Wager: Safe / Moderate / Bold / All-In", "Balance hits 0 → Spectator mode"],
  },
]

const DEFAULT_FILTER: GameFilter = { scope: "all", value: null }

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

/** Returns a shuffled pool of live questions, optionally filtered by module or subject.
 *  Falls back to the full set if the filtered result is fewer than 3 questions. */
function makeFilteredSrc(allQ: Question[], filter: GameFilter): Question[] {
  let base = allQ.filter(q => !q.moduleStatus || q.moduleStatus === "live")
  if (base.length < 5) base = [...allQ]
  if (filter.scope === "module" && filter.value) {
    const f = base.filter(q => q.module === filter.value)
    if (f.length >= 3) base = f
  } else if (filter.scope === "subject" && filter.value) {
    const f = base.filter(q => q.subject === filter.value)
    if (f.length >= 3) base = f
  }
  return shuffle(base)
}

/** Count how many (live) questions match a filter. */
function countForFilter(allQ: Question[], filter: GameFilter): number {
  let base = allQ.filter(q => !q.moduleStatus || q.moduleStatus === "live")
  if (base.length < 5) base = [...allQ]
  if (filter.scope === "module" && filter.value) return base.filter(q => q.module === filter.value).length
  if (filter.scope === "subject" && filter.value) return base.filter(q => q.subject === filter.value).length
  return base.length
}

// ── Option button ─────────────────────────────────────────────────────────────
function OptionBtn({ id, text, sel, correct, fb, onSel, eliminated = false }: {
  id: string; text: string; sel: boolean; correct: boolean; fb: Feedback; onSel: () => void; eliminated?: boolean
}) {
  if (eliminated) {
    return (
      <div className="w-full rounded-2xl border-2 border-border/30 bg-muted/20 px-4 py-3.5 text-left text-sm font-medium opacity-35">
        <span className="inline-flex items-center gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/30 text-[11px] font-bold text-muted-foreground/50">{id}</span>
          <span className="line-through text-muted-foreground/40">— eliminated —</span>
        </span>
      </div>
    )
  }

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
function QuestionView({ question, fb, picked, onAnswer, hud, footer, eliminated }: {
  question: Question; fb: Feedback; picked: string | null
  onAnswer: (id: string) => void
  hud: React.ReactNode; footer?: React.ReactNode
  eliminated?: Set<string>
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
            eliminated={eliminated?.has(opt.id) ?? false}
          />
        ))}
      </div>
      {footer}
    </div>
  )
}

// ── Shared game-over screen ───────────────────────────────────────────────────
interface GameResult {
  mode: string; score: number; correct: number; total: number
  bestStreak: number; isNewHigh: boolean; survivedCount?: number
}

function GameOver({ emoji, headline, scoreLabel, score, stats, isNewHigh, gameResult, answerHistory, onReplay, onExit }: {
  emoji: string; headline: string; scoreLabel: string; score: number
  stats: { label: string; value: string }[]
  isNewHigh: boolean; gameResult?: GameResult
  answerHistory?: AnswerHistoryEntry[]
  onReplay: () => void; onExit: () => void
}) {
  const { submitGameResult } = useEconomy()
  const [payoutData, setPayoutData] = useState<{
    earned: number
    breakdown: { label: string; amount: number }[]
    bountyUpdates: { id: string; progress: number; target: number; newlyComplete: boolean }[]
  } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const submitted = useRef(false)

  useEffect(() => {
    if (!gameResult || submitted.current) return
    submitted.current = true
    submitGameResult(gameResult).then(data => { if (data) setPayoutData(data) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* ── Review Drawer ── */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setReviewOpen(false)}>
          <div className="ml-auto flex h-full w-full max-w-lg flex-col bg-background shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-extrabold text-foreground">📖 Vignette Review</h2>
              <button type="button" onClick={() => setReviewOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted text-muted-foreground text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(answerHistory ?? []).map((entry, i) => {
                const isCorrect = entry.selected === entry.question.correctAnswer
                return (
                  <div key={i} className="rounded-3xl border border-border bg-card p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${isCorrect ? "bg-emerald-500" : "bg-rose-500"}`}>
                        {isCorrect ? "✓" : "✗"}
                      </span>
                      <span className="text-[11px] font-bold text-primary">{entry.question.subject}</span>
                      {entry.question.module && <span className="text-[10px] text-muted-foreground">{entry.question.module}</span>}
                    </div>
                    <p className="mb-3 text-xs leading-relaxed text-foreground">{entry.question.vignette}</p>
                    <div className="space-y-1.5">
                      {entry.question.options.map(opt => {
                        const isOpt = opt.id === entry.question.correctAnswer
                        const isSel = opt.id === entry.selected && !isOpt
                        let cls = "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs "
                        if (isOpt) cls += "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 font-semibold text-emerald-700 dark:text-emerald-400"
                        else if (isSel) cls += "border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400"
                        else cls += "border-border bg-muted/30 text-muted-foreground"
                        return (
                          <div key={opt.id} className={cls}>
                            <span className="font-bold w-4 shrink-0">{opt.id}.</span>
                            <span className="flex-1">{opt.text}</span>
                            {isOpt && <span className="text-emerald-500 text-xs">✓</span>}
                            {isSel && <span className="text-rose-500 text-xs">✗</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

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
            <div className="mb-5 grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)` }}>
              {stats.map(s => (
                <div key={s.label} className="rounded-2xl border border-border bg-card p-3 text-center">
                  <p className="text-xl font-extrabold text-foreground">{s.value}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}
          {payoutData && (
            <div className="mb-5">
              <PayoutResult earned={payoutData.earned} breakdown={payoutData.breakdown} bountyUpdates={payoutData.bountyUpdates} />
            </div>
          )}
          <button type="button" onClick={onReplay} className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99]">
            Play Again
          </button>
          {answerHistory && answerHistory.length > 0 && (
            <button type="button" onClick={() => setReviewOpen(true)}
              className="mt-3 w-full rounded-2xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              📖 Review Vignettes ({answerHistory.length})
            </button>
          )}
          <button type="button" onClick={onExit} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Choose Mode
          </button>
        </div>
      </div>
    </>
  )
}

// ── Filter picker (used inside ModeMenu) ──────────────────────────────────────
function FilterPicker({ allQ, filter, onChange }: {
  allQ: Question[]
  filter: GameFilter
  onChange: (f: GameFilter) => void
}) {
  const [activeTab, setActiveTab] = useState<FilterScope>(filter.scope === "all" ? "all" : filter.scope)

  const modules = useMemo(() =>
    [...new Set(allQ.map(q => q.module).filter(Boolean) as string[])].sort(),
    [allQ]
  )
  const subjects = useMemo(() =>
    [...new Set(allQ.map(q => q.subject).filter(Boolean) as string[])].sort(),
    [allQ]
  )

  const count = countForFilter(allQ, filter)
  const hasFilter = filter.scope !== "all" && filter.value !== null

  function selectTab(tab: FilterScope) {
    setActiveTab(tab)
    if (tab === "all") onChange(DEFAULT_FILTER)
  }

  function pick(scope: FilterScope, value: string) {
    if (filter.scope === scope && filter.value === value) {
      onChange(DEFAULT_FILTER)
      setActiveTab("all")
    } else {
      onChange({ scope, value })
    }
  }

  return (
    <div className="mb-5 rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Question Scope</p>
        {hasFilter && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {count} question{count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Scope tabs */}
      <div className="mb-3 flex gap-1 rounded-2xl bg-muted p-1">
        {(["all", "module", "subject"] as FilterScope[]).map(tab => (
          <button
            key={tab} type="button" onClick={() => selectTab(tab)}
            className={`flex-1 rounded-xl py-1.5 text-xs font-semibold capitalize transition-all ${activeTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "all" ? "All" : tab === "module" ? "Module" : "Discipline"}
          </button>
        ))}
      </div>

      {/* Module pills */}
      {activeTab === "module" && (
        modules.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-2">No modules found</p>
        ) : (
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
            {modules.map(m => (
              <button
                key={m} type="button" onClick={() => pick("module", m)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${filter.scope === "module" && filter.value === m ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
              >
                {m}
              </button>
            ))}
          </div>
        )
      )}

      {/* Subject/discipline pills */}
      {activeTab === "subject" && (
        subjects.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-2">No disciplines found</p>
        ) : (
          <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
            {subjects.map(s => (
              <button
                key={s} type="button" onClick={() => pick("subject", s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${filter.scope === "subject" && filter.value === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
              >
                {s}
              </button>
            ))}
          </div>
        )
      )}

      {/* Active filter summary when on "all" tab */}
      {activeTab === "all" && (
        <p className="text-center text-xs text-muted-foreground py-1">
          All {countForFilter(allQ, DEFAULT_FILTER)} available questions
        </p>
      )}

      {/* Active filter badge below pills */}
      {hasFilter && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-primary/8 px-3 py-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={12} height={12} className="text-primary shrink-0">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-primary">{filter.value}</span>
          <button type="button" onClick={() => { onChange(DEFAULT_FILTER); setActiveTab("all") }} className="text-[11px] text-muted-foreground hover:text-foreground shrink-0">✕ Clear</button>
        </div>
      )}
    </div>
  )
}

// ── Shared per-mode menu (start screen) ──────────────────────────────────────
function ModeMenu({ mode, hs, allQ, filter, onFilterChange, onStart, onBack }: {
  mode: ModeConfig; hs: number
  allQ: Question[]; filter: GameFilter; onFilterChange: (f: GameFilter) => void
  onStart: () => void; onBack: () => void
}) {
  const count = countForFilter(allQ, filter)
  const tooFew = filter.scope !== "all" && filter.value && count < 3

  return (
    <div className="flex min-h-full flex-col p-4 sm:p-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${mode.gradient} shadow-xl ${mode.shadow} text-4xl`}>
            {mode.icon}
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{mode.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${mode.badgeColor}`}>{mode.badge}</span>
          </div>
          <p className="text-sm text-muted-foreground">{mode.desc}</p>
          {hs > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-4 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
              🏆 {mode.hsLabel}: {hs.toLocaleString()}
            </div>
          )}
        </div>

        {/* Filter picker */}
        <FilterPicker allQ={allQ} filter={filter} onChange={onFilterChange} />

        {/* Rules */}
        <div className="mb-5 rounded-3xl border border-border bg-card p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rules</p>
          <div className="grid gap-2">
            {mode.rules.map(r => (
              <div key={r} className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${mode.gradient} text-[9px] font-bold text-white`}>✓</span>
                <span className="text-sm text-foreground">{r}</span>
              </div>
            ))}
          </div>
        </div>

        {tooFew && (
          <div className="mb-3 rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400">
            ⚠️ Only {count} question{count !== 1 ? "s" : ""} in this filter — will fall back to all questions.
          </div>
        )}

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

// ── Lifeline Bar ─────────────────────────────────────────────────────────────
function LifelineBar({ onUse50_50, onUseFreeze, qty5050, qtyFreeze, disabled5050, disabledFreeze }: {
  onUse50_50: () => void; onUseFreeze: () => void
  qty5050: number; qtyFreeze: number
  disabled5050: boolean; disabledFreeze: boolean
}) {
  if (qty5050 <= 0 && qtyFreeze <= 0) return null
  return (
    <div className="flex items-center justify-center gap-2 py-0.5">
      {qty5050 > 0 && (
        <button type="button" onClick={onUse50_50} disabled={disabled5050}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${disabled5050 ? "opacity-40 cursor-not-allowed border-border bg-muted text-muted-foreground" : "border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 hover:opacity-80 active:scale-95"}`}>
          🩺 Consult Attending
          <span className="rounded-full bg-violet-200 dark:bg-violet-800 px-1.5 py-0.5 text-[10px] font-extrabold text-violet-800 dark:text-violet-200">×{qty5050}</span>
        </button>
      )}
      {qtyFreeze > 0 && (
        <button type="button" onClick={onUseFreeze} disabled={disabledFreeze}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${disabledFreeze ? "opacity-40 cursor-not-allowed border-border bg-muted text-muted-foreground" : "border-cyan-200 dark:border-cyan-800/40 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400 hover:opacity-80 active:scale-95"}`}>
          🧊 Stat Labs +10s
          <span className="rounded-full bg-cyan-200 dark:bg-cyan-800 px-1.5 py-0.5 text-[10px] font-extrabold text-cyan-800 dark:text-cyan-200">×{qtyFreeze}</span>
        </button>
      )}
    </div>
  )
}

// ── Hero Split Screen ─────────────────────────────────────────────────────────
function HeroSplitScreen({ onSolo, onMulti, onBack }: {
  onSolo: () => void; onMulti: () => void; onBack: () => void
}) {
  const [storeOpen, setStoreOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [joinError, setJoinError] = useState("")
  const [joining, setJoining] = useState(false)

  async function quickJoin() {
    const p = pin.trim().replace(/\D/g, "")
    if (p.length !== 6) { setJoinError("Enter a 6-digit PIN"); return }
    setJoining(true); setJoinError("")
    try {
      const res = await fetch(`/api/game-rooms/${p}`)
      if (!res.ok) { setJoinError("Room not found"); setJoining(false); return }
      const data = await res.json()
      if (data.phase !== "lobby") { setJoinError("Game already started"); setJoining(false); return }
      window.dispatchEvent(new CustomEvent("mednexus-quickjoin", { detail: { pin: p } }))
    } catch { setJoinError("Network error"); setJoining(false) }
  }

  return (
    <div className="flex min-h-full flex-col p-4 sm:p-6">
      {storeOpen && <StoreModal onClose={() => setStoreOpen(false)} />}
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Game Mode</h1>
            <p className="text-xs text-muted-foreground">Choose your challenge</p>
          </div>
          <div className="flex items-center gap-2">
            <WalletBadge onOpenStore={() => setStoreOpen(true)} />
            <button type="button" onClick={() => setStoreOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40">
              🏪 Store
            </button>
          </div>
        </div>

        <div className="mb-5">
          <DailyBountiesPanel />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Solo Training Card */}
          <button type="button" onClick={onSolo}
            className="group relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-950/20 dark:to-fuchsia-950/20 p-6 text-left transition-all hover:border-violet-400/50 hover:shadow-xl hover:shadow-violet-500/10 hover:scale-[1.02] active:scale-[0.98]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-3xl shadow-lg shadow-violet-500/20">👤</div>
            <h2 className="text-lg font-extrabold text-foreground">Solo Training</h2>
            <p className="mt-1 text-xs text-muted-foreground">5 game modes — Rapid Fire, Sudden Death, Time Attack, Double Jeopardy, Streak Master</p>
            <div className="mt-4 flex items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-600 py-2.5 text-sm font-bold text-white shadow-sm">
              Start Solo
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><path d="m9 18 6-6-6-6"/></svg>
            </div>
          </button>

          {/* Multiplayer Card */}
          <div className="relative overflow-hidden rounded-3xl border-2 border-border bg-gradient-to-br from-fuchsia-50 to-cyan-50 dark:from-fuchsia-950/20 dark:to-cyan-950/20 p-6">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-3xl shadow-lg shadow-fuchsia-500/20">👥</div>
            <h2 className="text-lg font-extrabold text-foreground">Multiplayer</h2>
            <p className="mt-1 text-xs text-muted-foreground">Clash · Cohort Review · Wager Wars — play with others in real time</p>
            <button type="button" onClick={onMulti}
              className="mt-4 w-full flex items-center justify-center gap-1 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]">
              Browse Modes
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <div className="mt-3 flex gap-2">
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setJoinError("") }}
                onKeyDown={e => e.key === "Enter" && quickJoin()}
                placeholder="Quick Join — PIN"
                className="h-9 flex-1 rounded-xl border border-border bg-background px-3 text-sm font-mono text-center tracking-widest text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50"
              />
              <button type="button" onClick={quickJoin} disabled={joining}
                className="h-9 rounded-xl bg-foreground px-3 text-xs font-bold text-background transition-opacity hover:opacity-80 disabled:opacity-50">
                {joining ? "…" : "Join"}
              </button>
            </div>
            {joinError && <p className="mt-1.5 text-center text-[11px] text-rose-500">{joinError}</p>}
          </div>
        </div>

        <button type="button" onClick={onBack} className="mt-6 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}

// ── Mode Select Screen ────────────────────────────────────────────────────────
function ModeCard({ name, badge, badgeColor, icon, gradient, shadow, desc, rules, hsLabel, hsKey, onSelect }: {
  name: string; badge: string; badgeColor: string; icon: string; gradient: string; shadow: string
  desc: string; rules: string[]; hsLabel?: string; hsKey?: string; onSelect: () => void
}) {
  const hs = hsKey ? readHs(hsKey) : 0
  return (
    <button
      type="button" onClick={onSelect}
      className="group relative overflow-hidden rounded-3xl border border-border bg-card p-5 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/8 hover:scale-[1.01] active:scale-[0.99]"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-md ${shadow} text-2xl`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="font-bold text-foreground">{name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor}`}>{badge}</span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="mt-3.5 space-y-1.5">
        {rules.map(rule => (
          <div key={rule} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
            {rule}
          </div>
        ))}
      </div>
      {hs > 0 && hsLabel && (
        <div className="mt-3.5 flex items-center gap-1.5 rounded-xl bg-muted/70 px-3 py-2">
          <span className="text-xs">🏆</span>
          <span className="text-xs text-muted-foreground">{hsLabel}:</span>
          <span className="text-xs font-bold text-foreground">{hs.toLocaleString()}</span>
        </div>
      )}
      <div className={`mt-4 flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r ${gradient} py-2.5 text-sm font-bold text-white shadow-sm transition-opacity group-hover:opacity-90`}>
        Play
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </button>
  )
}

function ModeSelectScreen({ onSelect, onBack }: {
  onSelect: (id: GameModeId) => void; onBack: () => void
}) {
  const [storeOpen, setStoreOpen] = useState(false)

  return (
    <div className="flex min-h-full flex-col p-4 sm:p-6 lg:p-8">
      {storeOpen && <StoreModal onClose={() => setStoreOpen(false)} />}
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-7">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 shadow-lg shadow-violet-500/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={28} height={28}>
                  <line x1="6" x2="10" y1="12" y2="12" /><line x1="8" x2="8" y1="10" y2="14" />
                  <line x1="15" x2="17" y1="11" y2="11" /><line x1="15" x2="17" y1="13" y2="13" />
                  <rect width="20" height="12" x="2" y="6" rx="2" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">Game Mode</h1>
                <p className="text-xs text-muted-foreground">Pick a game type and start playing</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WalletBadge onOpenStore={() => setStoreOpen(true)} />
              <button
                type="button" onClick={() => setStoreOpen(true)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:text-foreground hover:border-primary/40"
              >
                🏪 Store
              </button>
            </div>
          </div>
        </div>

        {/* Daily Bounties */}
        <div className="mb-6">
          <DailyBountiesPanel />
        </div>

        {/* Solo modes */}
        <div className="mb-3">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Solo Modes</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {MODES.map(m => (
              <ModeCard key={m.id} {...m} onSelect={() => onSelect(m.id)} />
            ))}
          </div>
        </div>

        {/* Multiplayer modes */}
        <div className="mt-6 mb-3">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Multiplayer Modes</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {MULTI_MODES.map(m => (
              <ModeCard key={m.id} {...m} onSelect={() => onSelect(m.id)} />
            ))}
          </div>
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
  const { inventory, useItem } = useEconomy()
  const cfg = MODES[0]

  const [filter, setFilter] = useState<GameFilter>(DEFAULT_FILTER)
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
  const [eliminated, setEliminated] = useState<string[]>([])
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>([])

  const r = useRef({ pool: [] as Question[], qi: 0, lives: MAX_LIVES, score: 0, streak: 0, bestStreak: 0, totalQ: 0, totalRight: 0, hs: 0, fb: null as Feedback, phase: "menu" as Phase })
  r.current = { pool, qi, lives, score, streak, bestStreak, totalQ, totalRight, hs, fb, phase }
  const doRef = useRef<((c: string | null) => void) | null>(null)
  const expiryRef = useRef(0)

  function advance(nl: number, ns: number) {
    if (nl <= 0) {
      const best = Math.max(r.current.hs, ns)
      setIsNewHigh(ns > 0 && ns >= r.current.hs)
      setHsState(best); writeHs(cfg.hsKey, best)
      setPhase("over"); r.current.phase = "over"; return
    }
    setFb(null); r.current.fb = null; setPicked(null); setEliminated([])
    expiryRef.current = Date.now() + RAPID_TIME * 1000
    setTimeLeft(RAPID_TIME)
    setQi(prev => prev + 1 >= r.current.pool.length ? 0 : prev + 1)
  }

  function doAnswer(c: string | null) {
    if (r.current.fb !== null || r.current.phase !== "playing") return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c !== null && c === q.correctAnswer
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    setAnswerHistory(prev => [...prev, { question: q, selected: c }])
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
    expiryRef.current = Date.now() + RAPID_TIME * 1000
    const id = setInterval(() => {
      const rem = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000))
      setTimeLeft(rem)
      if (rem <= 0) { clearInterval(id); doRef.current?.(null) }
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fb, qi])

  async function use50_50() {
    const q = pool[qi]; if (!q || fb !== null) return
    const ok = await useItem("lifeline_50_50")
    if (!ok) return
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }

  async function useFreeze() {
    if (fb !== null) return
    const ok = await useItem("lifeline_freeze")
    if (!ok) return
    expiryRef.current += 10000
  }

  function start() {
    const p = makeFilteredSrc(allQ, filter)
    setPool(p); r.current.pool = p; setQi(0); r.current.qi = 0
    setLives(MAX_LIVES); r.current.lives = MAX_LIVES
    setScore(0); r.current.score = 0; setStreak(0); r.current.streak = 0
    setBestStreak(0); r.current.bestStreak = 0; setTimeLeft(RAPID_TIME)
    setFb(null); r.current.fb = null; setPicked(null)
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setIsNewHigh(false); setEliminated([]); setAnswerHistory([])
    setPhase("playing"); r.current.phase = "playing"
    expiryRef.current = Date.now() + RAPID_TIME * 1000
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} allQ={allQ} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    return <GameOver emoji={acc >= 80 ? "🏆" : acc >= 60 ? "🎯" : "💪"} headline="Game Over!" scoreLabel="Final Score" score={score} stats={[{ label: "Answered", value: String(totalQ) }, { label: "Accuracy", value: `${acc}%` }, { label: "Best Streak", value: `${bestStreak}×` }]} isNewHigh={isNewHigh} gameResult={{ mode: "rapid", score, correct: totalRight, total: totalQ, bestStreak, isNewHigh }} answerHistory={answerHistory} onReplay={start} onExit={onExit} />
  }
  const q = pool[qi]; if (!q) return null
  const pct = (timeLeft / RAPID_TIME) * 100
  const tc = timeLeft <= 5 ? "bg-rose-500" : timeLeft <= 9 ? "bg-amber-500" : "bg-emerald-500"
  const msg = streakMsg(streak); const bonus = rapidBonus(streak + 1)
  const qty5050 = inventory["lifeline_50_50"] ?? 0
  const qtyFreeze = inventory["lifeline_freeze"] ?? 0

  return (
    <QuestionView question={q} fb={fb} picked={picked} onAnswer={doAnswer} eliminated={new Set(eliminated)}
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
            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ease-linear ${tc}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className={`text-xs font-bold tabular-nums ${timeLeft <= 5 ? "text-rose-500" : "text-muted-foreground"}`}>{timeLeft}s</span>
            {msg ? <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{msg}</span> : bonus > 0 && fb === null ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{BASE_PTS + bonus} if correct</span> : null}
          </div>
          <LifelineBar qty5050={qty5050} qtyFreeze={qtyFreeze} onUse50_50={use50_50} onUseFreeze={useFreeze}
            disabled5050={fb !== null || eliminated.length > 0} disabledFreeze={fb !== null} />
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
  const { inventory, useItem } = useEconomy()
  const cfg = MODES[1]

  const [filter, setFilter] = useState<GameFilter>(DEFAULT_FILTER)
  const [phase, setPhase] = useState<Phase>("menu")
  const [pool, setPool] = useState<Question[]>([])
  const [qi, setQi] = useState(0)
  const [survived, setSurvived] = useState(0)
  const [timeLeft, setTimeLeft] = useState(SUDDEN_TIME)
  const [fb, setFb] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))
  const [eliminated, setEliminated] = useState<string[]>([])
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>([])

  const r = useRef({ pool: [] as Question[], qi: 0, survived: 0, hs: 0, fb: null as Feedback, phase: "menu" as Phase })
  r.current = { pool, qi, survived, hs, fb, phase }
  const doRef = useRef<((c: string | null) => void) | null>(null)
  const expiryRef = useRef(0)

  function endGame(finalSurvived: number) {
    const best = Math.max(r.current.hs, finalSurvived)
    setIsNewHigh(finalSurvived > 0 && finalSurvived >= r.current.hs)
    setHsState(best); writeHs(cfg.hsKey, best)
    setSurvived(finalSurvived); setPhase("over"); r.current.phase = "over"
  }

  function doAnswer(c: string | null) {
    if (r.current.fb !== null || r.current.phase !== "playing") return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c !== null && c === q.correctAnswer
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    setAnswerHistory(prev => [...prev, { question: q, selected: c }])
    if (right) {
      const ns = r.current.survived + 1; setSurvived(ns); r.current.survived = ns
      setTimeout(() => {
        setFb(null); r.current.fb = null; setPicked(null); setEliminated([])
        expiryRef.current = Date.now() + SUDDEN_TIME * 1000
        setTimeLeft(SUDDEN_TIME)
        setQi(prev => prev + 1 >= r.current.pool.length ? 0 : prev + 1)
      }, 900)
    } else {
      setTimeout(() => endGame(r.current.survived), 900)
    }
  }
  doRef.current = doAnswer

  useEffect(() => {
    if (phase !== "playing" || fb !== null) return
    expiryRef.current = Date.now() + SUDDEN_TIME * 1000
    const id = setInterval(() => {
      const rem = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000))
      setTimeLeft(rem)
      if (rem <= 0) { clearInterval(id); doRef.current?.(null) }
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fb, qi])

  async function use50_50() {
    const q = pool[qi]; if (!q || fb !== null) return
    const ok = await useItem("lifeline_50_50")
    if (!ok) return
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }

  async function useFreeze() {
    if (fb !== null) return
    const ok = await useItem("lifeline_freeze")
    if (!ok) return
    expiryRef.current += 10000
  }

  function start() {
    const p = makeFilteredSrc(allQ, filter)
    setPool(p); r.current.pool = p; setQi(0); r.current.qi = 0
    setSurvived(0); r.current.survived = 0; setTimeLeft(SUDDEN_TIME)
    setFb(null); r.current.fb = null; setPicked(null)
    setIsNewHigh(false); setEliminated([]); setAnswerHistory([])
    setPhase("playing"); r.current.phase = "playing"
    expiryRef.current = Date.now() + SUDDEN_TIME * 1000
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} allQ={allQ} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const score = survived * BASE_PTS
    return <GameOver emoji={survived >= 20 ? "💀🏆" : survived >= 10 ? "😤" : "💀"} headline={survived === 0 ? "Out on Question 1!" : `${survived} Questions Survived`} scoreLabel="Score" score={score} stats={[{ label: "Survived", value: String(survived) }, { label: "Best", value: `${hs} questions` }]} isNewHigh={isNewHigh} gameResult={{ mode: "sudden", score, correct: survived, total: Math.max(survived + 1, 1), bestStreak: survived, isNewHigh, survivedCount: survived }} answerHistory={answerHistory} onReplay={start} onExit={onExit} />
  }
  const q = pool[qi]; if (!q) return null
  const pct = (timeLeft / SUDDEN_TIME) * 100
  const tc = timeLeft <= 5 ? "bg-rose-500" : timeLeft <= 10 ? "bg-amber-500" : "bg-rose-400"
  const qty5050 = inventory["lifeline_50_50"] ?? 0
  const qtyFreeze = inventory["lifeline_freeze"] ?? 0

  return (
    <QuestionView question={q} fb={fb} picked={picked} onAnswer={doAnswer} eliminated={new Set(eliminated)}
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
            <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ease-linear ${tc}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className={`text-xs font-bold tabular-nums ${timeLeft <= 5 ? "text-rose-600" : "text-muted-foreground"}`}>{timeLeft}s</span>
            <span className="text-[11px] font-semibold text-rose-500/70">One wrong = game over</span>
          </div>
          <LifelineBar qty5050={qty5050} qtyFreeze={qtyFreeze} onUse50_50={use50_50} onUseFreeze={useFreeze}
            disabled5050={fb !== null || eliminated.length > 0} disabledFreeze={fb !== null} />
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
  const { inventory, useItem } = useEconomy()
  const cfg = MODES[2]

  const [filter, setFilter] = useState<GameFilter>(DEFAULT_FILTER)
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
  const [eliminated, setEliminated] = useState<string[]>([])
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>([])

  const r = useRef({ pool: [] as Question[], qi: 0, score: 0, timeLeft: TIMEATK_START, hs: 0, fb: null as Feedback, phase: "menu" as Phase, totalQ: 0, totalRight: 0 })
  r.current = { pool, qi, score, timeLeft, hs, fb, phase, totalQ, totalRight }
  const expiryRef = useRef(0)

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
    setAnswerHistory(prev => [...prev, { question: q, selected: c }])
    const ns = right ? r.current.score + BASE_PTS : r.current.score
    const ntq = r.current.totalQ + 1; const ntr = right ? r.current.totalRight + 1 : r.current.totalRight
    if (right) expiryRef.current += 3000; else expiryRef.current -= 5000
    const nt = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000))
    setScore(ns); setTimeLeft(nt); setTotalQ(ntq); setTotalRight(ntr)
    r.current.score = ns; r.current.timeLeft = nt; r.current.totalQ = ntq; r.current.totalRight = ntr
    if (nt <= 0) { setTimeout(() => endGame(ns), 700); return }
    setTimeout(() => { setFb(null); r.current.fb = null; setPicked(null); setEliminated([]); setQi(prev => prev + 1 >= r.current.pool.length ? 0 : prev + 1) }, 700)
  }

  useEffect(() => {
    if (phase !== "playing") return
    expiryRef.current = Date.now() + TIMEATK_START * 1000
    const id = setInterval(() => {
      const rem = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000))
      setTimeLeft(rem)
      r.current.timeLeft = rem
      if (rem <= 0) { clearInterval(id); endGame(r.current.score) }
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  async function use50_50() {
    const q = pool[qi]; if (!q || fb !== null) return
    const ok = await useItem("lifeline_50_50")
    if (!ok) return
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }

  async function useFreeze() {
    if (fb !== null) return
    const ok = await useItem("lifeline_freeze")
    if (!ok) return
    expiryRef.current += 10000
  }

  function start() {
    const p = makeFilteredSrc(allQ, filter)
    setPool(p); r.current.pool = p; setQi(0); r.current.qi = 0
    setScore(0); r.current.score = 0; setTimeLeft(TIMEATK_START); r.current.timeLeft = TIMEATK_START
    setFb(null); r.current.fb = null; setPicked(null)
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setIsNewHigh(false); setEliminated([]); setAnswerHistory([])
    setPhase("playing"); r.current.phase = "playing"
    expiryRef.current = Date.now() + TIMEATK_START * 1000
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} allQ={allQ} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    return <GameOver emoji={acc >= 80 ? "⚡🏆" : acc >= 60 ? "⏱️" : "💨"} headline="Time's Up!" scoreLabel="Final Score" score={score} stats={[{ label: "Answered", value: String(totalQ) }, { label: "Correct", value: String(totalRight) }, { label: "Accuracy", value: `${acc}%` }]} isNewHigh={isNewHigh} gameResult={{ mode: "timeatk", score, correct: totalRight, total: totalQ, bestStreak: 0, isNewHigh }} answerHistory={answerHistory} onReplay={start} onExit={onExit} />
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

// ── DOUBLE JEOPARDY ───────────────────────────────────────────────────────────
const DJ_STARTING_BANK = 500
const DJ_BETS = [
  { label: "Safe", pct: 0.1, icon: "🛡️", color: "from-emerald-500 to-teal-500", shadow: "shadow-emerald-500/20" },
  { label: "Moderate", pct: 0.25, icon: "🎯", color: "from-blue-500 to-indigo-500", shadow: "shadow-blue-500/20" },
  { label: "Bold", pct: 0.5, icon: "🔥", color: "from-amber-500 to-orange-500", shadow: "shadow-amber-500/20" },
  { label: "All In", pct: 1.0, icon: "💎", color: "from-rose-500 to-fuchsia-600", shadow: "shadow-rose-500/20" },
]

type DJPhase = "menu" | "wager" | "answering" | "feedback" | "over"

function DoubleJeopardyMode({ onExit }: { onExit: () => void }) {
  const { questions: allQ } = useQuestions()
  const { inventory, useItem } = useEconomy()
  const cfg = MODES.find(m => m.id === "double")!

  const [filter, setFilter] = useState<GameFilter>(DEFAULT_FILTER)
  const [djPhase, setDjPhase] = useState<DJPhase>("menu")
  const [pool, setPool] = useState<Question[]>([])
  const [qi, setQi] = useState(0)
  const [bank, setBank] = useState(DJ_STARTING_BANK)
  const [wager, setWager] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [fb, setFb] = useState<Feedback>(null)
  const [totalQ, setTotalQ] = useState(0)
  const [totalRight, setTotalRight] = useState(0)
  const [bestWager, setBestWager] = useState(0)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))
  const [eliminated, setEliminated] = useState<string[]>([])
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>([])

  const r = useRef({ pool: [] as Question[], qi: 0, bank: DJ_STARTING_BANK, wager: 0, hs: 0, totalQ: 0, totalRight: 0, bestWager: 0 })
  r.current = { pool, qi, bank, wager, hs, totalQ, totalRight, bestWager }

  const qty5050dj = inventory["lifeline_50_50"] ?? 0

  function start() {
    const p = makeFilteredSrc(allQ, filter)
    setPool(p); r.current.pool = p; setQi(0); r.current.qi = 0
    setBank(DJ_STARTING_BANK); r.current.bank = DJ_STARTING_BANK
    setWager(0); r.current.wager = 0
    setPicked(null); setFb(null); setEliminated([]); setAnswerHistory([])
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setBestWager(0); r.current.bestWager = 0
    setIsNewHigh(false); setDjPhase("wager")
  }

  function placeBet(pct: number) {
    const w = Math.max(10, Math.floor(r.current.bank * pct))
    setWager(w); r.current.wager = w
    setDjPhase("answering"); setPicked(null); setFb(null); setEliminated([])
  }

  function doAnswer(c: string) {
    if (fb !== null || djPhase !== "answering") return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c === q.correctAnswer
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); setPicked(c)
    setAnswerHistory(prev => [...prev, { question: q, selected: c }])
    const nb = right ? r.current.bank + r.current.wager : Math.max(0, r.current.bank - r.current.wager)
    const ntq = r.current.totalQ + 1; const ntr = right ? r.current.totalRight + 1 : r.current.totalRight
    const nbw = Math.max(r.current.bestWager, r.current.wager)
    setBank(nb); r.current.bank = nb
    setTotalQ(ntq); r.current.totalQ = ntq; setTotalRight(ntr); r.current.totalRight = ntr
    setBestWager(nbw); r.current.bestWager = nbw
    setDjPhase("feedback")
    setTimeout(() => {
      const nextQi = r.current.qi + 1
      if (nextQi >= r.current.pool.length || r.current.bank <= 0) {
        const best = Math.max(r.current.hs, r.current.bank)
        setIsNewHigh(r.current.bank > 0 && r.current.bank >= r.current.hs)
        setHsState(best); writeHs(cfg.hsKey, best)
        setDjPhase("over")
      } else {
        setQi(nextQi); r.current.qi = nextQi
        setFb(null); setPicked(null); setDjPhase("wager")
      }
    }, 1400)
  }

  async function use50_50dj() {
    const q = pool[qi]; if (!q || djPhase !== "answering") return
    const ok = await useItem("lifeline_50_50")
    if (!ok) return
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }

  if (djPhase === "menu") {
    return <ModeMenu mode={cfg} hs={hs} allQ={allQ} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  }

  if (djPhase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    return (
      <GameOver
        emoji={bank >= DJ_STARTING_BANK * 3 ? "💎🏆" : bank >= DJ_STARTING_BANK ? "🎲" : "💸"}
        headline="Confidence cashed out!"
        scoreLabel="Final Bank"
        score={bank}
        stats={[
          { label: "Questions", value: String(totalQ) },
          { label: "Accuracy", value: `${acc}%` },
          { label: "Biggest Wager", value: bestWager.toLocaleString() },
        ]}
        isNewHigh={isNewHigh}
        gameResult={{ mode: "double", score: bank, correct: totalRight, total: totalQ, bestStreak: 0, isNewHigh }}
        answerHistory={answerHistory}
        onReplay={start}
        onExit={onExit}
      />
    )
  }

  const q = pool[qi]
  if (!q) return null

  // WAGER phase — show vignette, hide options
  if (djPhase === "wager") {
    return (
      <div className="flex min-h-full flex-col gap-3 p-3 sm:gap-4 sm:p-5 max-w-2xl mx-auto">
        {/* HUD */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5">
          <span className="text-sm font-bold text-muted-foreground">Q {qi + 1}/{pool.length}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1">
            <span className="text-xs">🏦</span>
            <span className="text-sm font-extrabold tabular-nums text-indigo-700 dark:text-indigo-400">{bank.toLocaleString()}</span>
          </div>
        </div>

        {/* Vignette */}
        <div className="flex-1 overflow-y-auto rounded-3xl border border-border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{q.subject}</span>
            {q.module && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{q.module}</span>}
          </div>
          <p className="text-sm leading-relaxed text-foreground sm:text-base">{q.vignette}</p>
        </div>

        {/* Bet panel */}
        <div className="rounded-3xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/30 p-4">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
            🎲 Place Your Wager — Options reveal after!
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {DJ_BETS.map(bet => {
              const amount = Math.max(10, Math.floor(bank * bet.pct))
              return (
                <button key={bet.label} type="button" onClick={() => placeBet(bet.pct)}
                  className={`flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-br ${bet.color} px-4 py-3.5 text-white shadow-md ${bet.shadow} transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]`}>
                  <span className="text-xl">{bet.icon}</span>
                  <span className="text-sm font-extrabold">{bet.label}</span>
                  <span className="text-xs font-semibold opacity-90">+/− {amount.toLocaleString()} pts</span>
                </button>
              )
            })}
          </div>
        </div>

        <button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Quit Game</button>
      </div>
    )
  }

  // ANSWERING / FEEDBACK phase — show options
  return (
    <QuestionView question={q} fb={fb} picked={picked} onAnswer={doAnswer} eliminated={new Set(eliminated)}
      hud={
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5">
            <span className="text-sm font-bold text-muted-foreground">Q {qi + 1}/{pool.length}</span>
            <div className="flex-1" />
            {wager > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1">
                <span className="text-xs">🎲</span>
                <span className="text-sm font-extrabold tabular-nums text-amber-700 dark:text-amber-400">
                  {djPhase === "feedback" && fb === "correct" ? `+${wager.toLocaleString()}` : djPhase === "feedback" && fb === "wrong" ? `-${wager.toLocaleString()}` : `Wagered: ${wager.toLocaleString()}`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1">
              <span className="text-xs">🏦</span>
              <span className={`text-sm font-extrabold tabular-nums ${djPhase === "feedback" && fb === "correct" ? "text-emerald-600 dark:text-emerald-400" : djPhase === "feedback" && fb === "wrong" ? "text-rose-600 dark:text-rose-400" : "text-indigo-700 dark:text-indigo-400"}`}>
                {bank.toLocaleString()}
              </span>
            </div>
          </div>
          <LifelineBar qty5050={qty5050dj} qtyFreeze={0} onUse50_50={use50_50dj} onUseFreeze={() => {}}
            disabled5050={fb !== null || eliminated.length > 0} disabledFreeze={true} />
        </div>
      }
      footer={<button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Quit Game</button>}
    />
  )
}

// ── STREAK MASTER ─────────────────────────────────────────────────────────────
function StreakMasterMode({ onExit }: { onExit: () => void }) {
  const { questions: allQ } = useQuestions()
  const { inventory, useItem } = useEconomy()
  const cfg = MODES[3]

  const [filter, setFilter] = useState<GameFilter>(DEFAULT_FILTER)
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
  const [eliminated, setEliminated] = useState<string[]>([])
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>([])

  const r = useRef({ pool: [] as Question[], qi: 0, streak: 0, bestStreak: 0, totalQ: 0, totalRight: 0, hs: 0, fb: null as Feedback })
  r.current = { pool, qi, streak, bestStreak, totalQ, totalRight, hs, fb }

  const qty5050sm = inventory["lifeline_50_50"] ?? 0

  function doAnswer(c: string) {
    if (r.current.fb !== null) return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c === q.correctAnswer
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    setAnswerHistory(prev => [...prev, { question: q, selected: c }])
    const ns = right ? r.current.streak + 1 : 0
    const nb = Math.max(r.current.bestStreak, ns)
    const ntq = r.current.totalQ + 1; const ntr = right ? r.current.totalRight + 1 : r.current.totalRight
    setStreak(ns); setBestStreak(nb); setTotalQ(ntq); setTotalRight(ntr)
    r.current.streak = ns; r.current.bestStreak = nb; r.current.totalQ = ntq; r.current.totalRight = ntr
    setTimeout(() => { setFb(null); r.current.fb = null; setPicked(null); setEliminated([]); setQi(prev => prev + 1 >= r.current.pool.length ? 0 : prev + 1) }, 900)
  }

  async function use50_50sm() {
    const q = pool[qi]; if (!q || fb !== null) return
    const ok = await useItem("lifeline_50_50")
    if (!ok) return
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }

  function finishGame() {
    const best = Math.max(r.current.hs, r.current.bestStreak)
    setIsNewHigh(r.current.bestStreak > 0 && r.current.bestStreak >= r.current.hs)
    setHsState(best); writeHs(cfg.hsKey, best); setPhase("over")
  }

  function start() {
    const p = makeFilteredSrc(allQ, filter)
    setPool(p); r.current.pool = p; setQi(0); r.current.qi = 0
    setStreak(0); r.current.streak = 0; setBestStreak(0); r.current.bestStreak = 0
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setFb(null); r.current.fb = null; setPicked(null)
    setIsNewHigh(false); setEliminated([]); setAnswerHistory([])
    setPhase("playing")
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} allQ={allQ} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    const finalScore = bestStreak * 50 + totalRight * 10
    return <GameOver emoji={bestStreak >= 15 ? "🔥🏆" : bestStreak >= 8 ? "🔥" : "💪"} headline="Great run!" scoreLabel="Score" score={finalScore} stats={[{ label: "Best Streak", value: `${bestStreak}×` }, { label: "Answered", value: String(totalQ) }, { label: "Accuracy", value: `${acc}%` }]} isNewHigh={isNewHigh} gameResult={{ mode: "streak", score: finalScore, correct: totalRight, total: totalQ, bestStreak, isNewHigh }} answerHistory={answerHistory} onReplay={start} onExit={onExit} />
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
  if (activeMode === "double") return <DoubleJeopardyMode onExit={() => setActiveMode(null)} />
  if (activeMode === "clash") return <MultiplayerClash onExit={() => setActiveMode(null)} />
  if (activeMode === "cohort") return <CohortReview onExit={() => setActiveMode(null)} />

  return <ModeSelectScreen onSelect={setActiveMode} onBack={onExit} />
}
