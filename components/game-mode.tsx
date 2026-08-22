"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { ClipboardList, ShoppingBag } from "lucide-react"
import { useQuestions, type QuestionCatalogModule } from "@/contexts/questions-context"
import type { Question } from "@/lib/types"
import { RichText } from "@/components/rich-text"
import { useErrorFeedback } from "@/hooks/use-error-feedback"
import { MultiplayerClash, CohortReview, WagerWars, DoubleJeopardyMulti } from "@/components/game-mode-multiplayer"
import { loadActiveRoomSession } from "@/lib/multiplayer-session"
import { useEconomy } from "@/contexts/economy-context"
import { useApp } from "@/contexts/app-context"
import { WalletBadge, DailyBountiesPanel, PayoutResult } from "@/components/economy-panel"
import { buildGameQuestionPool, createQuestionContentFingerprint, deduplicateGameQuestions } from "@/lib/game-question-pool"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { getPersonalBestUpdate } from "@/lib/game-personal-best"
import { getSuddenDeathResultTotal } from "@/lib/sudden-death-result"
import { getMultiplayerRewardRules } from "@/lib/multiplayer-reward-presentation"
import { clearSoloGameSession, loadSoloGameSession, saveSoloGameSession, type HydratedSoloGameSession, type SoloGameMode } from "@/lib/solo-game-session"

// ── Types ─────────────────────────────────────────────────────────────────────
type GameModeId = "rapid" | "sudden" | "timeatk" | "streak" | "double" | "clash" | "cohort" | "wager" | "djmulti"
type AppView = "hero" | "solo" | "multi" | "quickjoin" | GameModeId
type Phase = "menu" | "playing" | "over"
type Feedback = "correct" | "wrong" | null
interface AnswerHistoryEntry { question: Question; selected: string | null; secondAttempt?: string | null; assisted?: boolean; wager?: number }
type SoloCompletionReason = "lives_exhausted" | "incorrect_answer" | "timeout" | "pool_completed" | "bank_depleted" | "player_finished"

interface GameFilter {
  module: string | null
  discipline: string | null
}

interface SoloRoundConfiguration {
  readonly mode: ModeConfig["id"]
  readonly module: string | null
  readonly discipline: string | null
  readonly selectedQuantity: number
  readonly eligiblePoolSize: number
  readonly selectedQuestionIds: readonly string[]
  readonly startedAt: string
}

interface ModeConfig {
  id: GameModeId
  name: string
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
    id: "rapid", name: "Rapid Fire",
    icon: "⚡", gradient: "from-violet-500 to-fuchsia-600", shadow: "shadow-violet-500/20",
    desc: "Race the clock — 3 lives, 15s per question, streak multipliers.",
    rules: ["3 lives — wrong or timeout costs 1", "15 seconds per question", "Selected questions appear once per round", "Streak bonuses up to +150 pts"],
    hsKey: "mednexus-hs-rapid", hsLabel: "Best Score",
  },
  {
    id: "sudden", name: "Sudden Death",
    icon: "💀", gradient: "from-rose-500 to-orange-500", shadow: "shadow-rose-500/20",
    desc: "One mistake ends everything. How many can you survive?",
    rules: ["Any wrong answer = instant game over", "20 seconds per question", "Selected questions appear once per round", "Score = questions survived × 100"],
    hsKey: "mednexus-hs-sudden", hsLabel: "Best Survived",
  },
  {
    id: "timeatk", name: "Time Attack",
    icon: "⏱️", gradient: "from-cyan-500 to-blue-600", shadow: "shadow-cyan-500/20",
    desc: "90 seconds on the clock. Right answers add time, wrong ones drain it.",
    rules: ["90-second total bank", "Correct: +100 pts +3 seconds", "Wrong: −5 seconds (no lives)", "Selected questions appear once per round"],
    hsKey: "mednexus-hs-timeatk", hsLabel: "Best Score",
  },
  {
    id: "streak", name: "Streak Master",
    icon: "🔥", gradient: "from-amber-400 to-rose-500", shadow: "shadow-amber-500/20",
    desc: "No game over. Build the longest streak you can, finish whenever you're ready.",
    rules: ["Wrong answer resets streak — game continues", "No timer, no pressure", "Finish anytime to bank your best streak", "Selected questions appear once per round"],
    hsKey: "mednexus-hs-streak", hsLabel: "Best Streak",
  },
  {
    id: "double", name: "Double Jeopardy",
    icon: "🎲", gradient: "from-indigo-500 to-purple-600", shadow: "shadow-indigo-500/20",
    desc: "Read the vignette, wager your confidence — then see the options.",
    rules: ["Vignette shown first, options hidden", "Wager: Safe 10% / Moderate 25% / Bold 50% / All In 100%", "Correct = win the wager · Wrong = lose it", "Selected questions appear once per round"],
    hsKey: "mednexus-hs-double", hsLabel: "Best Score",
  },
]

// Multiplayer modes (shown separately in the grid)
interface MultiModeCard {
  id: GameModeId; name: string
  icon: string; gradient: string; shadow: string; desc: string; rules: string[]
}
const MULTI_MODES: MultiModeCard[] = [
  {
    id: "clash", name: "Multiplayer Clash",
    icon: "⚔️", gradient: "from-fuchsia-500 to-violet-600", shadow: "shadow-fuchsia-500/20",
    desc: "Compete with up to 5 players. Fastest correct answer takes max points.",
    rules: ["No NP entry fee", "Max 5 players per room · 6-digit PIN", ...getMultiplayerRewardRules()],
  },
  {
    id: "cohort", name: "Cohort Review",
    icon: "🎓", gradient: "from-teal-500 to-cyan-500", shadow: "shadow-teal-500/20",
    desc: "Lecture hall mode — unlimited players, host controls the pace.",
    rules: ["No NP entry fee", "Unlimited players · Players buzz in via phone", ...getMultiplayerRewardRules()],
  },
  {
    id: "wager", name: "Wager Wars",
    icon: "🎰", gradient: "from-amber-500 to-rose-500", shadow: "shadow-amber-500/20",
    desc: "Wager match chips before seeing options. Chips affect this match only and are not spendable NP.",
    rules: ["Vignette shown first, options hidden", "Wager match chips or go All-In", "Chip balance hits 0 → Spectator mode", ...getMultiplayerRewardRules()],
  },
  {
    id: "djmulti", name: "Double Jeopardy",
    icon: "🎲", gradient: "from-indigo-500 to-purple-600", shadow: "shadow-indigo-500/20",
    desc: "Read the vignette, wager your confidence — then see the options. Now with friends.",
    rules: ["Max 5 players · In-game points bank", "Wager: Safe 10% / Moderate 25% / Bold 50% / All In 100%", "Points bank hits 0 → Spectator mode", ...getMultiplayerRewardRules()],
  },
]

const DEFAULT_FILTER: GameFilter = { module: null, discipline: null }
const GAME_UTILITY_BUTTON = "flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-card/80 px-2 text-xs font-extrabold text-foreground shadow-sm backdrop-blur-sm transition-[background-color,border-color,box-shadow] hover:bg-card hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:w-auto sm:px-3"

