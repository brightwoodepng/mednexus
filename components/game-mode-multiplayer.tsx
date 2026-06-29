"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useQuestions } from "@/contexts/questions-context"
import type { Question } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────
type MultiMode = "clash" | "cohort"
type RoomPhase = "lobby" | "question" | "reveal" | "done"
type FilterScope = "all" | "module" | "subject"

interface GameFilter { scope: FilterScope; value: string | null }
const DEFAULT_FILTER: GameFilter = { scope: "all", value: null }

interface RoomPlayer {
  id: string; name: string; score: number; streak: number
  answer: string | null; answeredAt: number | null; isHost: boolean
}

interface SlimQuestion {
  id: string; subject: string; module: string | null
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string
}

interface RoomState {
  pin: string; mode: MultiMode; hostId: string; hostName: string
  questionPool: SlimQuestion[]; currentQi: number; phase: RoomPhase
  players: RoomPlayer[]
  leaderboard: RoomPlayer[] // top-5 sorted by score
  ranks: Record<string, number>
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

function filterQuestions(allQ: Question[], filter: GameFilter): Question[] {
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

function countFilter(allQ: Question[], filter: GameFilter): number {
  let base = allQ.filter(q => !q.moduleStatus || q.moduleStatus === "live")
  if (base.length < 5) base = [...allQ]
  if (filter.scope === "module" && filter.value) return base.filter(q => q.module === filter.value).length
  if (filter.scope === "subject" && filter.value) return base.filter(q => q.subject === filter.value).length
  return base.length
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiCreateRoom(mode: MultiMode, hostId: string, hostName: string, pool: Question[]): Promise<string> {
  const res = await fetch("/api/game-rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, hostId, hostName, questionPool: pool }),
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
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5">
      {rank !== undefined && (
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold
          ${rank === 1 ? "bg-amber-400 text-white" : rank === 2 ? "bg-slate-400 text-white" : rank === 3 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>
          {rank}
        </span>
      )}
      {!rank && player.isHost && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs">👑</span>
      )}
      {!rank && !player.isHost && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs">👤</span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{player.name}</span>
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
  onAnswer: (id: string) => void
  answered: string | null
  revealed: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 p-3">
      {options.slice(0, 4).map((opt, i) => (
        <button
          key={opt.id} type="button"
          disabled={answered !== null || revealed}
          onClick={() => onAnswer(opt.id)}
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
function Leaderboard({ players, highlight }: { players: RoomPlayer[]; highlight?: string }) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const maxScore = Math.max(...sorted.map(p => p.score), 1)
  return (
    <div className="grid gap-2">
      {sorted.map((p, i) => {
        const pct = Math.max((p.score / maxScore) * 100, 2)
        const isMe = p.id === highlight
        return (
          <div key={p.id} className={`rounded-2xl border p-3 ${isMe ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold
                ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-slate-400 text-white" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{p.name}{isMe ? " (You)" : ""}</span>
              <span className="tabular-nums text-sm font-bold text-foreground">{p.score.toLocaleString()}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full transition-all duration-700 ${i === 0 ? "bg-amber-400" : "bg-primary"}`}
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

// ── LOBBY (shared between host and players after joining) ─────────────────────
function RoomLobby({ room, myId, isHost, onStart, onExit }: {
  room: RoomState; myId: string; isHost: boolean; onStart: () => void; onExit: () => void
}) {
  const modeLabel = room.mode === "clash" ? "Multiplayer Clash" : "Cohort Review"
  const modeIcon = room.mode === "clash" ? "⚔️" : "🎓"

  return (
    <div className="flex min-h-full flex-col p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mb-3 text-4xl">{modeIcon}</div>
          <h1 className="text-xl font-extrabold tracking-tight text-foreground">{modeLabel}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {room.mode === "clash" ? "Max 5 players · Fastest answer wins" : "Unlimited players · Host controls pace"}
          </p>
        </div>

        <CopyPinCard pin={room.pin} />

        <div className="my-4 rounded-3xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Players</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {room.players.length}{room.mode === "clash" ? "/5" : ""}
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
function QuestionHUD({ room, myId, isHost, onAnswer, onAdvance, onFinish }: {
  room: RoomState; myId: string; isHost: boolean
  onAnswer: (answer: string) => void
  onAdvance: () => void
  onFinish: () => void
}) {
  const q = room.questionPool[room.currentQi]
  if (!q) return null

  const me = room.players.find(p => p.id === myId)
  const myAnswer = me?.answer ?? null
  const revealed = room.phase === "reveal"
  const allAnswered = room.players.length > 0 && room.players.every(p => p.answer !== null)

  return (
    <div className="flex min-h-full flex-col gap-3 p-3 sm:gap-4 sm:p-5 max-w-2xl mx-auto">
      {/* HUD bar */}
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
        <span className="text-xs font-bold text-muted-foreground">Q {room.currentQi + 1}/{room.questionPool.length}</span>
        <div className="flex-1" />
        {me && <span className="tabular-nums text-sm font-extrabold text-foreground">{me.score.toLocaleString()} pts</span>}
        {me && me.streak >= 3 && <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-400">🔥 {me.streak}×</span>}
        <AnswerProgress players={room.players} total={room.players.length} />
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
          <div className="flex-1 overflow-y-auto rounded-3xl border border-border bg-card p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{q.subject}</span>
              {q.module && <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{q.module}</span>}
            </div>
            <p className="text-sm leading-relaxed text-foreground sm:text-base">{q.vignette}</p>
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
                onSel={() => onAnswer(opt.id)}
              />
            ))}
          </div>

          {myAnswer !== null && (
            <p className="text-center text-xs font-semibold text-muted-foreground">
              {myAnswer === q.correctAnswer ? "✅ Correct! Waiting for others…" : "❌ Wrong. Waiting for others…"}
            </p>
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
function CohortHostHUD({ room, onAdvance, onFinish }: {
  room: RoomState; onAdvance: () => void; onFinish: () => void
}) {
  const q = room.questionPool[room.currentQi]
  if (!q) return null
  const revealed = room.phase === "reveal"
  const totalPlayers = room.players.length
  const answered = room.players.filter(p => p.answer !== null).length

  return (
    <div className="flex min-h-full flex-col gap-4 p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-2.5">
        <span className="text-sm font-bold text-foreground">Q {room.currentQi + 1}/{room.questionPool.length}</span>
        <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${((room.currentQi + 1) / room.questionPool.length) * 100}%` }} />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{answered}/{totalPlayers} answered</span>
      </div>

      {/* Main content */}
      {revealed ? (
        <div className="flex-1 rounded-3xl border border-border bg-card p-5">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top 5 Leaderboard</p>
          <Leaderboard players={room.leaderboard} />
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
          <div className="flex-1 rounded-3xl border-2 border-primary/20 bg-card p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{q.subject}</span>
            </div>
            <p className="text-lg leading-relaxed font-medium text-foreground sm:text-xl">{q.vignette}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {q.options.map((opt, i) => (
                <div key={opt.id} className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-white font-bold ${OPTION_COLORS[i]}`}>
                  <span className="text-xl">{OPTION_ICONS[i]}</span>
                  <span className="text-sm">{opt.id}. {opt.text}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Answer tick counter */}
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
function CohortPlayerHUD({ room, myId, onAnswer }: {
  room: RoomState; myId: string; onAnswer: (answer: string) => void
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
function FinalResults({ room, myId, onExit }: { room: RoomState; myId: string; onExit: () => void }) {
  const sorted = [...room.players].sort((a, b) => b.score - a.score)
  const me = sorted.find(p => p.id === myId)
  const myRank = sorted.findIndex(p => p.id === myId) + 1
  const modeLabel = room.mode === "clash" ? "Multiplayer Clash" : "Cohort Review"

  const podiumEmoji = myRank === 1 ? "🏆" : myRank === 2 ? "🥈" : myRank === 3 ? "🥉" : "🎯"

  return (
    <div className="flex min-h-full flex-col p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-5xl mb-3">{podiumEmoji}</div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Match Over!</h1>
          <p className="text-sm text-muted-foreground mt-1">{modeLabel}</p>
        </div>

        {me && (
          <div className="mb-5 rounded-3xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Your Final Score</p>
            <p className="text-5xl font-extrabold tabular-nums text-foreground">{me.score.toLocaleString()}</p>
            <p className="mt-2 text-sm text-muted-foreground">Rank #{myRank} of {sorted.length}</p>
          </div>
        )}

        <div className="mb-6 rounded-3xl border border-border bg-card p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Final Leaderboard</p>
          <Leaderboard players={sorted} highlight={myId} />
        </div>

        <button type="button" onClick={onExit}
          className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/20 transition-all hover:opacity-90">
          Back to Game Mode
        </button>
      </div>
    </div>
  )
}

// ── JOIN ROOM SCREEN ──────────────────────────────────────────────────────────
function JoinScreen({ onJoined, onBack }: {
  onJoined: (pin: string, playerId: string) => void
  onBack: () => void
}) {
  const [pin, setPin] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function join() {
    if (!pin.trim() || !name.trim()) { setError("Please enter both the PIN and your name."); return }
    setLoading(true); setError("")
    try {
      const pid = getOrCreatePlayerId()
      const res = await apiAction(pin.trim(), { action: "join", playerId: pid, playerName: name.trim() })
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
  const [filter, setFilter] = useState<GameFilter>(DEFAULT_FILTER)
  const [qCount, setQCount] = useState(10)
  const [hostName, setHostName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const maxQ = Math.max(countFilter(allQ, filter), 5)
  const clampedCount = Math.min(qCount, maxQ)
  const modeLabel = mode === "clash" ? "Multiplayer Clash" : "Cohort Review"
  const modeIcon = mode === "clash" ? "⚔️" : "🎓"
  const modeGradient = mode === "clash" ? "from-violet-600 to-fuchsia-600" : "from-teal-500 to-cyan-500"

  async function create() {
    if (!hostName.trim()) { setError("Please enter your display name."); return }
    setLoading(true); setError("")
    try {
      const pool = filterQuestions(allQ, filter).slice(0, clampedCount)
      if (pool.length === 0) { setError("No questions found for the selected filter."); setLoading(false); return }
      const hostId = getOrCreatePlayerId()
      const pin = await apiCreateRoom(mode, hostId, hostName.trim(), pool)
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
            {mode === "clash" ? "Competitive room · Max 5 players" : "Lecture hall mode · Unlimited players"}
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

// ── GAME ROOM CONTROLLER ──────────────────────────────────────────────────────
// Manages polling and action dispatch for an active room
function GameRoomController({ pin, myId, isHost, isCohortHost, onExit }: {
  pin: string; myId: string; isHost: boolean; isCohortHost: boolean; onExit: () => void
}) {
  const [room, setRoom] = useState<RoomState | null>(null)
  const [error, setError] = useState("")
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const lastVersionRef = useRef<number>(-1)

  const poll = useCallback(async () => {
    const state = await apiPollRoom(pin, myId)
    if (state) {
      // Ignore stale poll responses that have an older version than what we have
      if (state.version >= lastVersionRef.current) {
        lastVersionRef.current = state.version
        setRoom(state)
      }
    } else {
      setError("Lost connection to room.")
    }
  }, [pin, myId])

  useEffect(() => {
    poll()
    pollRef.current = setInterval(poll, 1500)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [poll])

  async function doAction(payload: Record<string, unknown>) {
    const updated = await apiAction(pin, { ...payload, requesterId: myId })
    if (updated) {
      lastVersionRef.current = updated.version
      setRoom(updated)
    }
  }

  async function handleStart() { await doAction({ action: "start" }) }
  async function handleAnswer(answer: string) { await doAction({ action: "answer", playerId: myId, answer }) }
  async function handleAdvance() { await doAction({ action: "advance" }) }
  async function handleFinish() { await doAction({ action: "finish" }) }

  async function handleExit() {
    if (isHost) await apiDeleteRoom(pin, myId)
    onExit()
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center p-8 gap-4">
        <ErrorBanner msg={error} />
        <button type="button" onClick={onExit} className="rounded-2xl border border-border px-6 py-3 text-sm font-medium text-foreground">Back to Game Mode</button>
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
    return <FinalResults room={room} myId={myId} onExit={onExit} />
  }

  // Playing phase (question or reveal)
  if (room.mode === "cohort" && isCohortHost) {
    return (
      <CohortHostHUD
        room={room}
        onAdvance={handleAdvance}
        onFinish={handleFinish}
      />
    )
  }

  if (room.mode === "cohort" && !isCohortHost) {
    return (
      <CohortPlayerHUD
        room={room}
        myId={myId}
        onAnswer={handleAnswer}
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
    />
  )
}

// ── MAIN ENTRY POINTS ─────────────────────────────────────────────────────────
type MultiView = "select" | "create" | "join" | "room"

export function MultiplayerClash({ onExit }: { onExit: () => void }) {
  const [view, setView] = useState<MultiView>("select")
  const [pin, setPin] = useState("")
  const [myId, setMyId] = useState("")
  const [isHost, setIsHost] = useState(false)

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

  return <GameRoomController pin={pin} myId={myId} isHost={isHost} isCohortHost={false} onExit={onExit} />
}

export function CohortReview({ onExit }: { onExit: () => void }) {
  const [view, setView] = useState<MultiView>("select")
  const [pin, setPin] = useState("")
  const [myId, setMyId] = useState("")
  const [isHost, setIsHost] = useState(false)

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

  return <GameRoomController pin={pin} myId={myId} isHost={isHost} isCohortHost={isHost} onExit={onExit} />
}
