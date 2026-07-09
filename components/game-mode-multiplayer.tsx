"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuestions } from "@/contexts/questions-context"
import type { Question } from "@/lib/types"
import { RichText } from "@/components/rich-text"
import { useErrorFeedback } from "@/hooks/use-error-feedback"
import { saveActiveRoomSession, loadActiveRoomSession, clearActiveRoomSession } from "@/lib/multiplayer-session"
import { useEconomy } from "@/contexts/economy-context"
import { TITLE_LABELS, FRAME_RING_CLASSES, HIGHLIGHT_ROW_CLASSES } from "@/lib/economy"

// ── Types ─────────────────────────────────────────────────────────────────────
type MultiMode = "clash" | "cohort" | "wager" | "djmulti"
type RoomPhase = "lobby" | "wager" | "question" | "reveal" | "done"
type FilterScope = "all" | "module" | "subject"

interface GameFilter { scope: FilterScope; value: string | null }
const DEFAULT_FILTER: GameFilter = { scope: "all", value: null }

interface RoomPlayer {
  id: string; name: string; score: number; streak: number
  answer: string | null; answeredAt: number | null; isHost: boolean
  reactionTimeMs?: number | null
  status?: "active" | "disconnected"
  // Wager Wars
  balance?: number; wagerAmount?: number | null; isSpectator?: boolean
  // Cosmetics (equipped by the player; embedded at join/create time)
  equippedTitle?:     string | null
  equippedFrame?:     string | null
  equippedHighlight?: string | null
}

interface SlimQuestion {
  id: string; subject: string; module: string | null
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string
  explanation?: { objective?: string; details?: string; incorrectReasoning?: string } | null
}

interface MultiAnswerEntry { question: SlimQuestion; selected: string }