// ── Utilities ─────────────────────────────────────────────────────────────────
function shuffle<T>(arr: readonly T[]): T[] {
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

function makeFilteredSrc(allQ: Question[], filter: GameFilter): Question[] {
  const pool = buildGameQuestionPool(allQ, {
    effectiveModule: filter.module,
    discipline: filter.discipline,
  })
  if (pool.diagnostics.idDuplicateCount || pool.diagnostics.contentDuplicateCount) {
    console.warn("[game-question-pool] Duplicate questions excluded", pool.diagnostics)
  }
  return shuffle(pool.questions)
}

function makeSoloRoundSelection(allQ: Question[], filter: GameFilter, requestedQuantity: number | null, previousIds: readonly string[] = []) {
  const eligible = makeFilteredSrc(allQ, filter)
  const selectedQuantity = requestedQuantity === null ? eligible.length : Math.min(Math.max(1, requestedQuantity), eligible.length)
  const selected = eligible.slice(0, selectedQuantity)
  const repeatsPreviousOrder = selected.length === previousIds.length
    && selected.every((question, index) => question.id === previousIds[index])
  if (repeatsPreviousOrder && eligible.length > 1) {
    if (selectedQuantity < eligible.length) selected[selectedQuantity - 1] = eligible[selectedQuantity]
    else [selected[0], selected[1]] = [selected[1], selected[0]]
  }
  return { selected, selectedQuantity, eligiblePoolSize: eligible.length }
}

async function loadSoloRoundSelection(
  loader: ReturnType<typeof useQuestions>["loadGameQuestionPool"],
  filter: GameFilter,
  requestedQuantity: number,
  previousIds: readonly string[] = [],
) {
  const batch = await loader(filter, requestedQuantity)
  const selection = makeSoloRoundSelection(batch.questions, DEFAULT_FILTER, null, previousIds)
  return {
    selected: selection.selected,
    selectedQuantity: selection.selected.length,
    eligiblePoolSize: batch.total,
  }
}

/** Count how many game-eligible questions match a compact catalog selection. */
function countForCatalog(catalog: QuestionCatalogModule[], filter: GameFilter): number {
  if (filter.module === null) return catalog.reduce((sum, module) => sum + module.count, 0)
  const module = catalog.find(item => item.name === filter.module)
  if (!module) return 0
  if (filter.discipline === null) return module.count
  return module.disciplines.find(item => item.name === filter.discipline)?.count ?? 0
}

function minimumQuestionsForRewardedGame(mode: ModeConfig["id"]): number {
  return mode === "sudden"
    ? ECONOMY_CONFIG.gameRewards.solo.suddenDeathMinimumAnswers
    : ECONOMY_CONFIG.gameRewards.solo.minimumAnswers
}

function useSoloScoring(mode: SoloGameMode, resumedSessionId?: string) {
  const { startScoredActivity } = useEconomy()
  const sessionPromise = useRef<Promise<string | null> | null>(resumedSessionId ? Promise.resolve(resumedSessionId) : null)
  const [sessionId, setSessionId] = useState<string | undefined>(resumedSessionId)
  return {
    sessionPromise,
    sessionId,
    begin(questions: readonly Question[]) {
      sessionPromise.current = startScoredActivity(mode, questions.map(question => question.id)).then(id => {
        setSessionId(id ?? undefined)
        return id
      })
    },
  }
}

function restoredNumber(state: Record<string, unknown>, key: string, fallback: number) {
  const value = state[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function restoredBoolean(state: Record<string, unknown>, key: string, fallback = false) {
  return typeof state[key] === "boolean" ? state[key] as boolean : fallback
}

function restoredStrings(state: Record<string, unknown>, key: string) {
  return Array.isArray(state[key]) ? (state[key] as unknown[]).filter((value): value is string => typeof value === "string") : []
}

function compactAnswerHistory(history: AnswerHistoryEntry[]) {
  return history.map(entry => ({ questionId: entry.question.id, selected: entry.selected,
    secondAttempt: entry.secondAttempt, assisted: entry.assisted, wager: entry.wager }))
}

function restoreAnswerHistory(value: unknown, questions: readonly Question[]): AnswerHistoryEntry[] {
  if (!Array.isArray(value)) return []
  const byId = new Map(questions.map(question => [question.id, question]))
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return []
    const saved = item as { questionId?: unknown; selected?: unknown; secondAttempt?: unknown; assisted?: unknown; wager?: unknown }
    const question = typeof saved.questionId === "string" ? byId.get(saved.questionId) : undefined
    if (!question || !(saved.selected === null || typeof saved.selected === "string")) return []
    return [{ question, selected: saved.selected, secondAttempt: typeof saved.secondAttempt === "string" || saved.secondAttempt === null ? saved.secondAttempt : undefined,
      assisted: saved.assisted === true, wager: typeof saved.wager === "number" ? saved.wager : undefined }]
  })
}

function usePersistSoloGame(input: {
  mode: SoloGameMode
  active: boolean
  round: ReturnType<typeof useSoloGameRound>
  scoring: ReturnType<typeof useSoloScoring>
  timerDeadline?: number
  state: Record<string, unknown>
}) {
  const { user } = useApp()
  useEffect(() => {
    if (!user || !input.active || !input.round.configuration || input.round.pool.length === 0) return
    saveSoloGameSession({
      userId: user.uid,
      mode: input.mode,
      questionIds: input.round.pool.map(question => question.id),
      module: input.round.configuration.module,
      discipline: input.round.configuration.discipline,
      eligiblePoolSize: input.round.configuration.eligiblePoolSize,
      startedAt: input.round.configuration.startedAt,
      currentQuestionIndex: input.round.qi,
      answeredQuestionIds: [...input.round.answeredIds],
      scoringSessionId: input.scoring.sessionId,
      timerDeadline: input.timerDeadline,
      state: input.state,
    })
  })
  useEffect(() => {
    if (user && input.round.completed) clearSoloGameSession(user.uid)
  }, [input.round.completed, user])
}

/** Shared finite-round contract used by every solo mode.  A round owns a
 * de-duplicated, immutable pool and can cross its completion boundary once. */
function useSoloGameRound(mode: ModeConfig["id"], onFinalize: (reason: SoloCompletionReason) => void, resume?: HydratedSoloGameSession | null) {
  const [pool, setPool] = useState<readonly Question[]>(resume?.questions ?? [])
  const [qi, setQi] = useState(() => {
    if (!resume) return 0
    const currentWasCommitted = resume.answeredQuestionIds.includes(resume.questionIds[resume.currentQuestionIndex])
    return mode !== "double" && currentWasCommitted && resume.currentQuestionIndex + 1 < resume.questionIds.length
      ? resume.currentQuestionIndex + 1
      : resume.currentQuestionIndex
  })
  const [answeredIds, setAnsweredIds] = useState<ReadonlySet<string>>(new Set(resume?.answeredQuestionIds ?? []))
  const [completed, setCompleted] = useState(false)
  const [completionReason, setCompletionReason] = useState<SoloCompletionReason | null>(null)
  const [configuration, setConfiguration] = useState<SoloRoundConfiguration | null>(() => resume ? Object.freeze({
    mode, module: resume.module, discipline: resume.discipline, selectedQuantity: resume.questions.length,
    eligiblePoolSize: resume.eligiblePoolSize, selectedQuestionIds: Object.freeze([...resume.questionIds]), startedAt: resume.startedAt,
  }) : null)
  const finalizedRef = useRef(false)
  const generationRef = useRef(0)
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  const finalizeRef = useRef(onFinalize)
  finalizeRef.current = onFinalize

  useEffect(() => {
    if (!resume || mode === "double") return
    const lastIndex = resume.questionIds.length - 1
    if (resume.currentQuestionIndex === lastIndex && resume.answeredQuestionIds.includes(resume.questionIds[lastIndex])) {
      finalize("pool_completed")
    }
  // Resume a final answer that was saved during its feedback animation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancelTimers = () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
  }
  useEffect(() => () => { generationRef.current += 1; cancelTimers() }, [])

  function startRound(source: readonly Question[], filter: GameFilter, selectedQuantity: number, eligiblePoolSize: number) {
    generationRef.current += 1; cancelTimers(); finalizedRef.current = false
    const finalPool = deduplicateGameQuestions(source)
    const serverSnapshotIds = Object.freeze(finalPool.map(question => question.id))
    if (process.env.NODE_ENV !== "production") {
      const fingerprints = finalPool.map(createQuestionContentFingerprint)
      console.assert(new Set(serverSnapshotIds).size === finalPool.length, "Solo round question IDs must be unique")
      console.assert(new Set(fingerprints).size === finalPool.length, "Solo round content fingerprints must be unique")
      console.assert(selectedQuantity === finalPool.length, "Solo round selectedQuantity must equal its final pool length")
      console.assert(serverSnapshotIds.length === finalPool.length
        && serverSnapshotIds.every((id, index) => id === finalPool[index].id),
      "Server snapshot IDs must match the final client pool IDs")
    }
    setPool(finalPool); setQi(0); setAnsweredIds(new Set())
    setConfiguration(Object.freeze({ mode, module: filter.module, discipline: filter.discipline,
      selectedQuantity: finalPool.length, eligiblePoolSize, selectedQuestionIds: serverSnapshotIds,
      startedAt: new Date().toISOString() }))
    setCompleted(false); setCompletionReason(null)
    return finalPool
  }
  function markAnswered(id: string) {
    setAnsweredIds(previous => previous.has(id) ? previous : new Set(previous).add(id))
  }
  function schedule(callback: () => void, delay: number) {
    const generation = generationRef.current
    const timer = setTimeout(() => {
      timersRef.current.delete(timer)
      if (generation === generationRef.current && !finalizedRef.current) callback()
    }, delay)
    timersRef.current.add(timer)
  }
  function finalize(reason: SoloCompletionReason, feedbackDelay = 0) {
    if (finalizedRef.current) return
    finalizedRef.current = true; generationRef.current += 1; cancelTimers()
    const finish = () => {
      setCompletionReason(reason); setCompleted(true); finalizeRef.current(reason)
    }
    if (feedbackDelay > 0) {
      const timer = setTimeout(finish, feedbackDelay)
      timersRef.current.add(timer)
    } else finish()
  }
  function advanceOrFinalize(feedbackDelay = 0) {
    if (finalizedRef.current) return false
    if (qi + 1 >= pool.length) { finalize("pool_completed", feedbackDelay); return false }
    setQi(index => index + 1); return true
  }
  return { pool, qi, answeredIds, completed, completionReason, configuration, finalizedRef, startRound, markAnswered, schedule, finalize, advanceOrFinalize }
}

// ── Question media ────────────────────────────────────────────────────────────
function QuestionMediaGallery({ media, legacyImage, label }: {
  media?: Question["media"]
  legacyImage?: string | null
  label: string
}) {
  const items = [
    ...(media ?? []).map(item => ({ id: item.id, url: item.url, alt: item.alt, caption: item.caption, sortOrder: item.sortOrder })),
    ...(legacyImage ? [{ id: "legacy-image", url: legacyImage, alt: label, caption: undefined, sortOrder: -1 }] : []),
  ]
    .filter(item => Boolean(item.url))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((item, index, all) => all.findIndex(candidate => candidate.url === item.url) === index)

  if (items.length === 0) return null

  return (
    <div className="mt-4 grid gap-3" data-testid="game-question-media">
      {items.map(item => (
        <figure key={item.id} className="overflow-hidden rounded-2xl border border-border bg-background">
          {/* Imported question media can be a data URI or a user-hosted URL, so use a native image element. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={item.alt || label}
            className="mx-auto max-h-[min(50vh,28rem)] w-auto max-w-full object-contain"
            loading="eager"
          />
          {item.caption && (
            <figcaption className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {item.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}

// ── Option button ─────────────────────────────────────────────────────────────
function OptionBtn({ id, text, media, sel, correct, fb, onSel, eliminated = false }: {
  id: string; text: string; media?: Question["media"]; sel: boolean; correct: boolean; fb: Feedback; onSel: () => void; eliminated?: boolean
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
      <QuestionMediaGallery media={media} label={`Option ${id} image`} />
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
  const { triggerError, isShaking, isFlashing } = useErrorFeedback()
  const prevFbRef = useRef<Feedback | null>(null)

  // Game Mode: error feedback is always active (no gamification gate)
  useEffect(() => {
    if (fb === "wrong" && prevFbRef.current !== "wrong") triggerError()
    prevFbRef.current = fb
  }, [fb]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 sm:gap-4 sm:p-5 max-w-2xl mx-auto">
      {hud}
      <div className={`relative flex-1 overflow-y-auto rounded-3xl border border-border bg-card p-5 sm:p-6 ${isShaking ? "animate-error-shake" : ""}`}>
        {/* Glassmorphic error flash overlay */}
        {isFlashing && (
          <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-rose-500/[0.13] backdrop-blur-[6px]" />
        )}
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
        <RichText content={question.vignette} className="text-sm text-foreground sm:text-base" />
        <QuestionMediaGallery
          media={question.media?.filter(item => item.placement === "stem")}
          legacyImage={question.mediaBase64}
          label="Question image"
        />
      </div>
      <div className="grid gap-2">
        {question.options.map(opt => (
          <OptionBtn
            key={opt.id} id={opt.id} text={opt.text}
            media={[
              ...(opt.media ?? []),
              ...(question.media?.filter(item => item.placement === "option" && item.optionId === opt.id) ?? []),
            ]}
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
  lifelineUsed?: boolean
  freezeCount?: number
}

function GameOver({ emoji, headline, scoreLabel, score, stats, isNewHigh, gameResult, answerHistory, sessionPromise, configuration, completionReason, onReplay, onChangeSetup, onExit }: {
  emoji: string; headline: string; scoreLabel: string; score: number
  stats: { label: string; value: string }[]
  isNewHigh: boolean; gameResult?: GameResult
  answerHistory?: AnswerHistoryEntry[]
  sessionPromise?: Promise<string | null> | null
  configuration: SoloRoundConfiguration | null
  completionReason: SoloCompletionReason | null
  onReplay: () => void; onChangeSetup: () => void; onExit: () => void
}) {
  const { submitGameResult } = useEconomy()
  const [payoutData, setPayoutData] = useState<{
    earned: number
    breakdown: { label: string; amount: number }[]
    bountyUpdates: { id: string; progress: number; target: number; newlyComplete: boolean }[]
  } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [authoritativeIsNewHigh, setAuthoritativeIsNewHigh] = useState(isNewHigh)
  const submitted = useRef(false)

  useEffect(() => {
    if (!gameResult || !sessionPromise || !answerHistory?.length || submitted.current) return
    submitted.current = true
    void sessionPromise.then((sessionId) => {
      if (!sessionId) return
      const seenQuestionIds = new Set<string>()
      const orderedAnswers = answerHistory
        .filter(entry => !seenQuestionIds.has(entry.question.id) && !!seenQuestionIds.add(entry.question.id))
        .map((entry) => ({
          questionId: entry.question.id,
          answer: entry.secondAttempt ?? entry.selected,
          firstAnswer: entry.selected,
          ...(entry.assisted ? { secondAnswer: entry.secondAttempt ?? null, assisted: true } : {}),
        }))
      const answers = Object.fromEntries(
        orderedAnswers.map((entry) => [entry.questionId, entry.answer]),
      )
      return submitGameResult({
        ...gameResult,
        sessionId,
        answers,
        orderedAnswers,
        completionReason,
        clientRoundStartedAt: configuration?.startedAt,
        clientRoundFinishedAt: new Date().toISOString(),
        selectedQuestionCount: configuration?.selectedQuestionIds.length,
        answeredQuestionCount: gameResult.total,
        freezeCount: gameResult.freezeCount ?? 0,
        wagerHistory: answerHistory.some((entry) => entry.wager !== undefined)
          ? answerHistory.map((entry) => entry.wager).filter((wager): wager is number => wager !== undefined)
          : undefined,
      }).then(data => {
        if (!data) return
        setPayoutData(data)
        setAuthoritativeIsNewHigh(data.isNewHigh)
      })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* ── Review Drawer ── */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setReviewOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          {/* Drawer panel — slides in from right */}
          <div
            className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg shadow-md">
                  📖
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Vignette Review</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {(() => {
                      const history = answerHistory ?? []
                      const correct = history.filter(e => e.selected === e.question.correctAnswer).length
                      return `${correct}/${history.length} correct`
                    })()}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setReviewOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground text-lg">✕
              </button>
            </div>

            {/* Question list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {(answerHistory ?? []).map((entry, i) => {
                const isCorrect = entry.selected === entry.question.correctAnswer
                const expl = entry.question.explanation
                return (
                  <div key={i} className={`rounded-3xl border bg-card p-4 ${isCorrect ? "border-emerald-200 dark:border-emerald-800/40" : "border-rose-200 dark:border-rose-800/40"}`}>
                    {/* Status row */}
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${isCorrect ? "bg-emerald-500" : "bg-rose-500"}`}>
                        {i + 1}
                      </span>
                      <span className={`text-[11px] font-extrabold ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {isCorrect ? "Correct" : "Incorrect"}
                      </span>
                      <span className="text-[11px] font-bold text-primary ml-1">{entry.question.subject}</span>
                      {entry.question.module && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{entry.question.module}</span>
                      )}
                    </div>

                    {/* Vignette */}
                    <div className="mb-3 rounded-2xl bg-muted/40 p-3">
                      <RichText content={entry.question.vignette} className="text-xs text-foreground" />
                    </div>

                    {/* Options */}
                    <div className="space-y-1.5 mb-3">
                      {entry.question.options.map(opt => {
                        const isOpt = opt.id === entry.question.correctAnswer
                        const isSel = opt.id === entry.selected && !isOpt
                        let cls = "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs "
                        if (isOpt) cls += "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 font-semibold text-emerald-700 dark:text-emerald-400"
                        else if (isSel) cls += "border-rose-400 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 line-through"
                        else cls += "border-border bg-muted/20 text-muted-foreground"
                        return (
                          <div key={opt.id} className={cls}>
                            <span className={`font-extrabold w-5 shrink-0 ${isOpt ? "text-emerald-600 dark:text-emerald-400" : isSel ? "text-rose-500" : "text-muted-foreground"}`}>{opt.id}.</span>
                            <span className="flex-1">{opt.text}</span>
                            {isOpt && <span className="text-emerald-500 text-xs font-bold">✓</span>}
                            {isSel && <span className="text-rose-500 text-xs font-bold">✗</span>}
                          </div>
                        )
                      })}
                    </div>

                    {/* Explanation block — shown for all questions with available explanation */}
                    {expl && (
                      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/30 p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">📋 Explanation</p>
                        {expl.objective && (
                          <p className="text-xs font-semibold text-foreground leading-relaxed">{expl.objective}</p>
                        )}
                        {expl.details && (
                          <p className="text-xs text-muted-foreground leading-relaxed">{expl.details}</p>
                        )}
                        {!isCorrect && expl.incorrectReasoning && (
                          <div className="rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-2">
                            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mb-0.5">Why the common mistake?</p>
                            <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{expl.incorrectReasoning}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-full flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md sm:max-w-lg">
          <div className="mb-6 text-center">
            <div className="mb-3 text-6xl">{emoji}</div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{headline}</h1>
            {authoritativeIsNewHigh && score > 0 && (
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
          {configuration && (
            <div className="mb-5 rounded-2xl border border-border bg-card px-4 py-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Replay context</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {configuration.module ?? "All Modules"} · {configuration.discipline ?? "All Disciplines"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {configuration.selectedQuantity} question{configuration.selectedQuantity === 1 ? "" : "s"} from {configuration.eligiblePoolSize} eligible
              </p>
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
          <button type="button" onClick={onChangeSetup} className="mt-3 w-full rounded-2xl border border-border py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted">
            Change Setup
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
function FilterPicker({ catalog, filter, onChange }: {
  catalog: QuestionCatalogModule[]
  filter: GameFilter
  onChange: (f: GameFilter) => void
}) {
  const modules = useMemo(() => catalog.map(module => module.name), [catalog])
  const disciplines = useMemo(() => filter.module === null
    ? []
    : catalog.find(module => module.name === filter.module)?.disciplines.map(item => item.name) ?? [],
  [catalog, filter.module])

  const count = countForCatalog(catalog, filter)
  const summary = filter.module === null
    ? `All Questions · ${count} available`
    : `${filter.module} · ${filter.discipline ?? "Whole Module"} · ${count} available`

  return (
    <div className="mb-5 rounded-3xl border border-border bg-card p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Question Scope</p>
      <div className="space-y-3">
        <button type="button" onClick={() => onChange(DEFAULT_FILTER)}
          className={`w-full rounded-2xl border px-3 py-2.5 text-left text-xs font-semibold transition-all ${filter.module === null ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"}`}>
          All Questions
        </button>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Module</span>
          <select value={filter.module ?? ""} onChange={event => onChange({ module: event.target.value || null, discipline: null })}
            className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary">
            <option value="">Choose a module</option>
            {modules.map(module => <option key={module} value={module}>{module}</option>)}
          </select>
        </label>
        {filter.module !== null && (
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Discipline</span>
            <select value={filter.discipline ?? ""} onChange={event => onChange({ module: filter.module, discipline: event.target.value || null })}
              className="w-full rounded-2xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary">
              <option value="">Whole Module</option>
              {disciplines.map(discipline => <option key={discipline} value={discipline}>{discipline}</option>)}
            </select>
          </label>
        )}
      </div>
      <p className="mt-3 rounded-xl bg-primary/8 px-3 py-2 text-center text-[11px] font-semibold text-primary">{summary}</p>
    </div>
  )
}

// ── Shared per-mode menu (start screen) ──────────────────────────────────────
const GAME_PRESETS = [10, 20, 50, 75, 100, 150] as const

function ModeMenu({ mode, hs, catalog, filter, onFilterChange, onStart, onBack }: {
  mode: ModeConfig; hs: number
  catalog: QuestionCatalogModule[]; filter: GameFilter; onFilterChange: (f: GameFilter) => void
  onStart: (qty: number) => Promise<void>; onBack: () => void
}) {
  const count = countForCatalog(catalog, filter)
  const minimumQuestions = minimumQuestionsForRewardedGame(mode.id)
  const tooFew = count < minimumQuestions

  // — Quantity selection state —
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [customValue, setCustomValue] = useState("")
  const [useCustom, setUseCustom] = useState(false)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    if (useCustom) {
      const selected = Number(customValue)
      if (selected > count) {
        setCustomValue(count > 0 ? String(count) : "")
        setUseCustom(count > 0)
      }
    } else if (selectedPreset !== null && selectedPreset > count) {
      setSelectedPreset(null)
    }
  }, [count, customValue, selectedPreset, useCustom])

  function handleFilterChange(nextFilter: GameFilter) {
    onFilterChange(nextFilter)
  }

  // "All" is the default: no preset chosen, no custom value
  const isAllSelected = !useCustom && selectedPreset === null

  function handlePreset(n: number) {
    if (n > count) return
    setUseCustom(false)
    setCustomValue("")
    setSelectedPreset(prev => prev === n ? null : n)
  }

  function handleAll() {
    setUseCustom(false)
    setCustomValue("")
    setSelectedPreset(null)
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/[^0-9]/g, "")
    setCustomValue(v)
    setUseCustom(v.length > 0)
    setSelectedPreset(null)
  }

  function getQty(): number | null {
    if (useCustom) {
      const n = parseInt(customValue, 10)
      if (!isNaN(n) && n > 0) return Math.min(n, count)
    }
    if (selectedPreset !== null) return Math.min(selectedPreset, count)
    return null // null = All
  }

  const qty = getQty()
  const startLabel = qty !== null ? `Start — ${qty} Question${qty === 1 ? "" : "s"}` : `Start Game`

  return (
    <div className="flex min-h-full flex-col p-4 sm:p-8">
      <div className="mx-auto w-full max-w-md sm:max-w-lg">
        <div className="mb-6 text-center">
          <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${mode.gradient} shadow-xl ${mode.shadow} text-4xl`}>
            {mode.icon}
          </div>
          <h1 className="mb-2 text-2xl font-extrabold tracking-tight text-foreground">{mode.name}</h1>
          <p className="text-sm text-muted-foreground">{mode.desc}</p>
          {hs > 0 && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-4 py-1.5 text-sm font-bold text-amber-700 dark:text-amber-400">
              🏆 {mode.hsLabel}: {hs.toLocaleString()}
            </div>
          )}
        </div>

        {/* Filter picker */}
        <FilterPicker catalog={catalog} filter={filter} onChange={handleFilterChange} />

        {/* Question Count */}
        <div className="mb-5 rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Question Count</p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {count} available
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {GAME_PRESETS.map(n => {
              const enabled = n <= count
              const active = !useCustom && selectedPreset === n
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!enabled}
                  onClick={() => handlePreset(n)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all
                    ${active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : enabled
                        ? "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted"
                        : "border-border/40 bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                    }`}
                >
                  {n}
                </button>
              )
            })}
            <button
              type="button"
              onClick={handleAll}
              className={`col-span-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all
                ${isAllSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted"
                }`}
            >
              All ({count})
            </button>
          </div>
          <input
            type="number"
            min={1}
            max={count}
            value={customValue}
            onChange={handleCustomChange}
            placeholder={`Custom (1 – ${count})`}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

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
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400">
            <p className="font-semibold">
              Only {count} eligible question{count !== 1 ? "s" : ""} available. A rewarded {mode.name} game needs at least {minimumQuestions}.
            </p>
            {filter.module !== null && filter.discipline !== null && (
              <button
                type="button"
                onClick={() => handleFilterChange({ module: filter.module, discipline: null })}
                className="mt-3 w-full rounded-xl bg-amber-600 px-3 py-2 font-bold text-white transition-colors hover:bg-amber-700"
              >
                Use Whole Module
              </button>
            )}
            {filter.module !== null && (
              <p className="mt-2 text-center">Or choose another discipline above.</p>
            )}
          </div>
        )}

        <button
          type="button" disabled={tooFew || starting} onClick={async () => {
            setStarting(true)
            try {
              await onStart(getQty() ?? count)
            } finally {
              setStarting(false)
            }
          }}
          className={`w-full rounded-2xl bg-gradient-to-r ${mode.gradient} py-4 text-base font-bold text-white shadow-lg ${mode.shadow} transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100`}
        >
          {starting ? "Loading Questions…" : startLabel}
        </button>
        <button type="button" onClick={onBack} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Back to Mode Select
        </button>
      </div>
    </div>
  )
}

// ── Lifeline Bar ─────────────────────────────────────────────────────────────
function LifelineBar({ onUse50_50, onUseFreeze, onUseSecondOpinion, qty5050, qtyFreeze, qtySecondOpinion = 0, disabled5050, disabledFreeze, disabledSecondOpinion = true, freezeActivated = false, secondOpinionActivated = false }: {
  onUse50_50: () => void; onUseFreeze: () => void
  onUseSecondOpinion?: () => void
  qty5050: number; qtyFreeze: number; qtySecondOpinion?: number
  disabled5050: boolean; disabledFreeze: boolean; disabledSecondOpinion?: boolean
  freezeActivated?: boolean; secondOpinionActivated?: boolean
}) {
  if (qty5050 <= 0 && qtyFreeze <= 0 && qtySecondOpinion <= 0 && !freezeActivated && !secondOpinionActivated) return null
  return (
    <div className="flex items-center justify-center gap-2 py-0.5">
      {qty5050 > 0 && (
        <button type="button" onClick={onUse50_50} disabled={disabled5050}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${disabled5050 ? "opacity-40 cursor-not-allowed border-border bg-muted text-muted-foreground" : "border-violet-200 dark:border-violet-800/40 bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 hover:opacity-80 active:scale-95"}`}>
          🩺 Consult Attending
          <span className="rounded-full bg-violet-200 dark:bg-violet-800 px-1.5 py-0.5 text-[10px] font-extrabold text-violet-800 dark:text-violet-200">×{qty5050}</span>
        </button>
      )}
      {(qtyFreeze > 0 || freezeActivated) && (
        <button type="button" onClick={onUseFreeze} disabled={disabledFreeze} title="Adds 10 seconds to the current question timer."
          aria-label={freezeActivated ? "Stat Labs activated. 10 seconds added." : "Stat Labs. Adds 10 seconds to the current question timer."}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${disabledFreeze ? "opacity-40 cursor-not-allowed border-border bg-muted text-muted-foreground" : "border-cyan-200 dark:border-cyan-800/40 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-400 hover:opacity-80 active:scale-95"}`}>
          {freezeActivated ? <span aria-live="polite">✓ +10s added</span> : <>🧪 Stat Labs</>}
          {!freezeActivated && <span className="rounded-full bg-cyan-200 dark:bg-cyan-800 px-1.5 py-0.5 text-[10px] font-extrabold text-cyan-800 dark:text-cyan-200">×{qtyFreeze}</span>}
        </button>
      )}
      {(qtySecondOpinion > 0 || secondOpinionActivated) && (
        <button type="button" onClick={onUseSecondOpinion} disabled={disabledSecondOpinion}
          title="Activate before answering. A corrected retry continues play but earns no accuracy or NP credit."
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${disabledSecondOpinion ? "opacity-40 cursor-not-allowed border-border bg-muted text-muted-foreground" : "border-amber-200 bg-amber-50 text-amber-700 hover:opacity-80 active:scale-95 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-400"}`}>
          {secondOpinionActivated ? "✓ Second Opinion ready" : "👥 Second Opinion"}
          {!secondOpinionActivated && <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:bg-amber-800 dark:text-amber-200">×{qtySecondOpinion}</span>}
        </button>
      )}
    </div>
  )
}

// ── Hero Split Screen ─────────────────────────────────────────────────────────
function HeroSplitScreen({ onSolo, onMulti, onBack, onOpenStore }: {
  onSolo: () => void; onMulti: () => void; onBack: () => void; onOpenStore?: () => void
}) {
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
      <div className="mx-auto w-full max-w-md sm:max-w-2xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-500 text-xl shadow-lg shadow-fuchsia-500/20" aria-hidden>🎮</span>
            <h1 className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-500 bg-clip-text text-xl font-black tracking-tight text-transparent md:text-2xl">Game Mode</h1>
          </div>
            <p className="hidden text-xs text-muted-foreground md:block">Choose your challenge</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-none sm:grid-flow-col">
            <button type="button" onClick={onOpenStore}
              className={`${GAME_UTILITY_BUTTON} hover:border-violet-500/30`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-500"><ShoppingBag size={15} aria-hidden /></span>
              <span>Store</span>
            </button>
            <WalletBadge onOpenStore={onOpenStore ?? (() => {})} />
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
function ModeCard({ name, icon, gradient, shadow, desc, rules, hsLabel, hsKey, onSelect }: {
  name: string; icon: string; gradient: string; shadow: string
  desc: string; rules: string[]; hsLabel?: string; hsKey?: string; onSelect: () => void
}) {
  const hs = hsKey ? readHs(hsKey) : 0
  return (
    <button
      type="button" onClick={onSelect}
      className="group relative overflow-hidden rounded-2xl border border-border bg-card p-3.5 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/8 hover:scale-[1.01] active:scale-[0.99] sm:p-4"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${gradient}`} />
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md ${shadow} text-lg sm:h-11 sm:w-11`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <span className="mb-1 block font-bold text-foreground">{name}</span>
          <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="mt-2.5 space-y-1">
        {rules.map(rule => (
          <div key={rule} className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
            <span className="h-1 w-1 shrink-0 rounded-full bg-primary/40" />
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
      <div className={`mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r ${gradient} py-2 text-xs font-bold text-white shadow-sm transition-opacity group-hover:opacity-90`}>
        Play
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      </div>
    </button>
  )
}

type ModeCategory = "solo" | "multi"

function QuestsDrawer({ onClose }: { onClose: () => void }) {
  const { bounties, weeklyGoals } = useEconomy()
  const pendingCount = bounties.filter(b => b.progress >= b.target && !b.claimed).length
    + weeklyGoals.filter(goal => goal.completed && !goal.credited).length

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="quests-title">
      <button type="button" aria-label="Close quests" onClick={onClose} className="absolute inset-0 cursor-default bg-black/35 backdrop-blur-[2px]" />
      <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-border bg-background p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">Progress & rewards</p>
            <h2 id="quests-title" className="mt-1 text-xl font-extrabold text-foreground">Quests & Bounties</h2>
            <p className="mt-1 text-xs text-muted-foreground">Complete challenges to earn Nexus Points.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close quests" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">×</button>
        </div>
        {pendingCount > 0 && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-400">
            ✓ {pendingCount} reward{pendingCount === 1 ? "" : "s"} ready to claim
          </div>
        )}
        <DailyBountiesPanel />
      </aside>
    </div>
  )
}

function ModeSelectScreen({ onSelect, onBack, onOpenStore }: {
  onSelect: (id: GameModeId) => void; onBack: () => void; onOpenStore?: () => void
}) {
  const [category, setCategory] = useState<ModeCategory>("solo")
  const [questsOpen, setQuestsOpen] = useState(false)
  const { bounties, weeklyGoals } = useEconomy()
  const questBadgeCount = bounties.filter(b => b.progress >= b.target && !b.claimed).length
    + weeklyGoals.filter(goal => goal.completed && !goal.credited).length

  return (
    <div className="flex min-h-full flex-col p-3 sm:p-5 lg:p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-3 flex w-full items-center justify-between gap-3">
          <h1 className="text-lg font-extrabold tracking-tight text-foreground md:text-xl">Game Mode</h1>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={() => setQuestsOpen(true)} aria-label={questBadgeCount > 0 ? `Quests, ${questBadgeCount} rewards ready` : "Quests"} className={`${GAME_UTILITY_BUTTON} hover:border-cyan-500/30`}>
                <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-500"><ClipboardList size={15} aria-hidden />
                  {questBadgeCount > 0 && <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold leading-none text-white">{questBadgeCount}</span>}
                </span>
                <span>Quests</span>
            </button>
            <WalletBadge onOpenStore={onOpenStore ?? (() => {})} />
          </div>
        </div>

        {/* Category tabs — Solo vs Multiplayer */}
        <div className="mb-3 flex gap-1 rounded-2xl bg-muted p-1">
          <button
            type="button" onClick={() => setCategory("solo")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all ${category === "solo" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            🧍 Solo Modes
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${category === "solo" ? "bg-primary/10 text-primary" : "bg-border/60 text-muted-foreground"}`}>{MODES.length}</span>
          </button>
          <button
            type="button" onClick={() => setCategory("multi")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-all ${category === "multi" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            👥 Multiplayer
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${category === "multi" ? "bg-primary/10 text-primary" : "bg-border/60 text-muted-foreground"}`}>{MULTI_MODES.length}</span>
          </button>
        </div>

        {/* Solo modes window */}
        {category === "solo" && (
          <div className="mb-3">
            <div className="grid gap-4 sm:grid-cols-2">
              {MODES.map(m => (
                <ModeCard key={m.id} {...m} onSelect={() => onSelect(m.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Multiplayer modes window */}
        {category === "multi" && (
          <div className="mb-3">
            <div className="grid gap-4 sm:grid-cols-2">
              {MULTI_MODES.map(m => (
                <ModeCard key={m.id} {...m} onSelect={() => onSelect(m.id)} />
              ))}
            </div>
          </div>
        )}

        <button type="button" onClick={onBack} className="mt-4 w-full rounded-2xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Back to Dashboard
        </button>
      </div>
      {questsOpen && <QuestsDrawer onClose={() => setQuestsOpen(false)} />}
    </div>
  )
}

// ── RAPID FIRE ────────────────────────────────────────────────────────────────
const RAPID_TIME = 15
const MAX_LIVES = 3
const BASE_PTS = 100

function RapidFireMode({ onExit, resume }: { onExit: () => void; resume?: HydratedSoloGameSession | null }) {
  const { gameCatalog: catalog, loadGameQuestionPool } = useQuestions()
  const saved = resume?.state ?? {}
  const scoring = useSoloScoring("rapid", resume?.scoringSessionId)
  const { inventory, useItem: consumeItem, isItemUsePending, isItemUsed } = useEconomy()
  const cfg = MODES[0]

  const [filter, setFilter] = useState<GameFilter>(() => resume ? { module: resume.module, discipline: resume.discipline } : DEFAULT_FILTER)
  const [phase, setPhase] = useState<Phase>(resume ? "playing" : "menu")
  const [lives, setLives] = useState(() => restoredNumber(saved, "lives", MAX_LIVES))
  const [score, setScore] = useState(() => restoredNumber(saved, "score", 0))
  const [streak, setStreak] = useState(() => restoredNumber(saved, "streak", 0))
  const [bestStreak, setBestStreak] = useState(() => restoredNumber(saved, "bestStreak", 0))
  const [timeLeft, setTimeLeft] = useState(() => resume?.timerDeadline ? Math.max(0, Math.ceil((resume.timerDeadline - Date.now()) / 1000)) : RAPID_TIME)
  const [fb, setFb] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [totalQ, setTotalQ] = useState(() => restoredNumber(saved, "totalQ", 0))
  const [totalRight, setTotalRight] = useState(() => restoredNumber(saved, "totalRight", 0))
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))
  const [eliminated, setEliminated] = useState<string[]>(() => restoredStrings(saved, "eliminated"))
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>(() => restoreAnswerHistory(saved.answerHistory, resume?.questions ?? []))
  const [lifelineUsed, setLifelineUsed] = useState(() => restoredBoolean(saved, "lifelineUsed"))
  const [secondOpinionActive, setSecondOpinionActive] = useState(() => restoredBoolean(saved, "secondOpinionActive"))
  const [firstAttempt, setFirstAttempt] = useState<string | null | undefined>(() => typeof saved.firstAttempt === "string" || saved.firstAttempt === null ? saved.firstAttempt : undefined)

  const round = useSoloGameRound(cfg.id, () => {
    const { best, isNewHigh } = getPersonalBestUpdate(r.current.hs, r.current.score)
    setIsNewHigh(isNewHigh)
    setHsState(best); writeHs(cfg.hsKey, best)
    setPhase("over"); r.current.phase = "over"
  })
  const { pool, qi } = round

  const r = useRef({ pool: [] as readonly Question[], qi: 0, lives: MAX_LIVES, score: 0, streak: 0, bestStreak: 0, totalQ: 0, totalRight: 0, hs: 0, fb: null as Feedback, phase: "menu" as Phase })
  r.current = { pool, qi, lives, score, streak, bestStreak, totalQ, totalRight, hs, fb, phase }
  const doRef = useRef<((c: string | null) => void) | null>(null)
  const expiryRef = useRef(resume?.answeredQuestionIds.includes(resume.questionIds[resume.currentQuestionIndex]) ? 0 : (resume?.timerDeadline ?? 0))

  usePersistSoloGame({ mode: "rapid", active: phase === "playing", round, scoring,
    timerDeadline: expiryRef.current, state: { lives, score, streak, bestStreak, totalQ, totalRight,
      eliminated, answerHistory: compactAnswerHistory(answerHistory), lifelineUsed, secondOpinionActive, firstAttempt } })

  function advance(nl: number, ns: number) {
    if (nl <= 0) {
      round.finalize("lives_exhausted"); return
    }
    if (!round.advanceOrFinalize()) return
    setFb(null); r.current.fb = null; setPicked(null); setEliminated([])
    setSecondOpinionActive(false); setFirstAttempt(undefined)
    expiryRef.current = Date.now() + RAPID_TIME * 1000
    setTimeLeft(RAPID_TIME)
  }

  function doAnswer(c: string | null) {
    if (r.current.fb !== null || r.current.phase !== "playing") return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c !== null && c === q.correctAnswer
    if (!right && secondOpinionActive && firstAttempt === undefined) {
      setFirstAttempt(c); setPicked(c)
      return
    }
    const assisted = firstAttempt !== undefined
    const continuationRight = right && assisted
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    round.markAnswered(q.id)
    setAnswerHistory(prev => [...prev, assisted
      ? { question: q, selected: firstAttempt ?? null, secondAttempt: c, assisted: true }
      : { question: q, selected: c }])
    const rewardRight = right && !assisted
    const ns = rewardRight ? r.current.streak + 1 : continuationRight ? r.current.streak : 0
    const nb = Math.max(r.current.bestStreak, ns)
    const nsc = rewardRight ? r.current.score + BASE_PTS + rapidBonus(ns) : r.current.score
    const nl = right ? r.current.lives : r.current.lives - 1
    const ntq = r.current.totalQ + 1; const ntr = rewardRight ? r.current.totalRight + 1 : r.current.totalRight
    setLives(nl); setScore(nsc); setStreak(ns); setBestStreak(nb); setTotalQ(ntq); setTotalRight(ntr)
    r.current.lives = nl; r.current.score = nsc; r.current.streak = ns; r.current.bestStreak = nb; r.current.totalQ = ntq; r.current.totalRight = ntr
    round.schedule(() => advance(nl, nsc), 1100)
  }
  doRef.current = doAnswer

  useEffect(() => {
    if (phase !== "playing" || fb !== null) return
    if (expiryRef.current <= 0) expiryRef.current = Date.now() + RAPID_TIME * 1000
    const id = setInterval(() => {
      if (round.finalizedRef.current) { clearInterval(id); return }
      const rem = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000))
      setTimeLeft(rem)
      if (rem <= 0) { clearInterval(id); doRef.current?.(null) }
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fb, qi])

  async function use50_50() {
    const q = pool[qi]; if (!q || fb !== null) return
    const sessionId = await scoring.sessionPromise.current
    if (!sessionId) return
    const ok = await consumeItem("lifeline_50_50", { sessionId, questionId: q.id })
    if (!ok) return
    setLifelineUsed(true)
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }

  async function useFreeze() {
    const q = pool[qi]
    if (!q || fb !== null) return
    const sessionId = await scoring.sessionPromise.current
    if (!sessionId) return
    const ok = await consumeItem("lifeline_freeze", { sessionId, questionId: q.id })
    if (!ok) return
    setLifelineUsed(true)
    expiryRef.current += 10000
  }

  async function useSecondOpinion() {
    const q = pool[qi]; if (!q || fb !== null || firstAttempt !== undefined) return
    const sessionId = await scoring.sessionPromise.current; if (!sessionId) return
    if (!await consumeItem("lifeline_second_opinion", { sessionId, questionId: q.id })) return
    setLifelineUsed(true); setSecondOpinionActive(true)
  }

  async function start(qty?: number) {
    const requestedQuantity = qty ?? round.configuration?.selectedQuantity ?? countForCatalog(catalog, filter)
    const selection = await loadSoloRoundSelection(loadGameQuestionPool, filter, requestedQuantity, round.configuration?.selectedQuestionIds)
    if (selection.selected.length === 0) return
    const p = round.startRound(selection.selected, filter, selection.selectedQuantity, selection.eligiblePoolSize)
    scoring.begin(p)
    r.current.pool = p; r.current.qi = 0
    setLives(MAX_LIVES); r.current.lives = MAX_LIVES
    setScore(0); r.current.score = 0; setStreak(0); r.current.streak = 0
    setBestStreak(0); r.current.bestStreak = 0; setTimeLeft(RAPID_TIME)
    setFb(null); r.current.fb = null; setPicked(null)
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setIsNewHigh(false); setEliminated([]); setAnswerHistory([])
    setLifelineUsed(false)
    setSecondOpinionActive(false); setFirstAttempt(undefined)
    setPhase("playing"); r.current.phase = "playing"
    expiryRef.current = Date.now() + RAPID_TIME * 1000
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} catalog={catalog} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    return <GameOver emoji={acc >= 80 ? "🏆" : acc >= 60 ? "🎯" : "💪"} headline={round.completionReason === "pool_completed" ? "Round Complete!" : "Game Over!"} scoreLabel="Final Score" score={score} stats={[{ label: "Answered", value: String(totalQ) }, { label: "Accuracy", value: `${acc}%` }, { label: "Best Streak", value: `${bestStreak}×` }]} isNewHigh={isNewHigh} gameResult={{ mode: "rapid", score, correct: totalRight, total: totalQ, bestStreak, isNewHigh, lifelineUsed }} answerHistory={answerHistory} sessionPromise={scoring.sessionPromise.current} configuration={round.configuration} completionReason={round.completionReason} onReplay={() => start()} onChangeSetup={() => setPhase("menu")} onExit={onExit} />
  }
  const q = pool[qi]; if (!q) return null
  const pct = (timeLeft / RAPID_TIME) * 100
  const tc = timeLeft <= 5 ? "bg-rose-500" : timeLeft <= 9 ? "bg-amber-500" : "bg-emerald-500"
  const msg = streakMsg(streak); const bonus = rapidBonus(streak + 1)
  const qty5050 = inventory["lifeline_50_50"] ?? 0
  const qtyFreeze = inventory["lifeline_freeze"] ?? 0
  const qtySecondOpinion = inventory["lifeline_second_opinion"] ?? 0
  // High-alert mode: streak ≥ 5 — glowing HUD border + fire timer bar
  const isHighAlert = streak >= 5

  return (
    <QuestionView question={q} fb={fb} picked={picked} onAnswer={doAnswer} eliminated={new Set(eliminated)}
      hud={
        <div className={`flex flex-col gap-2 rounded-2xl p-2.5 -mx-1 transition-all duration-500 ${
          isHighAlert
            ? "mednexus-high-alert-ring ring-2 ring-amber-500/50 bg-amber-50/40 dark:bg-amber-950/30"
            : ""
        }`}>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <svg key={i} viewBox="0 0 24 24" width={22} height={22} fill={i < lives ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={i < lives ? "text-rose-500" : "text-border"}>
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              ))}
            </div>
            <div className="flex-1" />
            {streak >= 3 && (
              <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-all duration-300 ${
                isHighAlert
                  ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-md shadow-amber-500/30"
                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              }`}>
                {isHighAlert ? "🔥🔥" : "🔥"} {streak}×
                {isHighAlert && <span className="ml-0.5 text-[10px] font-extrabold opacity-90">MAX</span>}
              </div>
            )}
            <p className="text-xl font-extrabold tabular-nums text-foreground">{score.toLocaleString()}</p>
          </div>
          <div className={`relative h-2.5 overflow-hidden rounded-full transition-all duration-300 ${isHighAlert ? "bg-amber-900/20" : "bg-muted"}`}>
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-200 ease-linear ${
                isHighAlert ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 mednexus-fire-bar" : tc
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between px-0.5">
            <span className={`text-xs font-bold tabular-nums ${timeLeft <= 5 ? "text-rose-500" : isHighAlert ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>{timeLeft}s</span>
            {msg ? <span className={`text-xs font-bold ${isHighAlert ? "text-rose-500 animate-pulse" : "text-amber-600 dark:text-amber-400"}`}>{msg}</span> : bonus > 0 && fb === null ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">+{BASE_PTS + bonus} if correct</span> : null}
          </div>
          <LifelineBar qty5050={qty5050} qtyFreeze={qtyFreeze} qtySecondOpinion={qtySecondOpinion} onUse50_50={use50_50} onUseFreeze={useFreeze} onUseSecondOpinion={useSecondOpinion}
            disabled5050={fb !== null || eliminated.length > 0 || isItemUsePending("lifeline_50_50", q.id) || isItemUsed("lifeline_50_50", q.id)}
            disabledFreeze={fb !== null || isItemUsePending("lifeline_freeze", q.id) || isItemUsed("lifeline_freeze", q.id)}
            disabledSecondOpinion={fb !== null || firstAttempt !== undefined || isItemUsePending("lifeline_second_opinion", q.id) || isItemUsed("lifeline_second_opinion", q.id)}
            freezeActivated={isItemUsed("lifeline_freeze", q.id)} secondOpinionActivated={secondOpinionActive} />
        </div>
      }
      footer={<button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Save & Exit</button>}
    />
  )
}

// ── SUDDEN DEATH ──────────────────────────────────────────────────────────────
const SUDDEN_TIME = 20

function SuddenDeathMode({ onExit, resume }: { onExit: () => void; resume?: HydratedSoloGameSession | null }) {
  const { gameCatalog: catalog, loadGameQuestionPool } = useQuestions()
  const saved = resume?.state ?? {}
  const scoring = useSoloScoring("sudden", resume?.scoringSessionId)
  const { inventory, useItem: consumeItem, isItemUsePending, isItemUsed } = useEconomy()
  const cfg = MODES[1]

  const [filter, setFilter] = useState<GameFilter>(() => resume ? { module: resume.module, discipline: resume.discipline } : DEFAULT_FILTER)
  const [phase, setPhase] = useState<Phase>(resume ? "playing" : "menu")
  const [survived, setSurvived] = useState(() => restoredNumber(saved, "survived", 0))
  const [timeLeft, setTimeLeft] = useState(() => resume?.timerDeadline ? Math.max(0, Math.ceil((resume.timerDeadline - Date.now()) / 1000)) : SUDDEN_TIME)
  const [fb, setFb] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))
  const [eliminated, setEliminated] = useState<string[]>(() => restoredStrings(saved, "eliminated"))
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>(() => restoreAnswerHistory(saved.answerHistory, resume?.questions ?? []))
  const [lifelineUsedSD, setLifelineUsedSD] = useState(() => restoredBoolean(saved, "lifelineUsed"))
  const [secondOpinionSD, setSecondOpinionSD] = useState(() => restoredBoolean(saved, "secondOpinionActive"))
  const [firstAttemptSD, setFirstAttemptSD] = useState<string | null | undefined>(() => typeof saved.firstAttempt === "string" || saved.firstAttempt === null ? saved.firstAttempt : undefined)

  const round = useSoloGameRound(cfg.id, () => endGame(r.current.survived), resume)
  const { pool, qi } = round

  const r = useRef({ pool: [] as readonly Question[], qi: 0, survived: 0, hs: 0, fb: null as Feedback, phase: "menu" as Phase })
  r.current = { pool, qi, survived, hs, fb, phase }
  const doRef = useRef<((c: string | null) => void) | null>(null)
  const expiryRef = useRef(resume?.answeredQuestionIds.includes(resume.questionIds[resume.currentQuestionIndex]) ? 0 : (resume?.timerDeadline ?? 0))

  usePersistSoloGame({ mode: "sudden", active: phase === "playing", round, scoring,
    timerDeadline: expiryRef.current, state: { survived, eliminated, answerHistory: compactAnswerHistory(answerHistory),
      lifelineUsed: lifelineUsedSD, secondOpinionActive: secondOpinionSD, firstAttempt: firstAttemptSD } })

  function endGame(finalSurvived: number) {
    const { best, isNewHigh } = getPersonalBestUpdate(r.current.hs, finalSurvived)
    setIsNewHigh(isNewHigh)
    setHsState(best); writeHs(cfg.hsKey, best)
    setSurvived(finalSurvived); setPhase("over"); r.current.phase = "over"
  }

  function doAnswer(c: string | null) {
    if (r.current.fb !== null || r.current.phase !== "playing") return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c !== null && c === q.correctAnswer
    if (!right && secondOpinionSD && firstAttemptSD === undefined) { setFirstAttemptSD(c); setPicked(c); return }
    const assisted = firstAttemptSD !== undefined
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    round.markAnswered(q.id)
    setAnswerHistory(prev => [...prev, assisted ? { question: q, selected: firstAttemptSD ?? null, secondAttempt: c, assisted: true } : { question: q, selected: c }])
    if (right) {
      const ns = assisted ? r.current.survived : r.current.survived + 1; setSurvived(ns); r.current.survived = ns
      round.schedule(() => {
        if (!round.advanceOrFinalize()) return
        setFb(null); r.current.fb = null; setPicked(null); setEliminated([])
        setSecondOpinionSD(false); setFirstAttemptSD(undefined)
        expiryRef.current = Date.now() + SUDDEN_TIME * 1000
        setTimeLeft(SUDDEN_TIME)
      }, 900)
    } else {
      round.finalize(c === null ? "timeout" : "incorrect_answer", 900)
    }
  }
  doRef.current = doAnswer

  useEffect(() => {
    if (phase !== "playing" || fb !== null) return
    if (expiryRef.current <= 0) expiryRef.current = Date.now() + SUDDEN_TIME * 1000
    const id = setInterval(() => {
      if (round.finalizedRef.current) { clearInterval(id); return }
      const rem = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000))
      setTimeLeft(rem)
      if (rem <= 0) { clearInterval(id); doRef.current?.(null) }
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, fb, qi])

  async function use50_50() {
    const q = pool[qi]; if (!q || fb !== null) return
    const sessionId = await scoring.sessionPromise.current
    if (!sessionId) return
    const ok = await consumeItem("lifeline_50_50", { sessionId, questionId: q.id })
    if (!ok) return
    setLifelineUsedSD(true)
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }

  async function useFreeze() {
    const q = pool[qi]
    if (!q || fb !== null) return
    const sessionId = await scoring.sessionPromise.current
    if (!sessionId) return
    const ok = await consumeItem("lifeline_freeze", { sessionId, questionId: q.id })
    if (!ok) return
    setLifelineUsedSD(true)
    expiryRef.current += 10000
  }
  async function useSecondOpinionSD() {
    const q = pool[qi]; if (!q || fb !== null || firstAttemptSD !== undefined) return
    const sessionId = await scoring.sessionPromise.current; if (!sessionId) return
    if (!await consumeItem("lifeline_second_opinion", { sessionId, questionId: q.id })) return
    setLifelineUsedSD(true); setSecondOpinionSD(true)
  }

  async function start(qty?: number) {
    const requestedQuantity = qty ?? round.configuration?.selectedQuantity ?? countForCatalog(catalog, filter)
    const selection = await loadSoloRoundSelection(loadGameQuestionPool, filter, requestedQuantity, round.configuration?.selectedQuestionIds)
    if (selection.selected.length === 0) return
    const p = round.startRound(selection.selected, filter, selection.selectedQuantity, selection.eligiblePoolSize)
    scoring.begin(p)
    r.current.pool = p; r.current.qi = 0
    setSurvived(0); r.current.survived = 0; setTimeLeft(SUDDEN_TIME)
    setFb(null); r.current.fb = null; setPicked(null)
    setIsNewHigh(false); setEliminated([]); setAnswerHistory([])
    setLifelineUsedSD(false)
    setSecondOpinionSD(false); setFirstAttemptSD(undefined)
    setPhase("playing"); r.current.phase = "playing"
    expiryRef.current = Date.now() + SUDDEN_TIME * 1000
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} catalog={catalog} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const score = survived * BASE_PTS
    const total = getSuddenDeathResultTotal(round.completionReason, survived, answerHistory.length)
    return <GameOver emoji={survived >= 20 ? "💀🏆" : survived >= 10 ? "😤" : "💀"} headline={round.completionReason === "pool_completed" ? "Round Complete!" : survived === 0 ? "Out on Question 1!" : `${survived} Questions Survived`} scoreLabel="Score" score={score} stats={[{ label: "Survived", value: String(survived) }, { label: "Answered", value: String(total) }, { label: "Best", value: `${hs} questions` }]} isNewHigh={isNewHigh} gameResult={{ mode: "sudden", score, correct: survived, total, bestStreak: survived, isNewHigh, survivedCount: survived, lifelineUsed: lifelineUsedSD }} answerHistory={answerHistory} sessionPromise={scoring.sessionPromise.current} configuration={round.configuration} completionReason={round.completionReason} onReplay={() => start()} onChangeSetup={() => setPhase("menu")} onExit={onExit} />
  }
  const q = pool[qi]; if (!q) return null
  const pct = (timeLeft / SUDDEN_TIME) * 100
  const tc = timeLeft <= 5 ? "bg-rose-500" : timeLeft <= 10 ? "bg-amber-500" : "bg-rose-400"
  const qty5050 = inventory["lifeline_50_50"] ?? 0
  const qtyFreeze = inventory["lifeline_freeze"] ?? 0
  const qtySecondOpinionSD = inventory["lifeline_second_opinion"] ?? 0

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
          <LifelineBar qty5050={qty5050} qtyFreeze={qtyFreeze} qtySecondOpinion={qtySecondOpinionSD} onUse50_50={use50_50} onUseFreeze={useFreeze} onUseSecondOpinion={useSecondOpinionSD}
            disabled5050={fb !== null || eliminated.length > 0 || isItemUsePending("lifeline_50_50", q.id) || isItemUsed("lifeline_50_50", q.id)}
            disabledFreeze={fb !== null || isItemUsePending("lifeline_freeze", q.id) || isItemUsed("lifeline_freeze", q.id)}
            disabledSecondOpinion={fb !== null || firstAttemptSD !== undefined || isItemUsePending("lifeline_second_opinion", q.id) || isItemUsed("lifeline_second_opinion", q.id)}
            freezeActivated={isItemUsed("lifeline_freeze", q.id)} secondOpinionActivated={secondOpinionSD} />
        </div>
      }
      footer={<button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Save & Exit</button>}
    />
  )
}

// ── TIME ATTACK ───────────────────────────────────────────────────────────────
const TIMEATK_START = 90

function TimeAttackMode({ onExit, resume }: { onExit: () => void; resume?: HydratedSoloGameSession | null }) {
  const { gameCatalog: catalog, loadGameQuestionPool } = useQuestions()
  const saved = resume?.state ?? {}
  const scoring = useSoloScoring("timeatk", resume?.scoringSessionId)
  const { inventory, useItem: consumeItem, isItemUsePending, isItemUsed } = useEconomy()
  const cfg = MODES[2]

  const [filter, setFilter] = useState<GameFilter>(() => resume ? { module: resume.module, discipline: resume.discipline } : DEFAULT_FILTER)
  const [phase, setPhase] = useState<Phase>(resume ? "playing" : "menu")
  const [score, setScore] = useState(() => restoredNumber(saved, "score", 0))
  const [timeLeft, setTimeLeft] = useState(() => resume?.timerDeadline ? Math.max(0, Math.ceil((resume.timerDeadline - Date.now()) / 1000)) : TIMEATK_START)
  const [fb, setFb] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [totalQ, setTotalQ] = useState(() => restoredNumber(saved, "totalQ", 0))
  const [totalRight, setTotalRight] = useState(() => restoredNumber(saved, "totalRight", 0))
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))
  const [eliminated, setEliminated] = useState<string[]>(() => restoredStrings(saved, "eliminated"))
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>(() => restoreAnswerHistory(saved.answerHistory, resume?.questions ?? []))
  const [lifelineUsedTA, setLifelineUsedTA] = useState(() => restoredBoolean(saved, "lifelineUsed"))
  const [freezeCountTA, setFreezeCountTA] = useState(() => restoredNumber(saved, "freezeCount", 0))
  const [secondOpinionTA, setSecondOpinionTA] = useState(() => restoredBoolean(saved, "secondOpinionActive"))
  const [firstAttemptTA, setFirstAttemptTA] = useState<string | null | undefined>(() => typeof saved.firstAttempt === "string" || saved.firstAttempt === null ? saved.firstAttempt : undefined)

  const round = useSoloGameRound(cfg.id, () => endGame(r.current.score), resume)
  const { pool, qi } = round

  const r = useRef({ pool: [] as readonly Question[], qi: 0, score: 0, timeLeft: TIMEATK_START, hs: 0, fb: null as Feedback, phase: "menu" as Phase, totalQ: 0, totalRight: 0 })
  r.current = { pool, qi, score, timeLeft, hs, fb, phase, totalQ, totalRight }
  const expiryRef = useRef(resume?.timerDeadline ?? 0)

  usePersistSoloGame({ mode: "timeatk", active: phase === "playing", round, scoring,
    timerDeadline: expiryRef.current, state: { score, totalQ, totalRight, eliminated,
      answerHistory: compactAnswerHistory(answerHistory), lifelineUsed: lifelineUsedTA, freezeCount: freezeCountTA,
      secondOpinionActive: secondOpinionTA, firstAttempt: firstAttemptTA } })

  function endGame(finalScore: number) {
    const { best, isNewHigh } = getPersonalBestUpdate(r.current.hs, finalScore)
    setIsNewHigh(isNewHigh)
    setHsState(best); writeHs(cfg.hsKey, best)
    setPhase("over"); r.current.phase = "over"
  }

  function doAnswer(c: string | null) {
    if (r.current.fb !== null || r.current.phase !== "playing") return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c !== null && c === q.correctAnswer
    if (!right && secondOpinionTA && firstAttemptTA === undefined) { setFirstAttemptTA(c); setPicked(c); return }
    const assisted = firstAttemptTA !== undefined
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    round.markAnswered(q.id)
    setAnswerHistory(prev => [...prev, assisted ? { question: q, selected: firstAttemptTA ?? null, secondAttempt: c, assisted: true } : { question: q, selected: c }])
    const rewardRight = right && !assisted
    const ns = rewardRight ? r.current.score + BASE_PTS : r.current.score
    const ntq = r.current.totalQ + 1; const ntr = rewardRight ? r.current.totalRight + 1 : r.current.totalRight
    if (rewardRight) expiryRef.current += 3000; else if (!right) expiryRef.current -= 5000
    const nt = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000))
    setScore(ns); setTimeLeft(nt); setTotalQ(ntq); setTotalRight(ntr)
    r.current.score = ns; r.current.timeLeft = nt; r.current.totalQ = ntq; r.current.totalRight = ntr
    if (nt <= 0) { round.finalize("timeout", 700); return }
    round.schedule(() => {
      if (!round.advanceOrFinalize()) return
      setFb(null); r.current.fb = null; setPicked(null); setEliminated([])
      setSecondOpinionTA(false); setFirstAttemptTA(undefined)
    }, 700)
  }

  useEffect(() => {
    if (phase !== "playing") return
    if (expiryRef.current <= 0) expiryRef.current = Date.now() + TIMEATK_START * 1000
    const id = setInterval(() => {
      if (round.finalizedRef.current) { clearInterval(id); return }
      const rem = Math.max(0, Math.ceil((expiryRef.current - Date.now()) / 1000))
      setTimeLeft(rem)
      r.current.timeLeft = rem
      if (rem <= 0) { clearInterval(id); round.finalize("timeout") }
    }, 200)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  async function use50_50() {
    const q = pool[qi]; if (!q || fb !== null) return
    const sessionId = await scoring.sessionPromise.current
    if (!sessionId) return
    const ok = await consumeItem("lifeline_50_50", { sessionId, questionId: q.id })
    if (!ok) return
    setLifelineUsedTA(true)
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }

  async function useFreeze() {
    const q = pool[qi]
    if (!q || fb !== null) return
    const sessionId = await scoring.sessionPromise.current
    if (!sessionId) return
    const ok = await consumeItem("lifeline_freeze", { sessionId, questionId: q.id })
    if (!ok) return
    setLifelineUsedTA(true)
    setFreezeCountTA(count => count + 1)
    expiryRef.current += 10000
  }
  async function useSecondOpinionTA() {
    const q = pool[qi]; if (!q || fb !== null || firstAttemptTA !== undefined) return
    const sessionId = await scoring.sessionPromise.current; if (!sessionId) return
    if (!await consumeItem("lifeline_second_opinion", { sessionId, questionId: q.id })) return
    setLifelineUsedTA(true); setSecondOpinionTA(true)
  }

  async function start(qty?: number) {
    const requestedQuantity = qty ?? round.configuration?.selectedQuantity ?? countForCatalog(catalog, filter)
    const selection = await loadSoloRoundSelection(loadGameQuestionPool, filter, requestedQuantity, round.configuration?.selectedQuestionIds)
    if (selection.selected.length === 0) return
    const p = round.startRound(selection.selected, filter, selection.selectedQuantity, selection.eligiblePoolSize)
    scoring.begin(p)
    r.current.pool = p; r.current.qi = 0
    setScore(0); r.current.score = 0; setTimeLeft(TIMEATK_START); r.current.timeLeft = TIMEATK_START
    setFb(null); r.current.fb = null; setPicked(null)
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setIsNewHigh(false); setEliminated([]); setAnswerHistory([])
    setLifelineUsedTA(false); setFreezeCountTA(0)
    setSecondOpinionTA(false); setFirstAttemptTA(undefined)
    setPhase("playing"); r.current.phase = "playing"
    expiryRef.current = Date.now() + TIMEATK_START * 1000
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} catalog={catalog} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    return <GameOver emoji={acc >= 80 ? "⚡🏆" : acc >= 60 ? "⏱️" : "💨"} headline={round.completionReason === "pool_completed" ? "Round Complete!" : "Time's Up!"} scoreLabel="Final Score" score={score} stats={[{ label: "Answered", value: String(totalQ) }, { label: "Correct", value: String(totalRight) }, { label: "Accuracy", value: `${acc}%` }]} isNewHigh={isNewHigh} gameResult={{ mode: "timeatk", score, correct: totalRight, total: totalQ, bestStreak: 0, isNewHigh, lifelineUsed: lifelineUsedTA, freezeCount: freezeCountTA }} answerHistory={answerHistory} sessionPromise={scoring.sessionPromise.current} configuration={round.configuration} completionReason={round.completionReason} onReplay={() => start()} onChangeSetup={() => setPhase("menu")} onExit={onExit} />
  }
  const q = pool[qi]; if (!q) return null
  const qty5050 = inventory["lifeline_50_50"] ?? 0
  const qtyFreeze = inventory["lifeline_freeze"] ?? 0
  const qtySecondOpinionTA = inventory["lifeline_second_opinion"] ?? 0
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
          <LifelineBar qty5050={qty5050} qtyFreeze={qtyFreeze} qtySecondOpinion={qtySecondOpinionTA} onUse50_50={use50_50} onUseFreeze={useFreeze} onUseSecondOpinion={useSecondOpinionTA}
            disabled5050={fb !== null || eliminated.length > 0 || isItemUsePending("lifeline_50_50", q.id) || isItemUsed("lifeline_50_50", q.id)}
            disabledFreeze={fb !== null || isItemUsePending("lifeline_freeze", q.id) || isItemUsed("lifeline_freeze", q.id)}
            disabledSecondOpinion={fb !== null || firstAttemptTA !== undefined || isItemUsePending("lifeline_second_opinion", q.id) || isItemUsed("lifeline_second_opinion", q.id)}
            freezeActivated={isItemUsed("lifeline_freeze", q.id)} secondOpinionActivated={secondOpinionTA} />
        </div>
      }
      footer={<button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Save & Exit</button>}
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

function DoubleJeopardyMode({ onExit, resume }: { onExit: () => void; resume?: HydratedSoloGameSession | null }) {
  const { gameCatalog: catalog, loadGameQuestionPool } = useQuestions()
  const saved = resume?.state ?? {}
  const scoring = useSoloScoring("double", resume?.scoringSessionId)
  const { inventory, useItem: consumeItem, isItemUsePending, isItemUsed } = useEconomy()
  const cfg = MODES.find(m => m.id === "double")!

  const [filter, setFilter] = useState<GameFilter>(() => resume ? { module: resume.module, discipline: resume.discipline } : DEFAULT_FILTER)
  const [djPhase, setDjPhase] = useState<DJPhase>(() => resume && (saved.djPhase === "wager" || saved.djPhase === "answering" || saved.djPhase === "feedback") ? saved.djPhase : "menu")
  const [bank, setBank] = useState(() => restoredNumber(saved, "bank", DJ_STARTING_BANK))
  const [wager, setWager] = useState(() => restoredNumber(saved, "wager", 0))
  const [picked, setPicked] = useState<string | null>(null)
  const [fb, setFb] = useState<Feedback>(null)
  const [totalQ, setTotalQ] = useState(() => restoredNumber(saved, "totalQ", 0))
  const [totalRight, setTotalRight] = useState(() => restoredNumber(saved, "totalRight", 0))
  const [bestWager, setBestWager] = useState(() => restoredNumber(saved, "bestWager", 0))
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))
  const [eliminated, setEliminated] = useState<string[]>(() => restoredStrings(saved, "eliminated"))
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>(() => restoreAnswerHistory(saved.answerHistory, resume?.questions ?? []))
  const [lifelineUsedDJ, setLifelineUsedDJ] = useState(() => restoredBoolean(saved, "lifelineUsed"))

  const round = useSoloGameRound(cfg.id, () => {
    const { best, isNewHigh } = getPersonalBestUpdate(r.current.hs, r.current.bank)
    setIsNewHigh(isNewHigh)
    setHsState(best); writeHs(cfg.hsKey, best); setDjPhase("over")
  }, resume)
  const { pool, qi } = round

  const r = useRef({ pool: [] as readonly Question[], qi: 0, bank: DJ_STARTING_BANK, wager: 0, hs: 0, totalQ: 0, totalRight: 0, bestWager: 0 })
  r.current = { pool, qi, bank, wager, hs, totalQ, totalRight, bestWager }

  usePersistSoloGame({ mode: "double", active: djPhase !== "menu" && djPhase !== "over", round, scoring,
    state: { djPhase, bank, wager, totalQ, totalRight, bestWager, eliminated,
      answerHistory: compactAnswerHistory(answerHistory), lifelineUsed: lifelineUsedDJ } })

  useEffect(() => {
    if (djPhase !== "feedback") return
    const timer = setTimeout(() => {
      if (bank <= 0) round.finalize("bank_depleted")
      else if (round.advanceOrFinalize()) { setFb(null); setPicked(null); setDjPhase("wager") }
    }, 250)
    return () => clearTimeout(timer)
  // Resume a feedback boundary that was interrupted before its scheduled advance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const qty5050dj = inventory["lifeline_50_50"] ?? 0

  async function start(qty?: number) {
    const requestedQuantity = qty ?? round.configuration?.selectedQuantity ?? countForCatalog(catalog, filter)
    const selection = await loadSoloRoundSelection(loadGameQuestionPool, filter, requestedQuantity, round.configuration?.selectedQuestionIds)
    if (selection.selected.length === 0) return
    const p = round.startRound(selection.selected, filter, selection.selectedQuantity, selection.eligiblePoolSize)
    scoring.begin(p)
    r.current.pool = p; r.current.qi = 0
    setBank(DJ_STARTING_BANK); r.current.bank = DJ_STARTING_BANK
    setWager(0); r.current.wager = 0
    setPicked(null); setFb(null); setEliminated([]); setAnswerHistory([])
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setBestWager(0); r.current.bestWager = 0
    setIsNewHigh(false); setLifelineUsedDJ(false); setDjPhase("wager")
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
    round.markAnswered(q.id)
    setAnswerHistory(prev => [...prev, { question: q, selected: c, wager: r.current.wager }])
    const nb = right ? r.current.bank + r.current.wager : Math.max(0, r.current.bank - r.current.wager)
    const ntq = r.current.totalQ + 1; const ntr = right ? r.current.totalRight + 1 : r.current.totalRight
    const nbw = Math.max(r.current.bestWager, r.current.wager)
    setBank(nb); r.current.bank = nb
    setTotalQ(ntq); r.current.totalQ = ntq; setTotalRight(ntr); r.current.totalRight = ntr
    setBestWager(nbw); r.current.bestWager = nbw
    setDjPhase("feedback")
    round.schedule(() => {
      const nextQi = r.current.qi + 1
      if (r.current.bank <= 0) round.finalize("bank_depleted")
      else if (round.advanceOrFinalize()) {
        r.current.qi = nextQi
        setFb(null); setPicked(null); setDjPhase("wager")
      }
    }, 1400)
  }

  async function use50_50dj() {
    const q = pool[qi]; if (!q || djPhase !== "answering") return
    const sessionId = await scoring.sessionPromise.current
    if (!sessionId) return
    const ok = await consumeItem("lifeline_50_50", { sessionId, questionId: q.id })
    if (!ok) return
    setLifelineUsedDJ(true)
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }

  if (djPhase === "menu") {
    return <ModeMenu mode={cfg} hs={hs} catalog={catalog} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  }

  if (djPhase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    return (
      <GameOver
        emoji={bank >= DJ_STARTING_BANK * 3 ? "💎🏆" : bank >= DJ_STARTING_BANK ? "🎲" : "💸"}
        headline={round.completionReason === "pool_completed" ? "Round Complete!" : "Confidence cashed out!"}
        scoreLabel="Final Bank"
        score={bank}
        stats={[
          { label: "Questions", value: String(totalQ) },
          { label: "Accuracy", value: `${acc}%` },
          { label: "Biggest Wager", value: bestWager.toLocaleString() },
        ]}
        isNewHigh={isNewHigh}
        gameResult={{ mode: "double", score: bank, correct: totalRight, total: totalQ, bestStreak: 0, isNewHigh, lifelineUsed: lifelineUsedDJ }}
        answerHistory={answerHistory}
        sessionPromise={scoring.sessionPromise.current}
        configuration={round.configuration}
        completionReason={round.completionReason}
        onReplay={() => start()}
        onChangeSetup={() => setDjPhase("menu")}
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
          <RichText content={q.vignette} className="text-sm text-foreground sm:text-base" />
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

        <button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Save & Exit</button>
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
            disabled5050={fb !== null || eliminated.length > 0 || isItemUsePending("lifeline_50_50", q.id) || isItemUsed("lifeline_50_50", q.id)} disabledFreeze={true} />
        </div>
      }
      footer={<button type="button" onClick={onExit} className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground">Save & Exit</button>}
    />
  )
}

// ── STREAK MASTER ─────────────────────────────────────────────────────────────
function StreakMasterMode({ onExit, resume }: { onExit: () => void; resume?: HydratedSoloGameSession | null }) {
  const { gameCatalog: catalog, loadGameQuestionPool } = useQuestions()
  const saved = resume?.state ?? {}
  const scoring = useSoloScoring("streak", resume?.scoringSessionId)
  const { inventory, useItem: consumeItem, isItemUsePending, isItemUsed } = useEconomy()
  const cfg = MODES[3]

  const [filter, setFilter] = useState<GameFilter>(() => resume ? { module: resume.module, discipline: resume.discipline } : DEFAULT_FILTER)
  const [phase, setPhase] = useState<Phase>(resume ? "playing" : "menu")
  const [streak, setStreak] = useState(() => restoredNumber(saved, "streak", 0))
  const [bestStreak, setBestStreak] = useState(() => restoredNumber(saved, "bestStreak", 0))
  const [totalQ, setTotalQ] = useState(() => restoredNumber(saved, "totalQ", 0))
  const [totalRight, setTotalRight] = useState(() => restoredNumber(saved, "totalRight", 0))
  const [fb, setFb] = useState<Feedback>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [hs, setHsState] = useState(() => readHs(cfg.hsKey))
  const [eliminated, setEliminated] = useState<string[]>(() => restoredStrings(saved, "eliminated"))
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>(() => restoreAnswerHistory(saved.answerHistory, resume?.questions ?? []))
  const [lifelineUsedSM, setLifelineUsedSM] = useState(() => restoredBoolean(saved, "lifelineUsed"))
  const [secondOpinionSM, setSecondOpinionSM] = useState(() => restoredBoolean(saved, "secondOpinionActive"))
  const [firstAttemptSM, setFirstAttemptSM] = useState<string | undefined>(() => typeof saved.firstAttempt === "string" ? saved.firstAttempt : undefined)

  const round = useSoloGameRound(cfg.id, () => finishGameStats(), resume)
  const { pool, qi } = round

  const r = useRef({ pool: [] as readonly Question[], qi: 0, streak: 0, bestStreak: 0, totalQ: 0, totalRight: 0, hs: 0, fb: null as Feedback })
  r.current = { pool, qi, streak, bestStreak, totalQ, totalRight, hs, fb }

  usePersistSoloGame({ mode: "streak", active: phase === "playing", round, scoring,
    state: { streak, bestStreak, totalQ, totalRight, eliminated, answerHistory: compactAnswerHistory(answerHistory),
      lifelineUsed: lifelineUsedSM, secondOpinionActive: secondOpinionSM, firstAttempt: firstAttemptSM } })

  const qty5050sm = inventory["lifeline_50_50"] ?? 0
  const qtySecondOpinionSM = inventory["lifeline_second_opinion"] ?? 0

  function doAnswer(c: string) {
    if (r.current.fb !== null) return
    const q = r.current.pool[r.current.qi]; if (!q) return
    const right = c === q.correctAnswer
    if (!right && secondOpinionSM && firstAttemptSM === undefined) { setFirstAttemptSM(c); setPicked(c); return }
    const assisted = firstAttemptSM !== undefined
    const nfb: Feedback = right ? "correct" : "wrong"
    setFb(nfb); r.current.fb = nfb; setPicked(c)
    round.markAnswered(q.id)
    setAnswerHistory(prev => [...prev, assisted ? { question: q, selected: firstAttemptSM!, secondAttempt: c, assisted: true } : { question: q, selected: c }])
    const ns = right && !assisted ? r.current.streak + 1 : right ? r.current.streak : 0
    const nb = Math.max(r.current.bestStreak, ns)
    const ntq = r.current.totalQ + 1; const ntr = right && !assisted ? r.current.totalRight + 1 : r.current.totalRight
    setStreak(ns); setBestStreak(nb); setTotalQ(ntq); setTotalRight(ntr)
    r.current.streak = ns; r.current.bestStreak = nb; r.current.totalQ = ntq; r.current.totalRight = ntr
    round.schedule(() => {
      if (!round.advanceOrFinalize()) return
      setFb(null); r.current.fb = null; setPicked(null); setEliminated([])
      setSecondOpinionSM(false); setFirstAttemptSM(undefined)
    }, 900)
  }

  async function use50_50sm() {
    const q = pool[qi]; if (!q || fb !== null) return
    const sessionId = await scoring.sessionPromise.current
    if (!sessionId) return
    const ok = await consumeItem("lifeline_50_50", { sessionId, questionId: q.id })
    if (!ok) return
    setLifelineUsedSM(true)
    const wrongs = q.options.filter(o => o.id !== q.correctAnswer).map(o => o.id)
    const toElim = wrongs.sort(() => Math.random() - 0.5).slice(0, Math.max(0, wrongs.length - 1))
    setEliminated(toElim)
  }
  async function useSecondOpinionSM() {
    const q = pool[qi]; if (!q || fb !== null || firstAttemptSM !== undefined) return
    const sessionId = await scoring.sessionPromise.current; if (!sessionId) return
    if (!await consumeItem("lifeline_second_opinion", { sessionId, questionId: q.id })) return
    setLifelineUsedSM(true); setSecondOpinionSM(true)
  }

  function finishGameStats() {
    const { best, isNewHigh } = getPersonalBestUpdate(r.current.hs, r.current.bestStreak)
    setIsNewHigh(isNewHigh)
    setHsState(best); writeHs(cfg.hsKey, best); setPhase("over")
  }

  function finishGame() { round.finalize("player_finished") }

  async function start(qty?: number) {
    const requestedQuantity = qty ?? round.configuration?.selectedQuantity ?? countForCatalog(catalog, filter)
    const selection = await loadSoloRoundSelection(loadGameQuestionPool, filter, requestedQuantity, round.configuration?.selectedQuestionIds)
    if (selection.selected.length === 0) return
    const p = round.startRound(selection.selected, filter, selection.selectedQuantity, selection.eligiblePoolSize)
    scoring.begin(p)
    r.current.pool = p; r.current.qi = 0
    setStreak(0); r.current.streak = 0; setBestStreak(0); r.current.bestStreak = 0
    setTotalQ(0); r.current.totalQ = 0; setTotalRight(0); r.current.totalRight = 0
    setFb(null); r.current.fb = null; setPicked(null)
    setIsNewHigh(false); setEliminated([]); setAnswerHistory([])
    setLifelineUsedSM(false)
    setSecondOpinionSM(false); setFirstAttemptSM(undefined)
    setPhase("playing")
  }

  if (phase === "menu") return <ModeMenu mode={cfg} hs={hs} catalog={catalog} filter={filter} onFilterChange={setFilter} onStart={start} onBack={onExit} />
  if (phase === "over") {
    const acc = totalQ > 0 ? Math.round(totalRight / totalQ * 100) : 0
    const finalScore = bestStreak * 50 + totalRight * 10
    return <GameOver emoji={bestStreak >= 15 ? "🔥🏆" : bestStreak >= 8 ? "🔥" : "💪"} headline={round.completionReason === "pool_completed" ? "Round Complete!" : "Great run!"} scoreLabel="Score" score={finalScore} stats={[{ label: "Best Streak", value: `${bestStreak}×` }, { label: "Answered", value: String(totalQ) }, { label: "Accuracy", value: `${acc}%` }]} isNewHigh={isNewHigh} gameResult={{ mode: "streak", score: finalScore, correct: totalRight, total: totalQ, bestStreak, isNewHigh, lifelineUsed: lifelineUsedSM }} answerHistory={answerHistory} sessionPromise={scoring.sessionPromise.current} configuration={round.configuration} completionReason={round.completionReason} onReplay={() => start()} onChangeSetup={() => setPhase("menu")} onExit={onExit} />
  }

  const q = pool[qi]; if (!q) return null
  const msg = streakMsg(streak)
  // High-alert mode: streak ≥ 5 — pulsing glow on the streak card
  const isHighAlert = streak >= 5

  return (
    <QuestionView question={q} fb={fb} picked={picked} onAnswer={doAnswer}
      hud={
        <div className={`flex items-center gap-3 rounded-2xl p-2 -mx-1 transition-all duration-500 ${
          isHighAlert ? "mednexus-high-alert-ring ring-2 ring-amber-500/50 bg-amber-50/40 dark:bg-amber-950/30" : ""
        }`}>
          <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition-all duration-500 ${
            isHighAlert
              ? "border-amber-500/70 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-950/60 dark:to-orange-950/60 shadow-md shadow-amber-500/20"
              : "border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-950/30"
          }`}>
            <span className={`text-base transition-all ${isHighAlert ? "animate-bounce" : ""}`}>🔥</span>
            <div>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold leading-none">Streak</p>
              <p className={`text-xl font-extrabold tabular-nums leading-none mt-0.5 ${isHighAlert ? "text-orange-600 dark:text-orange-400" : "text-amber-700 dark:text-amber-300"}`}>
                {streak}×
              </p>
            </div>
            {isHighAlert && (
              <span className="ml-0.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 px-2 py-0.5 text-[9px] font-extrabold text-white shadow-sm">
                MAX
              </span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            <p className="text-[11px] text-muted-foreground">Best: <span className="font-bold text-foreground">{bestStreak}×</span></p>
            {msg && <p className={`text-[11px] font-bold ${isHighAlert ? "text-rose-500 animate-pulse" : "text-amber-600 dark:text-amber-400"}`}>{msg}</p>}
          </div>
          <div className="flex-1" />
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Answered</p>
            <p className="text-sm font-extrabold tabular-nums text-foreground">{totalQ}</p>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-col gap-2">
          <LifelineBar qty5050={qty5050sm} qtyFreeze={0} qtySecondOpinion={qtySecondOpinionSM}
            onUse50_50={use50_50sm} onUseFreeze={() => {}} onUseSecondOpinion={useSecondOpinionSM}
            disabled5050={fb !== null || eliminated.length > 0 || isItemUsePending("lifeline_50_50", q.id) || isItemUsed("lifeline_50_50", q.id)}
            disabledFreeze={true}
            disabledSecondOpinion={fb !== null || firstAttemptSM !== undefined || isItemUsePending("lifeline_second_opinion", q.id) || isItemUsed("lifeline_second_opinion", q.id)}
            secondOpinionActivated={secondOpinionSM} />
          <div className="flex items-center gap-2">
          <button type="button" onClick={finishGame} disabled={fb !== null} className="flex-1 rounded-2xl bg-gradient-to-r from-amber-400 to-rose-500 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50">
            Finish Game
          </button>
          <button type="button" onClick={onExit} className="rounded-2xl border border-border py-2.5 px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Save & Exit
          </button>
          </div>
        </div>
      }
    />
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export function GameMode({ onExit, onOpenStore }: { onExit: () => void; onOpenStore?: () => void }) {
  const { user } = useApp()
  const { gameCatalog, gameCatalogLoading, reloadGameCatalog, loadQuestionsByIds } = useQuestions()
  const roomResumeRef = useRef(loadActiveRoomSession(user?.uid))
  const savedSoloRef = useRef(user ? loadSoloGameSession(user.uid) : null)
  const [soloResume, setSoloResume] = useState<HydratedSoloGameSession | null | undefined>(savedSoloRef.current ? undefined : null)
  // Auto-resume an in-progress multiplayer match on mount (e.g. after a page
  // refresh) instead of forcing the player back through mode selection.
  const [activeMode, setActiveMode] = useState<GameModeId | null>(() => {
    return roomResumeRef.current?.mode ?? savedSoloRef.current?.mode ?? null
  })

  useEffect(() => {
    const saved = savedSoloRef.current
    if (!saved || !user) return
    void loadQuestionsByIds(saved.questionIds, true).then(questions => {
      if (questions.length !== saved.questionIds.length) throw new Error("Incomplete saved pool")
      setSoloResume({ ...saved, questions })
    }).catch(() => {
      clearSoloGameSession(user.uid)
      savedSoloRef.current = null
      setSoloResume(null)
      setActiveMode(current => current === saved.mode ? null : current)
    })
  }, [loadQuestionsByIds, user])

  function handleSoloExit() {
    if (user) {
      const saved = loadSoloGameSession(user.uid)
      savedSoloRef.current = saved
      if (saved) {
        setSoloResume(undefined)
        void loadQuestionsByIds(saved.questionIds, true).then(questions => {
          setSoloResume({ ...saved, questions })
        }).catch(() => {
          clearSoloGameSession(user.uid)
          savedSoloRef.current = null
          setSoloResume(null)
        })
      } else {
        setSoloResume(null)
      }
    }
    setActiveMode(null)
  }

  useEffect(() => {
    if (activeMode && gameCatalog.length === 0) void reloadGameCatalog()
    // Fetch once when a player enters or resumes a mode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode])

  const soloMode = activeMode === "rapid" || activeMode === "sudden" || activeMode === "timeatk" || activeMode === "streak" || activeMode === "double"
  if (activeMode && (gameCatalogLoading || gameCatalog.length === 0 || (soloMode && savedSoloRef.current && soloResume === undefined))) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-muted-foreground">Loading question options…</div>
  }


  if (activeMode === "rapid") return <RapidFireMode resume={soloResume?.mode === "rapid" ? soloResume : null} onExit={handleSoloExit} />
  if (activeMode === "sudden") return <SuddenDeathMode resume={soloResume?.mode === "sudden" ? soloResume : null} onExit={handleSoloExit} />
  if (activeMode === "timeatk") return <TimeAttackMode resume={soloResume?.mode === "timeatk" ? soloResume : null} onExit={handleSoloExit} />
  if (activeMode === "streak") return <StreakMasterMode resume={soloResume?.mode === "streak" ? soloResume : null} onExit={handleSoloExit} />
  if (activeMode === "double") return <DoubleJeopardyMode resume={soloResume?.mode === "double" ? soloResume : null} onExit={handleSoloExit} />
  if (activeMode === "clash") return <MultiplayerClash onExit={() => setActiveMode(null)} />
  if (activeMode === "cohort") return <CohortReview onExit={() => setActiveMode(null)} />
  if (activeMode === "wager") return <WagerWars onExit={() => setActiveMode(null)} />
  if (activeMode === "djmulti") return <DoubleJeopardyMulti onExit={() => setActiveMode(null)} />

  return <ModeSelectScreen onSelect={setActiveMode} onBack={onExit} onOpenStore={onOpenStore} />
}