interface RoomState {
  pin: string; mode: MultiMode; hostId: string; hostName: string
  questionPool: SlimQuestion[]; currentQi: number; phase: RoomPhase
  players: RoomPlayer[]
  leaderboard: RoomPlayer[] // top-5 sorted by score
  ranks: Record<string, number>
  version: number
  /** Absolute epoch-ms when the current question expires. Null outside question phase or in wager mode. */
  phaseDeadlineMs?: number | null
  /** Set when a wager/djmulti match ends early via Last Man Standing knockout. */
  knockoutWinnerId?: string | null
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function getOrCreatePlayerId(): string {
  try {
    let id = sessionStorage.getItem("mednexus-game-pid")
    if (!id) { id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; sessionStorage.setItem("mednexus-game-pid", id) }
    return id
  } catch { return `p-${Date.now()}` }
}

/** Returns true when a question has multiple correct answers (SATA).
 *  Single-item arrays ["A"] are treated as single-answer (normalised on save).
 *  Multiplayer game modes only support single-answer MCQs so true SATA must be excluded. */
function isSATA(q: Question): boolean {
  return Array.isArray(q.correctAnswer) && q.correctAnswer.length > 1
}

function filterQuestions(allQ: Question[], filter: GameFilter): Question[] {
  let base = allQ.filter(q => !isSATA(q) && (!q.moduleStatus || q.moduleStatus === "live"))
  if (base.length < 5) base = allQ.filter(q => !isSATA(q))
  if (filter.scope === "module" && filter.value) {
    const f = base.filter(q => q.module === filter.value)
    if (f.length >= 3) base = f
  } else if (filter.scope === "subject" && filter.value) {
    const f = base.filter(q => q.subject === filter.value)
    if (f.length >= 3) base = f
  }
  return shuffle(base)
}

function countFilter(allQ: Question[], filter: GameFilter): number {
  let base = allQ.filter(q => !isSATA(q) && (!q.moduleStatus || q.moduleStatus === "live"))
  if (base.length < 5) base = allQ.filter(q => !isSATA(q))
  if (filter.scope === "module" && filter.value) return base.filter(q => q.module === filter.value).length
  if (filter.scope === "subject" && filter.value) return base.filter(q => q.subject === filter.value).length
  return base.length
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiCreateRoom(
  mode: MultiMode,
  hostId: string,
  hostName: string,
  pool: Question[],
  cosmetics?: { equippedTitle?: string | null; equippedFrame?: string | null; equippedHighlight?: string | null }
): Promise<string> {
  const res = await fetch("/api/game-rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, hostId, hostName, questionPool: pool, ...cosmetics }),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return data.pin as string
}

async function apiPollRoom(pin: string, myId: string): Promise<RoomState | null> {
  const res = await fetch(`/api/game-rooms/${pin}?playerId=${encodeURIComponent(myId)}`)
  if (!res.ok) return null
  return res.json()
}

async function apiAction(pin: string, payload: Record<string, unknown>): Promise<RoomState | null> {
  const res = await fetch(`/api/game-rooms/${pin}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => "")
    console.warn("[game-room action error]", res.status, msg)
    return null
  }
  return res.json()
}

async function apiDeleteRoom(pin: string, requesterId: string) {
  await fetch(`/api/game-rooms/${pin}?requesterId=${encodeURIComponent(requesterId)}`, { method: "DELETE" })
}

// ── Shared small components ───────────────────────────────────────────────────
function CopyPinCard({ pin }: { pin: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(pin).catch(() => {})
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="rounded-3xl border-2 border-dashed border-primary/30 bg-primary/5 p-5 text-center">
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">Room PIN</p>
      <p className="mb-3 font-mono text-5xl font-extrabold tracking-[0.2em] text-foreground">{pin}</p>
      <button type="button" onClick={copy}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted">
        {copied ? "✓ Copied!" : "Copy PIN"}
      </button>
    </div>
  )
}

function PlayerRow({ player, rank, showScore }: { player: RoomPlayer; rank?: number; showScore?: boolean }) {
  const frameClass  = player.equippedFrame     ? (FRAME_RING_CLASSES[player.equippedFrame]         ?? "") : ""
  const rowClass    = player.equippedHighlight ? (HIGHLIGHT_ROW_CLASSES[player.equippedHighlight]  ?? "") : ""
  const titleLabel  = player.equippedTitle     ? (TITLE_LABELS[player.equippedTitle]               ?? null) : null
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-all ${rowClass || "border-border bg-card"}`}>
      {rank !== undefined && (
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${frameClass}
          ${rank === 1 ? "bg-amber-400 text-white" : rank === 2 ? "bg-slate-400 text-white" : rank === 3 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>
          {rank}
        </span>
      )}
      {!rank && player.isHost && (
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs ${frameClass}`}>👑</span>
      )}
      {!rank && !player.isHost && (
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs ${frameClass}`}>👤</span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{player.name}</span>
      {titleLabel && (
        <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
          {titleLabel}
        </span>
      )}
      {showScore && <span className="tabular-nums text-sm font-bold text-primary">{player.score.toLocaleString()}</span>}
      {player.isHost && !rank && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Host</span>}
    </div>
  )
}

// ── Option button ─────────────────────────────────────────────────────────────
const OPTION_COLORS = ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500"]
const OPTION_ICONS = ["▲", "◆", "●", "★"]

function MultiOptionBtn({ id, text, sel, correct, revealed, onSel, disabled, colorIndex }: {
  id: string; text: string; sel: boolean; correct: boolean; revealed: boolean
  onSel: () => void; disabled: boolean; colorIndex: number
}) {
  let cls = "w-full rounded-2xl border-2 px-4 py-3.5 text-left text-sm font-medium transition-all duration-200 "
  if (!revealed) {
    cls += sel ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/5 active:scale-[0.98]"
  } else if (correct) {
    cls += "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
  } else if (sel) {
    cls += "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
  } else {
    cls += "border-border bg-card text-muted-foreground/50"
  }

  return (
    <button type="button" disabled={disabled || revealed} onClick={onSel} className={cls}>
      <span className="inline-flex items-center gap-3">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${OPTION_COLORS[colorIndex]}`}>
          {OPTION_ICONS[colorIndex]}
        </span>
        <span className="flex-1">{id}. {text}</span>
        {revealed && correct && <span className="text-emerald-500">✓</span>}
        {revealed && sel && !correct && <span className="text-rose-500">✗</span>}
      </span>
    </button>
  )
}

// Big buzzer squares for Cohort player view
function BuzzerSquares({ options, onAnswer, answered, revealed }: {
  options: { id: string; text: string }[]
  onAnswer: (id: string, text: string) => void
  answered: string | null
  revealed: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 p-3">
      {options.slice(0, 4).map((opt, i) => (
        <button
          key={opt.id} type="button"
          disabled={answered !== null || revealed}
          onClick={() => onAnswer(opt.id, opt.text)}
          className={`relative flex h-32 flex-col items-center justify-center gap-2 rounded-3xl text-white text-xl font-extrabold shadow-lg transition-all active:scale-95
            ${OPTION_COLORS[i]}
            ${answered === opt.id ? "ring-4 ring-white ring-offset-2 scale-95" : ""}
            ${answered !== null && answered !== opt.id ? "opacity-50" : ""}
            ${revealed ? "opacity-60 cursor-not-allowed" : "hover:brightness-110"}`}
        >
          <span className="text-3xl">{OPTION_ICONS[i]}</span>
          <span>{opt.id}</span>
        </button>
      ))}
    </div>
  )
}

// Leaderboard bar chart
function Leaderboard({ players, highlight, knockoutWinnerId }: {
  players: RoomPlayer[]
  highlight?: string
  knockoutWinnerId?: string | null
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const maxScore = Math.max(...sorted.map(p => p.score), 1)
  return (
    <div className="grid gap-2">
      {sorted.map((p, i) => {
        const pct        = Math.max((p.score / maxScore) * 100, 2)
        const isMe       = p.id === highlight
        const isBankrupt = !!p.isSpectator && p.score === 0
        const isWinner   = knockoutWinnerId && p.id === knockoutWinnerId
        const frameClass = p.equippedFrame     ? (FRAME_RING_CLASSES[p.equippedFrame]         ?? "") : ""
        const rowClass   = p.equippedHighlight ? (HIGHLIGHT_ROW_CLASSES[p.equippedHighlight]  ?? "") : ""
        const titleLabel = p.equippedTitle     ? (TITLE_LABELS[p.equippedTitle]               ?? null) : null
        // Priority: knockout winner > "You" > bankrupt > cosmetic
        const rowStyle = isWinner
          ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30"
          : isMe
          ? "border-primary bg-primary/5"
          : isBankrupt
          ? "border-rose-200 dark:border-rose-800/30 bg-rose-50/50 dark:bg-rose-950/10 opacity-70"
          : (rowClass || "border-border bg-card")
        return (
          <div key={p.id} className={`rounded-2xl border p-3 transition-all ${rowStyle}`}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${frameClass}
                ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{p.name}{isMe ? " (You)" : ""}</span>
              {isWinner && knockoutWinnerId && (
                <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-extrabold text-white">
                  👑 SURVIVOR
                </span>
              )}
              {isBankrupt && !isWinner && (
                <span className="shrink-0 rounded-full bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 text-[9px] font-extrabold text-rose-600 dark:text-rose-400">
                  💸 Bankrupt
                </span>
              )}
              {titleLabel && !isWinner && !isBankrupt && (
                <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300">
                  {titleLabel}
                </span>
              )}
              <span className="tabular-nums text-sm font-bold text-foreground">{p.score.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full transition-all duration-700 ${isBankrupt ? "bg-rose-400" : i === 0 ? "bg-amber-400" : "bg-primary"}`}
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Progress / answer count indicator
function AnswerProgress({ players, total }: { players: RoomPlayer[]; total: number }) {
  const answered = players.filter(p => p.answer !== null).length
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
      <div className="flex gap-1">
        {players.map(p => (
          <div key={p.id} className={`h-2.5 w-2.5 rounded-full ${p.answer !== null ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
        ))}
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{answered}/{total} answered</span>
    </div>
  )
}

// ── Filter Picker (reused from game-mode) ─────────────────────────────────────
function FilterPicker({ allQ, filter, onChange }: { allQ: Question[]; filter: GameFilter; onChange: (f: GameFilter) => void }) {
  const [tab, setTab] = useState<FilterScope>(filter.scope === "all" ? "all" : filter.scope)
  const modules = [...new Set(allQ.map(q => q.module).filter(Boolean) as string[])].sort()
  const subjects = [...new Set(allQ.map(q => q.subject).filter(Boolean) as string[])].sort()
  const count = countFilter(allQ, filter)
  const hasFilter = filter.scope !== "all" && filter.value !== null

  function selectTab(t: FilterScope) { setTab(t); if (t === "all") onChange(DEFAULT_FILTER) }
  function pick(scope: FilterScope, value: string) {
    if (filter.scope === scope && filter.value === value) { onChange(DEFAULT_FILTER); setTab("all") }
    else onChange({ scope, value })
  }

  return (
    <div className="mb-4 rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Question Scope</p>
        {hasFilter && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{count} questions</span>}
      </div>
      <div className="mb-3 flex gap-1 rounded-2xl bg-muted p-1">
        {(["all", "module", "subject"] as FilterScope[]).map(t => (
          <button key={t} type="button" onClick={() => selectTab(t)}
            className={`flex-1 rounded-xl py-1.5 text-xs font-semibold capitalize transition-all ${tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "all" ? "All" : t === "module" ? "Module" : "Discipline"}
          </button>
        ))}
      </div>
      {tab === "module" && (
        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          {modules.map(m => (
            <button key={m} type="button" onClick={() => pick("module", m)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${filter.scope === "module" && filter.value === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {m}
            </button>
          ))}
        </div>
      )}
      {tab === "subject" && (
        <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
          {subjects.map(s => (
            <button key={s} type="button" onClick={() => pick("subject", s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${filter.scope === "subject" && filter.value === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      )}
      {tab === "all" && <p className="text-center text-xs text-muted-foreground py-1">All {countFilter(allQ, DEFAULT_FILTER)} available questions</p>}
      {hasFilter && (
        <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-primary/8 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-primary">{filter.value}</span>
          <button type="button" onClick={() => { onChange(DEFAULT_FILTER); setTab("all") }} className="text-[11px] text-muted-foreground hover:text-foreground shrink-0">✕ Clear</button>
        </div>
      )}
    </div>
  )
}

// ── Q-count picker ────────────────────────────────────────────────────────────
const Q_COUNTS = [5, 10, 15, 20, 25]

function QCountPicker({ value, onChange, max }: { value: number; onChange: (n: number) => void; max: number }) {
  return (
    <div className="mb-4 rounded-3xl border border-border bg-card p-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Questions per Match</p>
      <div className="flex flex-wrap gap-2">
        {Q_COUNTS.filter(n => n <= Math.max(max, 5)).map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${value === n ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── NAME INPUT ────────────────────────────────────────────────────────────────
function NameInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} maxLength={24}
      className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground outline-none ring-2 ring-transparent focus:ring-primary/30 transition-all"
    />
  )
}

// ── ERROR banner ──────────────────────────────────────────────────────────────
function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5 text-sm font-medium text-rose-700 dark:text-rose-400">
      ⚠️ {msg}
    </div>
  )
}

// ── QUESTION TIMER ────────────────────────────────────────────────────────────
// Live countdown badge shown in every in-room HUD bar during the question phase.
// Turns amber at ≤10 s, then red and pulsing when pressure mode activates
// (server has shortened the deadline to 5 s because N-1 players have answered).
function QuestionTimer({ timeLeftMs, isPressure }: { timeLeftMs: number | null; isPressure: boolean }) {
  if (timeLeftMs === null) return null
  const secs = Math.ceil(timeLeftMs / 1000)
  const cls = isPressure
    ? "text-rose-500 animate-pulse"
    : secs <= 5
      ? "text-rose-400"
      : secs <= 10
        ? "text-amber-500"
        : "text-foreground"
  return (
    <span className={`tabular-nums text-sm font-extrabold transition-colors ${cls}`}>
      ⏱ {secs}s
    </span>
  )
}

// ── LOBBY (shared between host and players after joining) ─────────────────────
function RoomLobby({ room, myId, isHost, onStart, onExit }: {
  room: RoomState; myId: string; isHost: boolean; onStart: () => void; onExit: () => void
}) {
  const modeLabel = room.mode === "clash" ? "Multiplayer Clash"
    : room.mode === "cohort" ? "Cohort Review"
    : room.mode === "djmulti" ? "Double Jeopardy"
    : "Wager Wars"
  const modeIcon = room.mode === "clash" ? "⚔️" : room.mode === "cohort" ? "🎓" : room.mode === "djmulti" ? "🎲" : "🎰"
  const capacityLabel = room.mode === "clash" || room.mode === "djmulti" ? "/5" : room.mode === "wager" ? "/8" : ""
  const modeDesc = room.mode === "clash" ? "Max 5 players · Fastest answer wins"
    : room.mode === "cohort" ? "Unlimited players · Host controls pace"
    : room.mode === "djmulti" ? "Max 5 players · Wager your confidence"
    : "Max 8 players · Bet chips on every question"

  return (
    <div className="flex min-h-full flex-col p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mb-3 text-4xl">{modeIcon}</div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">{modeLabel}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{modeDesc}</p>
        </div>

        <CopyPinCard pin={room.pin} />

        <div className="my-4 rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Players</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {room.players.length}{capacityLabel}
            </span>
          </div>
          <div className="grid gap-2">
            {room.players.map(p => <PlayerRow key={p.id} player={p} />)}
          </div>
          {room.players.length < 2 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">Waiting for players to join…</p>
          )}
        </div>

        <div className="mb-4 rounded-3xl border border-border bg-card p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Match</p>
          <p className="text-sm font-semibold text-foreground">{room.questionPool.length} questions</p>
        </div>

        {isHost ? (
          <button type="button" onClick={onStart} disabled={room.players.length < 1}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50">
            Start Match
          </button>
        ) : (
          <div className="rounded-2xl border border-border bg-muted/50 py-4 text-center text-sm font-semibold text-muted-foreground">
            ⏳ Waiting for host to start…
          </div>
        )}

        <button type="button" onClick={onExit} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Leave Room
        </button>
      </div>
    </div>
  )
}

// ── QUESTION HUD (Clash host + players, and Cohort host) ─────────────────────
function QuestionHUD({ room, myId, isHost, onAnswer, onAdvance, onFinish, onLeave, myLastAnswerCorrect, timeLeftMs, isPressure }: {
  room: RoomState; myId: string; isHost: boolean
  onAnswer: (answer: string, answerText: string) => void
  onAdvance: () => void
  onFinish: () => void
  onLeave: () => void
  myLastAnswerCorrect: boolean | null
  timeLeftMs: number | null
  isPressure: boolean
}) {
  const q = room.questionPool[room.currentQi]
  if (!q) return null

  const me = room.players.find(p => p.id === myId)
  const myAnswer = me?.answer ?? null
  const revealed = room.phase === "reveal"
  const allAnswered = room.players.length > 0 && room.players.every(p => p.answer !== null)

  // ── Error feedback ──────────────────────────────────────────────────────────
  const { triggerError, isShaking, isFlashing } = useErrorFeedback()
  const prevQiRef = useRef(room.currentQi)
  const prevAnswerCorrectRef = useRef<boolean | null>(null)
  useEffect(() => {
    const qiChanged = room.currentQi !== prevQiRef.current
    if (qiChanged) { prevQiRef.current = room.currentQi; prevAnswerCorrectRef.current = null; return }
    if (myLastAnswerCorrect === false && prevAnswerCorrectRef.current === null) triggerError()
    prevAnswerCorrectRef.current = myLastAnswerCorrect
  }, [room.currentQi, myLastAnswerCorrect]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 sm:gap-4 sm:p-5 max-w-2xl mx-auto">
      {/* HUD bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
        <span className="text-xs font-bold text-muted-foreground">Q {room.currentQi + 1}/{room.questionPool.length}</span>
        <div className="flex-1" />
        {me && <span className="tabular-nums text-sm font-extrabold text-foreground">{me.score.toLocaleString()} pts</span>}
        {me && me.streak >= 3 && <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">🔥 {me.streak}×</span>}
        <AnswerProgress players={room.players} total={room.players.length} />
        {room.phase === "question" && <QuestionTimer timeLeftMs={timeLeftMs} isPressure={isPressure} />}
        <button type="button" onClick={onLeave}
          className="flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 transition-all hover:opacity-80 active:scale-95">
          ✕ Leave
        </button>
      </div>

      {/* Reveal / leaderboard phase */}
      {revealed && (
        <div className="rounded-3xl border border-border bg-card p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leaderboard</p>
          <Leaderboard players={room.players} highlight={myId} />
          {isHost && (
            <div className="mt-4 flex gap-2">
              {room.currentQi + 1 < room.questionPool.length ? (
                <button type="button" onClick={onAdvance}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow transition-all hover:opacity-90">
                  Next Question →
                </button>
              ) : (
                <button type="button" onClick={onFinish}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-white shadow transition-all hover:opacity-90">
                  See Final Results
                </button>
              )}
            </div>
          )}
          {!isHost && <p className="mt-3 text-center text-xs text-muted-foreground">⏳ Waiting for host to advance…</p>}
        </div>
      )}

      {/* Question card */}
      {!revealed && (
        <>
          <div className={`relative flex-1 overflow-y-auto rounded-3xl border border-border bg-card p-5 ${isShaking ? "animate-error-shake" : ""}`}>
            {isFlashing && <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-rose-500/[0.13] backdrop-blur-[6px]" />}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{q.subject}</span>
              {q.module && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{q.module}</span>}
            </div>
            <RichText content={q.vignette} className="text-sm text-foreground sm:text-base" />
          </div>

          <div className="grid gap-2">
            {q.options.map((opt, i) => (
              <MultiOptionBtn
                key={opt.id} id={opt.id} text={opt.text}
                sel={myAnswer === opt.id}
                correct={opt.id === q.correctAnswer}
                revealed={revealed}
                colorIndex={i}
                disabled={myAnswer !== null}
                onSel={() => onAnswer(opt.id, opt.text)}
              />
            ))}
          </div>

          {myAnswer !== null && myLastAnswerCorrect !== null && (
            <p className="text-center text-xs font-semibold text-muted-foreground">
              {myLastAnswerCorrect ? "✅ Correct! Waiting for others…" : "❌ Wrong. Waiting for others…"}
            </p>
          )}
          {myAnswer !== null && myLastAnswerCorrect === null && (
            <p className="text-center text-xs font-semibold text-muted-foreground">⏳ Submitted! Waiting for others…</p>
          )}

          {isHost && allAnswered && (
            <button type="button" onClick={onAdvance}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90">
              Reveal Answers →
            </button>
          )}
          {isHost && !allAnswered && (
            <button type="button" onClick={onAdvance}
              className="w-full rounded-2xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Reveal Early ({room.players.filter(p => p.answer !== null).length}/{room.players.length} answered)
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── COHORT HOST VIEW ──────────────────────────────────────────────────────────
function CohortHostHUD({ room, onAdvance, onFinish, onLeave, timeLeftMs, isPressure }: {
  room: RoomState; onAdvance: () => void; onFinish: () => void; onLeave: () => void
  timeLeftMs: number | null; isPressure: boolean
}) {
  const q = room.questionPool[room.currentQi]
  if (!q) return null
  const revealed = room.phase === "reveal"
  const totalPlayers = room.players.length
  const answered = room.players.filter(p => p.answer !== null).length
  // Sort locally so we can show up to top 10 without changing the server payload
  const top10 = [...room.players].sort((a, b) => b.score - a.score).slice(0, 10)

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5">
        <span className="text-sm font-bold text-foreground">Q {room.currentQi + 1}/{room.questionPool.length}</span>
        <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${((room.currentQi + 1) / room.questionPool.length) * 100}%` }} />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{answered}/{totalPlayers} answered</span>
        {room.phase === "question" && <QuestionTimer timeLeftMs={timeLeftMs} isPressure={isPressure} />}
        <button type="button" onClick={onLeave}
          className="flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 transition-all hover:opacity-80 active:scale-95">
          ✕ Leave Match
        </button>
      </div>

      {/* Main content */}
      {revealed ? (
        <div className="flex-1 rounded-3xl border border-border bg-card p-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top 10 Leaderboard</p>
          <Leaderboard players={top10} />
          <div className="mt-5 flex gap-2">
            {room.currentQi + 1 < room.questionPool.length ? (
              <button type="button" onClick={onAdvance}
                className="flex-1 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
                Next Question →
              </button>
            ) : (
              <button type="button" onClick={onFinish}
                className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
                End & Show Results
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Split-screen: vignette on left + live Top 10 on right */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3 rounded-3xl border-2 border-primary/20 bg-card p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{q.subject}</span>
              </div>
              <RichText content={q.vignette} className="text-lg font-medium text-foreground sm:text-xl" />
              <div className="mt-5 grid grid-cols-2 gap-3">
                {q.options.map((opt, i) => (
                  <div key={opt.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-white font-bold ${OPTION_COLORS[i]}`}>
                    <span className="text-xl">{OPTION_ICONS[i]}</span>
                    <span className="text-sm">{opt.id}. {opt.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">🔴 Live Top 10</p>
              <Leaderboard players={top10} />
            </div>
          </div>
          {/* Answer tick counter + host reveal button */}
          <div className="flex gap-2">
            <div className="flex-1 rounded-2xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-foreground">{answered}</p>
              <p className="text-xs text-muted-foreground">Answered</p>
            </div>
            <div className="flex-1 rounded-2xl border border-border bg-card p-3 text-center">
              <p className="text-2xl font-extrabold tabular-nums text-foreground">{totalPlayers - answered}</p>
              <p className="text-xs text-muted-foreground">Waiting</p>
            </div>
            <button type="button" onClick={onAdvance}
              className="flex-1 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-bold text-white shadow transition-all hover:opacity-90">
              Reveal →
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── COHORT PLAYER VIEW ────────────────────────────────────────────────────────
function CohortPlayerHUD({ room, myId, onAnswer, onLeave, timeLeftMs, isPressure }: {
  room: RoomState; myId: string; onAnswer: (answer: string, answerText: string) => void; onLeave: () => void
  timeLeftMs: number | null; isPressure: boolean
}) {
  const q = room.questionPool[room.currentQi]
  const me = room.players.find(p => p.id === myId)
  const myAnswer = me?.answer ?? null
  const myRank = room.ranks[myId]
  const revealed = room.phase === "reveal"

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 max-w-sm mx-auto">
      {/* Personal stats */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Your Score</p>
          <p className="text-xl font-extrabold tabular-nums text-foreground">{me?.score.toLocaleString() ?? 0}</p>
        </div>
        {myRank && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Your Rank</p>
            <p className="text-xl font-extrabold tabular-nums text-foreground">#{myRank}</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Q</p>
          <p className="text-xl font-extrabold tabular-nums text-foreground">{room.currentQi + 1}/{room.questionPool.length}</p>
        </div>
        {room.phase === "question" && <QuestionTimer timeLeftMs={timeLeftMs} isPressure={isPressure} />}
        <button type="button" onClick={onLeave}
          className="flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 transition-all hover:opacity-80 active:scale-95 shrink-0">
          ✕ Leave
        </button>
      </div>

      {revealed ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-center">
            {myAnswer === q?.correctAnswer ? (
              <>
                <div className="text-5xl mb-2">✅</div>
                <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">Correct!</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-2">❌</div>
                <p className="text-xl font-extrabold text-rose-500">Wrong</p>
                <p className="text-sm text-muted-foreground mt-1">Correct: <strong>{q?.correctAnswer}</strong></p>
              </>
            )}
          </div>
          {myRank && (
            <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 px-6 py-4 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">You are in</p>
              <p className="text-4xl font-extrabold text-foreground">#{myRank}</p>
              <p className="text-xs text-muted-foreground mt-1">place</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground animate-pulse">⏳ Waiting for next question…</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-sm font-bold text-foreground">Look at the host screen and tap your answer!</p>
            <p className="text-xs text-muted-foreground mt-1">Q {room.currentQi + 1} of {room.questionPool.length}</p>
          </div>

          {q && (
            <BuzzerSquares
              options={q.options}
              onAnswer={onAnswer}
              answered={myAnswer}
              revealed={revealed}
            />
          )}

          {myAnswer !== null && (
            <div className="rounded-2xl border border-border bg-muted/50 py-3 text-center text-sm font-semibold text-muted-foreground">
              ✓ Submitted! Waiting for reveal…
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── FINAL RESULTS ─────────────────────────────────────────────────────────────
function FinalResults({ room, myId, onExit, answerHistory }: {
  room: RoomState; myId: string; onExit: () => void
  answerHistory?: MultiAnswerEntry[]
}) {
  const [reviewOpen, setReviewOpen] = useState(false)
  // In cohort mode the host is a presenter — exclude them from all results/rankings
  const resultPlayers = room.mode === "cohort"
    ? room.players.filter(p => !p.isHost)
    : room.players
  const sorted = [...resultPlayers].sort((a, b) => b.score - a.score)
  const me = sorted.find(p => p.id === myId)
  const myRank = sorted.findIndex(p => p.id === myId) + 1
  const modeLabel = room.mode === "clash" ? "Multiplayer Clash"
    : room.mode === "cohort" ? "Cohort Review"
    : room.mode === "djmulti" ? "Double Jeopardy"
    : "Wager Wars"
  const isWagerLike = room.mode === "wager" || room.mode === "djmulti"
  const knockoutWinnerId = room.knockoutWinnerId ?? null
  const isKnockout = isWagerLike && !!knockoutWinnerId
  const iAmWinner = isKnockout && knockoutWinnerId === myId
  const podiumEmoji = isKnockout && iAmWinner ? "💀" : myRank === 1 ? "🏆" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🎯"
  const history = answerHistory ?? []

  return (
    <>
      {/* ── Review Vignettes Drawer ── */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setReviewOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="relative ml-auto flex h-full w-full max-w-2xl flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg shadow-md">📖</div>
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Vignette Review</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {history.filter(e => e.selected === (room.questionPool.find(q => q.id === e.question.id)?.correctAnswer ?? e.question.correctAnswer)).length}/{history.length} correct
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setReviewOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {history.map((entry, i) => {
                // correctAnswer is hidden during the question phase when the history
                // entry is snapshotted. Resolve it from the final room state instead,
                // which always has correctAnswers populated (phase === "done").
                const resolvedCorrectAnswer =
                  room.questionPool.find(q => q.id === entry.question.id)?.correctAnswer
                  ?? entry.question.correctAnswer
                const isCorrect = entry.selected === resolvedCorrectAnswer
                const expl = entry.question.explanation
                return (
                  <div key={i} className={`rounded-3xl border bg-card p-4 ${isCorrect ? "border-emerald-200 dark:border-emerald-800/40" : "border-rose-200 dark:border-rose-800/40"}`}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${isCorrect ? "bg-emerald-500" : "bg-rose-500"}`}>{i + 1}</span>
                      <span className={`text-[11px] font-extrabold ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{isCorrect ? "Correct" : "Incorrect"}</span>
                      <span className="text-[11px] font-bold text-primary ml-1">{entry.question.subject}</span>
                      {entry.question.module && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{entry.question.module}</span>}
                    </div>
                    <div className="mb-3 rounded-2xl bg-muted/40 p-3">
                      <RichText content={entry.question.vignette} className="text-xs text-foreground" />
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {entry.question.options.map(opt => {
                        const isOpt = opt.id === resolvedCorrectAnswer
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
                    {expl && (
                      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/30 p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">📋 Explanation</p>
                        {expl.objective && <p className="text-xs font-semibold text-foreground leading-relaxed">{expl.objective}</p>}
                        {expl.details && <p className="text-xs text-muted-foreground leading-relaxed">{expl.details}</p>}
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

      <div className="flex min-h-full flex-col p-4 sm:p-6">
        <div className="mx-auto w-full max-w-md">

          {/* ── Knockout banner ── */}
          {isKnockout && (
            <div className={`mb-5 rounded-3xl p-5 text-center ${
              iAmWinner
                ? "bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-amber-500/30"
                : "bg-gradient-to-br from-rose-500 to-rose-700 shadow-lg shadow-rose-500/20"
            }`}>
              <p className="text-4xl mb-1">{iAmWinner ? "💀" : "☠️"}</p>
              <h2 className="text-2xl font-extrabold tracking-tight text-white leading-tight">
                {iAmWinner ? "LAST MEDIC STANDING" : "KNOCKOUT!"}
              </h2>
              <p className="mt-1 text-sm font-semibold text-white/80">
                {iAmWinner
                  ? "All opponents went bankrupt — you are the sole survivor."
                  : `${room.players.find(p => p.id === knockoutWinnerId)?.name ?? "One player"} outlasted everyone.`}
              </p>
            </div>
          )}

          <div className="mb-6 text-center">
            <div className="text-5xl mb-3">{isKnockout ? "" : podiumEmoji}</div>
            {!isKnockout && <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Match Over!</h1>}
            <p className="text-sm text-muted-foreground mt-1">{modeLabel}</p>
          </div>

          {me && (
            <div className="mb-5 rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                {isWagerLike ? (room.mode === "djmulti" ? "Final Bank" : "Final Balance") : "Your Final Score"}
              </p>
              <p className="text-5xl font-extrabold tabular-nums text-foreground">
                {me.score.toLocaleString()}{isWagerLike ? (room.mode === "djmulti" ? " 🏦" : " 🪙") : ""}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">Rank #{myRank} of {sorted.length}</p>
            </div>
          )}

          <div className="mb-5 rounded-3xl border border-border bg-card p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Final Leaderboard</p>
            <Leaderboard players={sorted} highlight={myId} knockoutWinnerId={knockoutWinnerId} />
          </div>

          {history.length > 0 && (
            <button type="button" onClick={() => setReviewOpen(true)}
              className="mb-3 w-full rounded-2xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
              📖 Review Vignettes ({history.length})
            </button>
          )}

          <button type="button" onClick={onExit}
            className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90">
            Back to Game Mode
          </button>
        </div>
      </div>
    </>
  )
}

// ── JOIN ROOM SCREEN ──────────────────────────────────────────────────────────
function JoinScreen({ onJoined, onBack }: {
  onJoined: (pin: string, playerId: string) => void
  onBack: () => void
}) {
  const { equippedCosmetics } = useEconomy()
  const [pin, setPin] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function join() {
    if (!pin.trim() || !name.trim()) { setError("Please enter both the PIN and your name."); return }
    setLoading(true); setError("")
    try {
      const pid = getOrCreatePlayerId()
      const res = await apiAction(pin.trim(), {
        action: "join",
        playerId: pid,
        playerName: name.trim(),
        equippedTitle:     equippedCosmetics.title,
        equippedFrame:     equippedCosmetics.frame,
        equippedHighlight: equippedCosmetics.highlight,
      })
      if (!res) { setError("Room not found or already started."); setLoading(false); return }
      onJoined(pin.trim(), pid)
    } catch {
      setError("Failed to join room. Check the PIN and try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col p-4 sm:p-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-3 text-4xl">🎮</div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">Join a Room</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the room PIN from your host</p>
        </div>

        <div className="grid gap-3 mb-4">
          <input
            type="text" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit PIN"
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest text-foreground outline-none ring-2 ring-transparent focus:ring-primary/30 transition-all"
          />
          <NameInput value={name} onChange={setName} placeholder="Your display name" />
        </div>

        {error && <div className="mb-3"><ErrorBanner msg={error} /></div>}

        <button type="button" onClick={join} disabled={loading}
          className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90 disabled:opacity-50">
          {loading ? "Joining…" : "Join Room"}
        </button>
        <button type="button" onClick={onBack} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Back
        </button>
      </div>
    </div>
  )
}

// ── CREATE ROOM SCREEN ────────────────────────────────────────────────────────
function CreateRoomScreen({ mode, onCreated, onBack }: {
  mode: MultiMode; onCreated: (pin: string, hostId: string) => void; onBack: () => void
}) {
  const { questions: allQ } = useQuestions()
  const { equippedCosmetics } = useEconomy()
  const [filter, setFilter] = useState<GameFilter>(DEFAULT_FILTER)
  const [qCount, setQCount] = useState(10)
  const [hostName, setHostName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const maxQ = Math.max(countFilter(allQ, filter), 5)
  const clampedCount = Math.min(qCount, maxQ)
  const modeLabel = mode === "clash" ? "Multiplayer Clash" : mode === "cohort" ? "Cohort Review" : mode === "djmulti" ? "Double Jeopardy" : "Wager Wars"
  const modeIcon = mode === "clash" ? "⚔️" : mode === "cohort" ? "🎓" : mode === "djmulti" ? "🎲" : "🎰"
  const modeGradient = mode === "clash" ? "from-violet-600 to-fuchsia-600" : mode === "cohort" ? "from-teal-500 to-cyan-500" : mode === "djmulti" ? "from-indigo-500 to-purple-600" : "from-amber-500 to-orange-500"

  async function create() {
    if (!hostName.trim()) { setError("Please enter your display name."); return }
    setLoading(true); setError("")
    try {
      const pool = filterQuestions(allQ, filter).slice(0, clampedCount)
      if (pool.length === 0) { setError("No questions found for the selected filter."); setLoading(false); return }
      const hostId = getOrCreatePlayerId()
      const pin = await apiCreateRoom(mode, hostId, hostName.trim(), pool, {
        equippedTitle:     equippedCosmetics.title,
        equippedFrame:     equippedCosmetics.frame,
        equippedHighlight: equippedCosmetics.highlight,
      })
      onCreated(pin, hostId)
    } catch {
      setError("Failed to create room. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mb-3 text-4xl">{modeIcon}</div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">{modeLabel}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {mode === "clash" ? "Competitive room · Max 5 players · Free Entry"
            : mode === "cohort" ? "Lecture hall mode · Unlimited players · Free Entry"
            : mode === "djmulti" ? "Confidence wagering · Max 5 players · Starting bank: 500 pts"
            : "Betting game · Max 8 players · Starting balance: 1,000 chips"}
          </p>
        </div>

        <div className="mb-4">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Name (Host)</p>
          <NameInput value={hostName} onChange={setHostName} placeholder="Your display name" />
        </div>

        <FilterPicker allQ={allQ} filter={filter} onChange={setFilter} />
        <QCountPicker value={clampedCount} onChange={setQCount} max={maxQ} />

        {error && <div className="mb-3"><ErrorBanner msg={error} /></div>}

        <button type="button" onClick={create} disabled={loading}
          className={`w-full rounded-2xl bg-gradient-to-r ${modeGradient} py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-50`}>
          {loading ? "Creating Room…" : "Create Room"}
        </button>
        <button type="button" onClick={onBack} className="mt-3 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          Back
        </button>
      </div>
    </div>
  )
}

// ── DJ MULTI WAGER PRESETS ────────────────────────────────────────────────────
// Percentage-of-bank bets for Double Jeopardy multiplayer (mirrors solo DJ)
const DJ_MULTI_BETS = [
  { label: "Safe",     pct: 0.10, icon: "🛡️", color: "from-emerald-500 to-teal-500",   shadow: "shadow-emerald-500/20" },
  { label: "Moderate", pct: 0.25, icon: "🎯", color: "from-blue-500 to-indigo-500",     shadow: "shadow-blue-500/20"    },
  { label: "Bold",     pct: 0.50, icon: "🔥", color: "from-amber-500 to-orange-500",    shadow: "shadow-amber-500/20"   },
  { label: "All In",   pct: 1.00, icon: "💎", color: "from-rose-500 to-fuchsia-600",    shadow: "shadow-rose-500/20"    },
]

// ── WAGER HUD ─────────────────────────────────────────────────────────────────
// Handles all three active wager-mode phases: wager → question → reveal
const WAGER_PRESETS = [50, 100, 500, 750]

function WagerHUD({ room, myId, isHost, onWager, onAnswer, onAdvance, onFinish, onLeave, myLastAnswerCorrect, timeLeftMs, isPressure }: {
  room: RoomState; myId: string; isHost: boolean
  onWager: (amount: number) => void
  onAnswer: (answer: string, answerText: string) => void
  onAdvance: () => void
  onFinish: () => void
  onLeave: () => void
  myLastAnswerCorrect: boolean | null
  timeLeftMs: number | null
  isPressure: boolean
}) {
  const q = room.questionPool[room.currentQi]
  if (!q) return null

  const me = room.players.find(p => p.id === myId)
  const myAnswer = me?.answer ?? null

  // ── Error feedback ──────────────────────────────────────────────────────────
  const { triggerError, isShaking, isFlashing } = useErrorFeedback()
  const prevQiRef = useRef(room.currentQi)
  const prevAnswerCorrectRef = useRef<boolean | null>(null)
  useEffect(() => {
    const qiChanged = room.currentQi !== prevQiRef.current
    if (qiChanged) { prevQiRef.current = room.currentQi; prevAnswerCorrectRef.current = null; return }
    if (myLastAnswerCorrect === false && prevAnswerCorrectRef.current === null) triggerError()
    prevAnswerCorrectRef.current = myLastAnswerCorrect
  }, [room.currentQi, myLastAnswerCorrect]) // eslint-disable-line react-hooks/exhaustive-deps
  const myWager = me?.wagerAmount ?? null
  const myBalance = me?.balance ?? 1000
  const isSpectator = me?.isSpectator ?? false
  const isWagerPhase = room.phase === "wager"
  const isQuestionPhase = room.phase === "question"
  const revealed = room.phase === "reveal"

  // During question phase, show tentative balance = balance minus locked wager
  // to convey "you've already committed these chips"
  const displayBalance = isQuestionPhase && myWager !== null ? myBalance - myWager : myBalance

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 sm:gap-4 sm:p-5 max-w-2xl mx-auto">
      {/* HUD bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
        <span className="text-xs font-bold text-muted-foreground">Q {room.currentQi + 1}/{room.questionPool.length}</span>
        <div className="flex-1" />
        {isWagerPhase && (
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">
            Wager Phase
          </span>
        )}
        {isSpectator && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
            👁 Spectator
          </span>
        )}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-amber-600 dark:text-amber-400">🪙</span>
          <span className="tabular-nums text-sm font-extrabold text-foreground">{displayBalance.toLocaleString()}</span>
          {revealed && myLastAnswerCorrect !== null && myWager !== null && (
            <span className={`text-xs font-bold ${myLastAnswerCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
              ({myLastAnswerCorrect ? `+${myWager}` : `-${myWager}`})
            </span>
          )}
        </div>
        {isQuestionPhase && <QuestionTimer timeLeftMs={timeLeftMs} isPressure={isPressure} />}
        <button type="button" onClick={onLeave}
          className="flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 transition-all hover:opacity-80 active:scale-95">
          ✕ Leave
        </button>
      </div>

      {/* Spectator banner */}
      {isSpectator && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800/30 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 text-center">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">👁 Spectator Mode</p>
          <p className="text-xs text-amber-600/80 dark:text-amber-500/80 mt-0.5">Balance hit 0 — you can still follow along.</p>
        </div>
      )}

      {/* Vignette — always visible; options hidden by server during wager phase */}
      <div className={`relative rounded-3xl border-2 bg-card p-5 ${isWagerPhase ? "border-amber-300/60 dark:border-amber-700/40" : "border-primary/20"} ${isShaking ? "animate-error-shake" : ""}`}>
        {isFlashing && <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-rose-500/[0.13] backdrop-blur-[6px]" />}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{q.subject}</span>
          {isWagerPhase && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Place your wager — options revealed after everyone bets
            </span>
          )}
        </div>
        <RichText content={q.vignette} className="text-sm font-medium text-foreground sm:text-base" />
      </div>

      {/* ── WAGER PHASE ── */}
      {isWagerPhase && !isSpectator && (
        myWager !== null ? (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-center">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">🔒 Wager locked — {myWager.toLocaleString()} chips</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">Waiting for all players to wager…</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">How much will you wager?</p>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Balance: <strong className="text-foreground">{myBalance.toLocaleString()} chips</strong>
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {WAGER_PRESETS.map(amt => {
                const canAfford = myBalance >= amt
                return (
                  <button key={amt} type="button" onClick={() => onWager(amt)} disabled={!canAfford}
                    className="rounded-2xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 py-3 text-sm font-extrabold text-amber-700 dark:text-amber-400 transition-all hover:bg-amber-100 dark:hover:bg-amber-900/40 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-50 dark:disabled:hover:bg-amber-950/30 disabled:active:scale-100">
                    {amt.toLocaleString()}
                  </button>
                )
              })}
              <button type="button" onClick={() => onWager(myBalance)} disabled={myBalance <= 0}
                className="col-span-3 sm:col-span-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:opacity-50 disabled:active:scale-100">
                🎰 All In
              </button>
            </div>
          </div>
        )
      )}

      {/* WAGER PHASE: spectator waiting message */}
      {isWagerPhase && isSpectator && (
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          ⏳ Waiting for active players to place their wagers…
        </div>
      )}

      {/* ── QUESTION PHASE: answer options ── */}
      {isQuestionPhase && (
        <>
          <div className="grid gap-2">
            {q.options.map((opt, i) => (
              <MultiOptionBtn
                key={opt.id} id={opt.id} text={opt.text}
                sel={myAnswer === opt.id}
                correct={opt.id === q.correctAnswer}
                revealed={false}
                colorIndex={i}
                disabled={myAnswer !== null || isSpectator}
                onSel={() => { if (!isSpectator) onAnswer(opt.id, opt.text) }}
              />
            ))}
          </div>
          {myAnswer !== null ? (
            myLastAnswerCorrect !== null ? (
              <p className="text-center text-xs font-semibold text-muted-foreground">
                {myLastAnswerCorrect ? "✅ Correct! Waiting for others…" : "❌ Wrong. Waiting for others…"}
              </p>
            ) : (
              <p className="text-center text-xs font-semibold text-muted-foreground">⏳ Submitted! Waiting for others…</p>
            )
          ) : isSpectator ? (
            <p className="text-center text-xs font-semibold text-muted-foreground">👁 Spectating — answer locked</p>
          ) : (
            myWager !== null && (
              <p className="text-center text-[11px] text-muted-foreground">
                Wagered: <strong className="text-amber-600 dark:text-amber-400">{myWager.toLocaleString()} chips</strong> · Pick your answer
              </p>
            )
          )}
        </>
      )}

      {/* ── REVEAL PHASE ── */}
      {revealed && (
        <>
          <div className="grid gap-2">
            {q.options.map((opt, i) => (
              <MultiOptionBtn
                key={opt.id} id={opt.id} text={opt.text}
                sel={myAnswer === opt.id}
                correct={opt.id === q.correctAnswer}
                revealed={true}
                colorIndex={i}
                disabled={true}
                onSel={() => {}}
              />
            ))}
          </div>

          <div className={`rounded-2xl border px-4 py-3 text-center ${
            isSpectator ? "border-border bg-muted/40"
            : myLastAnswerCorrect ? "border-emerald-200 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-950/20"
            : myAnswer !== null ? "border-rose-200 dark:border-rose-800/30 bg-rose-50 dark:bg-rose-950/20"
            : "border-border bg-muted/40"
          }`}>
            {isSpectator ? (
              <p className="text-sm font-semibold text-muted-foreground">👁 Spectating</p>
            ) : myLastAnswerCorrect && myWager !== null ? (
              <>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">✅ Correct! +{myWager.toLocaleString()} chips</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">New balance: {myBalance.toLocaleString()} chips</p>
              </>
            ) : myAnswer !== null && myWager !== null ? (
              <>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">❌ Wrong — {myWager.toLocaleString()} chips lost</p>
                {myBalance <= 0
                  ? <p className="text-xs text-rose-500/80 mt-0.5">Balance depleted — entering Spectator Mode next round</p>
                  : <p className="text-xs text-rose-500/80 mt-0.5">Remaining balance: {myBalance.toLocaleString()} chips</p>
                }
              </>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">⏱ No answer submitted — wager lost</p>
            )}
          </div>

          {isHost && (
            <div className="flex gap-2">
              {room.currentQi + 1 < room.questionPool.length ? (
                <button type="button" onClick={onAdvance}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
                  Next Round →
                </button>
              ) : (
                <button type="button" onClick={onFinish}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
                  End & Show Results
                </button>
              )}
            </div>
          )}
          {!isHost && (
            <p className="text-center text-xs text-muted-foreground animate-pulse">⏳ Waiting for host to advance…</p>
          )}
        </>
      )}
    </div>
  )
}

// ── DOUBLE JEOPARDY MULTIPLAYER HUD ──────────────────────────────────────────
// Handles the three active DJ-multi phases: wager → question → reveal
function DoubleJeopardyMultiHUD({ room, myId, isHost, onWager, onAnswer, onAdvance, onFinish, onLeave, myLastAnswerCorrect }: {
  room: RoomState; myId: string; isHost: boolean
  onWager: (amount: number) => void
  onAnswer: (answer: string, answerText: string) => void
  onAdvance: () => void
  onFinish: () => void
  onLeave: () => void
  myLastAnswerCorrect: boolean | null
}) {
  const q = room.questionPool[room.currentQi]
  if (!q) return null

  const me = room.players.find(p => p.id === myId)
  const myAnswer = me?.answer ?? null

  // ── Error feedback ──────────────────────────────────────────────────────────
  const { triggerError, isShaking, isFlashing } = useErrorFeedback()
  const prevQiRef = useRef(room.currentQi)
  const prevAnswerCorrectRef = useRef<boolean | null>(null)
  useEffect(() => {
    const qiChanged = room.currentQi !== prevQiRef.current
    if (qiChanged) { prevQiRef.current = room.currentQi; prevAnswerCorrectRef.current = null; return }
    if (myLastAnswerCorrect === false && prevAnswerCorrectRef.current === null) triggerError()
    prevAnswerCorrectRef.current = myLastAnswerCorrect
  }, [room.currentQi, myLastAnswerCorrect]) // eslint-disable-line react-hooks/exhaustive-deps
  const myWager = me?.wagerAmount ?? null
  const myBank = me?.balance ?? 500
  const isSpectator = me?.isSpectator ?? false
  const isWagerPhase = room.phase === "wager"
  const isQuestionPhase = room.phase === "question"
  const revealed = room.phase === "reveal"

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 sm:gap-4 sm:p-5 max-w-2xl mx-auto">
      {/* HUD bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
        <span className="text-xs font-bold text-muted-foreground">Q {room.currentQi + 1}/{room.questionPool.length}</span>
        <div className="flex-1" />
        {isWagerPhase && (
          <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
            Wager Phase
          </span>
        )}
        {isSpectator && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
            👁 Spectator
          </span>
        )}
        <div className="flex items-center gap-1">
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400">🏦</span>
          <span className="tabular-nums text-sm font-extrabold text-foreground">{myBank.toLocaleString()}</span>
          {revealed && myLastAnswerCorrect !== null && myWager !== null && (
            <span className={`text-xs font-bold ${myLastAnswerCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
              ({myLastAnswerCorrect ? `+${myWager}` : `-${myWager}`})
            </span>
          )}
        </div>
        <button type="button" onClick={onLeave}
          className="flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 transition-all hover:opacity-80 active:scale-95">
          ✕ Leave
        </button>
      </div>

      {isSpectator && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/30 bg-indigo-50 dark:bg-indigo-950/20 px-4 py-3 text-center">
          <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">👁 Spectator Mode</p>
          <p className="text-xs text-indigo-600/80 dark:text-indigo-500/80 mt-0.5">Bank depleted — you can still follow along.</p>
        </div>
      )}

      {/* Vignette card */}
      <div className={`relative rounded-3xl border-2 bg-card p-5 ${isWagerPhase ? "border-indigo-300/60 dark:border-indigo-700/40" : "border-primary/20"} ${isShaking ? "animate-error-shake" : ""}`}>
        {isFlashing && <div className="pointer-events-none absolute inset-0 z-10 rounded-3xl bg-rose-500/[0.13] backdrop-blur-[6px]" />}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{q.subject}</span>
          {isWagerPhase && (
            <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
              Place your wager — options revealed after everyone bets
            </span>
          )}
        </div>
        <RichText content={q.vignette} className="text-sm font-medium text-foreground sm:text-base" />
      </div>

      {/* ── WAGER PHASE ── */}
      {isWagerPhase && !isSpectator && (
        myWager !== null ? (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3 text-center">
            <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">🔒 Wager locked — {myWager.toLocaleString()} pts</p>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">Waiting for all players to wager…</p>
          </div>
        ) : (
          <div className="rounded-3xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/30 p-4">
            <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-400">
              🎲 Place Your Wager
            </p>
            <p className="mb-3 text-center text-[11px] text-muted-foreground">
              Bank: <strong className="text-foreground">{myBank.toLocaleString()} pts</strong>
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {DJ_MULTI_BETS.map(bet => {
                const amount = Math.max(10, Math.floor(myBank * bet.pct))
                return (
                  <button key={bet.label} type="button" onClick={() => onWager(amount)}
                    className={`flex flex-col items-center gap-1 rounded-2xl bg-gradient-to-br ${bet.color} px-4 py-3.5 text-white shadow-md ${bet.shadow} transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]`}>
                    <span className="text-xl">{bet.icon}</span>
                    <span className="text-sm font-extrabold">{bet.label}</span>
                    <span className="text-xs font-semibold opacity-90">+/− {amount.toLocaleString()} pts</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      )}

      {isWagerPhase && isSpectator && (
        <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-center text-sm text-muted-foreground">
          ⏳ Waiting for active players to place their wagers…
        </div>
      )}

      {/* ── QUESTION PHASE ── */}
      {isQuestionPhase && (
        <>
          <div className="grid gap-2">
            {q.options.map((opt, i) => (
              <MultiOptionBtn
                key={opt.id} id={opt.id} text={opt.text}
                sel={myAnswer === opt.id}
                correct={opt.id === q.correctAnswer}
                revealed={false}
                colorIndex={i}
                disabled={myAnswer !== null || isSpectator}
                onSel={() => { if (!isSpectator) onAnswer(opt.id, opt.text) }}
              />
            ))}
          </div>
          {myAnswer !== null ? (
            myLastAnswerCorrect !== null ? (
              <p className="text-center text-xs font-semibold text-muted-foreground">
                {myLastAnswerCorrect ? "✅ Correct! Waiting for others…" : "❌ Wrong. Waiting for others…"}
              </p>
            ) : (
              <p className="text-center text-xs font-semibold text-muted-foreground">⏳ Submitted! Waiting for others…</p>
            )
          ) : isSpectator ? (
            <p className="text-center text-xs font-semibold text-muted-foreground">👁 Spectating — answer locked</p>
          ) : (
            myWager !== null && (
              <p className="text-center text-[11px] text-muted-foreground">
                Wagered: <strong className="text-indigo-600 dark:text-indigo-400">{myWager.toLocaleString()} pts</strong> · Pick your answer
              </p>
            )
          )}
        </>
      )}

      {/* ── REVEAL PHASE ── */}
      {revealed && (
        <>
          <div className="grid gap-2">
            {q.options.map((opt, i) => (
              <MultiOptionBtn
                key={opt.id} id={opt.id} text={opt.text}
                sel={myAnswer === opt.id}
                correct={opt.id === q.correctAnswer}
                revealed={true}
                colorIndex={i}
                disabled={true}
                onSel={() => {}}
              />
            ))}
          </div>

          <div className={`rounded-2xl border px-4 py-3 text-center ${
            isSpectator ? "border-border bg-muted/40"
            : myLastAnswerCorrect ? "border-emerald-200 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-950/20"
            : myAnswer !== null ? "border-rose-200 dark:border-rose-800/30 bg-rose-50 dark:bg-rose-950/20"
            : "border-border bg-muted/40"
          }`}>
            {isSpectator ? (
              <p className="text-sm font-semibold text-muted-foreground">👁 Spectating</p>
            ) : myLastAnswerCorrect && myWager !== null ? (
              <>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">✅ Correct! +{myWager.toLocaleString()} pts</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-500/80 mt-0.5">New bank: {myBank.toLocaleString()} pts</p>
              </>
            ) : myAnswer !== null && myWager !== null ? (
              <>
                <p className="text-sm font-bold text-rose-600 dark:text-rose-400">❌ Wrong — {myWager.toLocaleString()} pts lost</p>
                {myBank <= 0
                  ? <p className="text-xs text-rose-500/80 mt-0.5">Bank depleted — entering Spectator Mode next round</p>
                  : <p className="text-xs text-rose-500/80 mt-0.5">Remaining bank: {myBank.toLocaleString()} pts</p>
                }
              </>
            ) : (
              <p className="text-sm font-semibold text-muted-foreground">⏱ No answer submitted — wager lost</p>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-4">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Leaderboard</p>
            <Leaderboard players={room.players} highlight={myId} />
          </div>

          {isHost && (
            <div className="flex gap-2">
              {room.currentQi + 1 < room.questionPool.length ? (
                <button type="button" onClick={onAdvance}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
                  Next Round →
                </button>
              ) : (
                <button type="button" onClick={onFinish}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
                  End & Show Results
                </button>
              )}
            </div>
          )}
          {!isHost && (
            <p className="text-center text-xs text-muted-foreground animate-pulse">⏳ Waiting for host to advance…</p>
          )}
        </>
      )}
    </div>
  )
}

// ── GAME ROOM CONTROLLER ──────────────────────────────────────────────────────
// Manages polling and action dispatch for an active room
function GameRoomController({ pin, myId, isHost, isCohortHost, mode, onExit }: {
  pin: string; myId: string; isHost: boolean; isCohortHost: boolean; mode: MultiMode; onExit: () => void
}) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [error, setError] = useState("")
  // Tracks whether the player's most recent answer was correct.
  // Derived from score delta (server response) because correctAnswer is hidden
  // from the client payload during the question phase to prevent cheating.
  const [myLastAnswerCorrect, setMyLastAnswerCorrect] = useState<boolean | null>(null)
  // Per-match answer history for the post-game Review Vignettes drawer
  const [answerHistory, setAnswerHistory] = useState<MultiAnswerEntry[]>([])
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  // Fast-poll interval fired after a player submits their answer while others
  // still haven't answered. Ticks at 300 ms so the reveal (which the server
  // writes atomically the instant the last answer arrives) is visible within
  // ~300 ms for every player — not up to 1.5 s later. Cleared as soon as the
  // room leaves the question phase, or when the component unmounts.
  const fastPollRef = useRef<NodeJS.Timeout | null>(null)
  const lastVersionRef = useRef<number>(-1)
  // Absolute timestamp when the current question rendered — used to compute
  // reactionTimeMs for the server-side speed bonus. Never trusted for
  // correctness; only used as a latency measurement input.
  const questionStartRef = useRef<number>(Date.now())
  const questionKeyRef = useRef<string>("")

  const poll = useCallback(async () => {
    const state = await apiPollRoom(pin, myId)
    if (state) {
      // Ignore stale poll responses that have an older version than what we have
      if (state.version >= lastVersionRef.current) {
        lastVersionRef.current = state.version
        setRoom(state)
        // Stop fast-polling the moment we leave the question phase — the reveal
        // (or next question) is now visible and we don't need the extra cadence.
        if (state.phase !== "question" && fastPollRef.current) {
          clearInterval(fastPollRef.current)
          fastPollRef.current = null
        }
      }
    } else {
      setError("Lost connection to room.")
    }
  }, [pin, myId])

  useEffect(() => {
    poll()
    pollRef.current = setInterval(poll, 1500)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (fastPollRef.current) clearInterval(fastPollRef.current)
    }
  }, [poll])

  // Reset the reaction-time clock the moment a new question appears.
  // Also reset the per-question correctness indicator so stale feedback
  // from the previous question is never shown on the new one.
  // Cache session to sessionStorage so a refresh can silently resume.
  useEffect(() => {
    if (!room) return
    const currentQuestionId = room.questionPool[room.currentQi]?.id ?? String(room.currentQi)
    // Key on currentQi only — wager mode starts a new round in "wager" phase,
    // normal modes start in "question" phase. Either way, a new qi = new round.
    const key = String(room.currentQi)
    const isNewRound = questionKeyRef.current !== key
    if ((room.phase === "question" || room.phase === "wager") && isNewRound) {
      questionStartRef.current = Date.now()
      questionKeyRef.current = key
      setMyLastAnswerCorrect(null) // fresh round — clear previous result
    }

    if (room.phase !== "done") {
      saveActiveRoomSession({ pin, myId, mode, isHost, isCohortHost, questionId: currentQuestionId })
    } else {
      clearActiveRoomSession()
    }
  }, [room, pin, myId, mode, isHost, isCohortHost])

  // ── Countdown timer ───────────────────────────────────────────────────────
  // Ticks every 100 ms using the server-supplied phaseDeadlineMs as the source
  // of truth. Only re-initialised when the deadline or phase actually changes,
  // so normal 1.5 s poll ticks (where the deadline is stable) don't reset it.
  useEffect(() => {
    if (!room || room.phase !== "question" || !room.phaseDeadlineMs) {
      setTimeLeftMs(null)
      return
    }
    const deadline = room.phaseDeadlineMs
    function tick() { setTimeLeftMs(Math.max(0, deadline - Date.now())) }
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [room?.phase, room?.phaseDeadlineMs])

  // ── Pressure-mode flag ────────────────────────────────────────────────────
  // True when exactly one active player hasn't answered yet and ≤5 s remain.
  // The server back-dates phase_started_at the moment the N-1th answer arrives,
  // so the next poll already carries a reduced phaseDeadlineMs. This is purely
  // a display flag — no client-side timer overrides scoring or phase logic.
  const activePl = room
    ? room.players.filter(p =>
        p.status !== "disconnected" &&
        !p.isSpectator &&
        // In cohort mode the host is a presenter — exclude from answer-tracking
        !(room.mode === "cohort" && p.isHost)
      )
    : []
  const answeredActivePl = activePl.filter(p => p.answer !== null).length
  const isPressure = timeLeftMs !== null
    && timeLeftMs <= 5000
    && activePl.length > 1
    && answeredActivePl === activePl.length - 1

  async function doAction(payload: Record<string, unknown>) {
    const updated = await apiAction(pin, { ...payload, requesterId: myId })
    if (updated) {
      lastVersionRef.current = updated.version
      setRoom(updated)
    }
  }

  async function handleStart() { await doAction({ action: "start" }) }

  // Wager Wars: lock in a chip wager before options are revealed.
  // The server clamps the amount to [10, player.balance].
  async function handleWager(amount: number) {
    await doAction({ action: "place_wager", playerId: myId, wagerAmount: amount })
  }

  // Send both the option ID (answer) and its full display text (answerText).
  // The server validates by matching the selected text against the correct
  // option's text — immune to index-ordering bugs. Score delta is used
  // client-side to determine immediate correct/wrong feedback because
  // correctAnswer is withheld from the client payload until reveal.
  async function handleAnswer(answer: string, answerText: string) {
    const reactionTimeMs = Date.now() - questionStartRef.current
    const prevScore = room?.players.find(p => p.id === myId)?.score ?? 0
    // Snapshot the current question before the API call so it's available for
    // the review drawer even if the room state advances before we store it.
    const currentQ = room?.questionPool[room.currentQi] ?? null
    const updated = await apiAction(pin, {
      action: "answer", playerId: myId, requesterId: myId,
      answer, answerText, reactionTimeMs,
    })
    if (updated) {
      const newScore = updated.players.find(p => p.id === myId)?.score ?? 0
      setMyLastAnswerCorrect(newScore > prevScore)
      lastVersionRef.current = updated.version
      setRoom(updated)
      // Record this answer for the post-game Review Vignettes drawer
      if (currentQ) {
        setAnswerHistory(prev => [...prev, { question: currentQ, selected: answer }])
      }
      // ── Smart auto-advance: fast-poll after answering ──────────────────────
      // If this player was NOT the last to answer (phase is still "question"),
      // switch to a 300 ms fast-poll so we detect the server-side reveal
      // (written atomically when the last answer arrives) within ~300 ms
      // instead of waiting up to 1.5 s for the regular poll tick.
      // Safe to restart: clears any pre-existing fast-poll before setting a new one.
      if (updated.phase === "question" && (mode === "clash" || mode === "cohort")) {
        if (fastPollRef.current) clearInterval(fastPollRef.current)
        fastPollRef.current = setInterval(poll, 300)
      }
    }
  }

  async function handleAdvance() { await doAction({ action: "advance" }) }
  async function handleFinish() { await doAction({ action: "finish" }) }

  async function handleExit() {
    clearActiveRoomSession()
    // Derive host status from live room state (not the stale isHost prop) so
    // that host-migration during the match triggers the correct exit path.
    const amCurrentHost = room?.hostId === myId
    try {
      if (amCurrentHost) await apiDeleteRoom(pin, myId)
      else await doAction({ action: "disconnect", playerId: myId })
    } catch {
      // Proceed to exit even if the network call fails — local session is
      // already cleared and the server will auto-expire the room.
    }
    onExit()
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-8 gap-4">
        <ErrorBanner msg={error} />
        {/* Use handleExit (not onExit) so clearActiveRoomSession() always runs */}
        <button type="button" onClick={handleExit} className="rounded-2xl border border-border px-6 py-3 text-sm font-medium text-foreground">Back to Game Mode</button>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="text-center">
          <div className="mb-3 text-4xl animate-pulse">🎮</div>
          <p className="text-sm text-muted-foreground">Connecting to room…</p>
        </div>
      </div>
    )
  }

  if (room.phase === "lobby") {
    return <RoomLobby room={room} myId={myId} isHost={isHost} onStart={handleStart} onExit={handleExit} />
  }

  if (room.phase === "done") {
    return <FinalResults room={room} myId={myId} onExit={onExit} answerHistory={answerHistory} />
  }

  // Wager Wars — single HUD handles wager/question/reveal phases
  if (room.mode === "wager") {
    return (
      <WagerHUD
        room={room}
        myId={myId}
        isHost={isHost}
        onWager={handleWager}
        onAnswer={handleAnswer}
        onAdvance={handleAdvance}
        onFinish={handleFinish}
        onLeave={handleExit}
        myLastAnswerCorrect={myLastAnswerCorrect}
        timeLeftMs={timeLeftMs}
        isPressure={isPressure}
      />
    )
  }

  // Double Jeopardy Multiplayer — percentage-based wagers, no timer
  if (room.mode === "djmulti") {
    return (
      <DoubleJeopardyMultiHUD
        room={room}
        myId={myId}
        isHost={isHost}
        onWager={handleWager}
        onAnswer={handleAnswer}
        onAdvance={handleAdvance}
        onFinish={handleFinish}
        onLeave={handleExit}
        myLastAnswerCorrect={myLastAnswerCorrect}
      />
    )
  }

  // Playing phase (question or reveal)
  if (room.mode === "cohort" && isCohortHost) {
    return (
      <CohortHostHUD
        room={room}
        onAdvance={handleAdvance}
        onFinish={handleFinish}
        onLeave={handleExit}
        timeLeftMs={timeLeftMs}
        isPressure={isPressure}
      />
    )
  }

  if (room.mode === "cohort" && !isCohortHost) {
    return (
      <CohortPlayerHUD
        room={room}
        myId={myId}
        onAnswer={handleAnswer}
        onLeave={handleExit}
        timeLeftMs={timeLeftMs}
        isPressure={isPressure}
      />
    )
  }

  // Clash (host and players share same HUD)
  return (
    <QuestionHUD
      room={room}
      myId={myId}
      isHost={isHost}
      onAnswer={handleAnswer}
      onAdvance={handleAdvance}
      onFinish={handleFinish}
      onLeave={handleExit}
      myLastAnswerCorrect={myLastAnswerCorrect}
      timeLeftMs={timeLeftMs}
      isPressure={isPressure}
    />
  )
}

// ── MAIN ENTRY POINTS ─────────────────────────────────────────────────────────
type MultiView = "select" | "create" | "join" | "room"

export function MultiplayerClash({ onExit }: { onExit: () => void }) {
  const resumed = useRef(loadActiveRoomSession())
  const canResume = resumed.current?.mode === "clash"
  const [view, setView] = useState<MultiView>(canResume ? "room" : "select")
  const [pin, setPin] = useState(canResume ? resumed.current!.pin : "")
  const [myId, setMyId] = useState(canResume ? resumed.current!.myId : "")
  const [isHost, setIsHost] = useState(canResume ? resumed.current!.isHost : false)

  if (view === "select") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 gap-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="text-4xl mb-3">⚔️</div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Multiplayer Clash</h1>
            <p className="mt-1 text-sm text-muted-foreground">Max 5 players · Compete in real time</p>
          </div>
          <div className="grid gap-3">
            <button type="button" onClick={() => setView("create")}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
              👑 Create a Room
            </button>
            <button type="button" onClick={() => setView("join")}
              className="w-full rounded-2xl border border-border bg-card py-4 text-base font-bold text-foreground transition-all hover:bg-muted">
              🎮 Join a Room
            </button>
          </div>
          <button type="button" onClick={onExit} className="mt-4 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Back
          </button>
        </div>
      </div>
    )
  }

  if (view === "create") {
    return (
      <CreateRoomScreen mode="clash" onBack={() => setView("select")} onCreated={(p, id) => {
        setPin(p); setMyId(id); setIsHost(true); setView("room")
      }} />
    )
  }

  if (view === "join") {
    return (
      <JoinScreen onBack={() => setView("select")} onJoined={(p, id) => {
        setPin(p); setMyId(id); setIsHost(false); setView("room")
      }} />
    )
  }

  return <GameRoomController pin={pin} myId={myId} isHost={isHost} isCohortHost={false} mode="clash" onExit={onExit} />
}

export function CohortReview({ onExit }: { onExit: () => void }) {
  const resumed = useRef(loadActiveRoomSession())
  const canResume = resumed.current?.mode === "cohort"
  const [view, setView] = useState<MultiView>(canResume ? "room" : "select")
  const [pin, setPin] = useState(canResume ? resumed.current!.pin : "")
  const [myId, setMyId] = useState(canResume ? resumed.current!.myId : "")
  const [isHost, setIsHost] = useState(canResume ? resumed.current!.isHost : false)

  if (view === "select") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 gap-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="text-4xl mb-3">🎓</div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Cohort Review</h1>
            <p className="mt-1 text-sm text-muted-foreground">Unlimited players · Kahoot-style · Host controls pace</p>
          </div>
          <div className="grid gap-3">
            <button type="button" onClick={() => setView("create")}
              className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
              📺 Host a Session
            </button>
            <button type="button" onClick={() => setView("join")}
              className="w-full rounded-2xl border border-border bg-card py-4 text-base font-bold text-foreground transition-all hover:bg-muted">
              📱 Join as Player
            </button>
          </div>
          <button type="button" onClick={onExit} className="mt-4 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Back
          </button>
        </div>
      </div>
    )
  }

  if (view === "create") {
    return (
      <CreateRoomScreen mode="cohort" onBack={() => setView("select")} onCreated={(p, id) => {
        setPin(p); setMyId(id); setIsHost(true); setView("room")
      }} />
    )
  }

  if (view === "join") {
    return (
      <JoinScreen onBack={() => setView("select")} onJoined={(p, id) => {
        setPin(p); setMyId(id); setIsHost(false); setView("room")
      }} />
    )
  }

  return <GameRoomController pin={pin} myId={myId} isHost={isHost} isCohortHost={isHost} mode="cohort" onExit={onExit} />
}

// ── DOUBLE JEOPARDY MULTIPLAYER ENTRY POINT ──────────────────────────────────
export function DoubleJeopardyMulti({ onExit }: { onExit: () => void }) {
  const resumed = useRef(loadActiveRoomSession())
  const canResume = resumed.current?.mode === "djmulti"
  const [view, setView] = useState<MultiView>(canResume ? "room" : "select")
  const [pin, setPin] = useState(canResume ? resumed.current!.pin : "")
  const [myId, setMyId] = useState(canResume ? resumed.current!.myId : "")
  const [isHost, setIsHost] = useState(canResume ? resumed.current!.isHost : false)

  if (view === "select") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 gap-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="text-4xl mb-3">🎲</div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Double Jeopardy</h1>
            <p className="mt-1 text-sm text-muted-foreground">Max 5 players · Read the vignette · Wager your confidence</p>
          </div>
          <div className="grid gap-3">
            <button type="button" onClick={() => setView("create")}
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
              👑 Create a Room
            </button>
            <button type="button" onClick={() => setView("join")}
              className="w-full rounded-2xl border border-border bg-card py-4 text-base font-bold text-foreground transition-all hover:bg-muted">
              🎲 Join a Room
            </button>
          </div>
          <button type="button" onClick={onExit} className="mt-4 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Back
          </button>
        </div>
      </div>
    )
  }

  if (view === "create") {
    return (
      <CreateRoomScreen mode="djmulti" onBack={() => setView("select")} onCreated={(p, id) => {
        setPin(p); setMyId(id); setIsHost(true); setView("room")
      }} />
    )
  }

  if (view === "join") {
    return (
      <JoinScreen onBack={() => setView("select")} onJoined={(p, id) => {
        setPin(p); setMyId(id); setIsHost(false); setView("room")
      }} />
    )
  }

  return <GameRoomController pin={pin} myId={myId} isHost={isHost} isCohortHost={false} mode="djmulti" onExit={onExit} />
}

// ── WAGER WARS ENTRY POINT ────────────────────────────────────────────────────
export function WagerWars({ onExit }: { onExit: () => void }) {
  const resumed = useRef(loadActiveRoomSession())
  const canResume = resumed.current?.mode === "wager"
  const [view, setView] = useState<MultiView>(canResume ? "room" : "select")
  const [pin, setPin] = useState(canResume ? resumed.current!.pin : "")
  const [myId, setMyId] = useState(canResume ? resumed.current!.myId : "")
  const [isHost, setIsHost] = useState(canResume ? resumed.current!.isHost : false)

  if (view === "select") {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-6 gap-4">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="text-4xl mb-3">🎰</div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">Wager Wars</h1>
            <p className="mt-1 text-sm text-muted-foreground">Max 8 players · Bet chips · Balance hits 0 → Spectator</p>
          </div>
          <div className="grid gap-3">
            <button type="button" onClick={() => setView("create")}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-90">
              👑 Create a Room
            </button>
            <button type="button" onClick={() => setView("join")}
              className="w-full rounded-2xl border border-border bg-card py-4 text-base font-bold text-foreground transition-all hover:bg-muted">
              🎰 Join a Room
            </button>
          </div>
          <button type="button" onClick={onExit} className="mt-4 w-full rounded-2xl py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Back
          </button>
        </div>
      </div>
    )
  }

  if (view === "create") {
    return (
      <CreateRoomScreen mode="wager" onBack={() => setView("select")} onCreated={(p, id) => {
        setPin(p); setMyId(id); setIsHost(true); setView("room")
      }} />
    )
  }

  if (view === "join") {
    return (
      <JoinScreen onBack={() => setView("select")} onJoined={(p, id) => {
        setPin(p); setMyId(id); setIsHost(false); setView("room")
      }} />
    )
  }

  return <GameRoomController pin={pin} myId={myId} isHost={isHost} isCohortHost={false} mode="wager" onExit={onExit} />
}
