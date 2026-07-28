"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRight, Crown, Medal, RefreshCw, Trophy } from "lucide-react"
import { useApp } from "@/contexts/app-context"
import { STORE_ITEMS, TITLE_LABELS, getCosmeticAccessibleLabel } from "@/lib/economy"
import { PublicProfileModal } from "@/components/public-profile-modal"
import type { LeaderboardEntry } from "@/components/public-profile-modal"
import type { Screen } from "@/lib/view"
import { CosmeticHighlight, getCosmeticPresentation } from "@/components/cosmetics"

type RankingTab = "weekly" | "monthly" | "alltime"
type LeaderboardErrorCode = "ECONOMY_SEASON_MISSING" | "ECONOMY_SCHEMA_NOT_READY" | "LEADERBOARD_DATA_INVALID"
type LeaderboardScreenProps = { onNavigate?: (screen: Screen) => void }

const ranges: Array<{ id: RankingTab; label: string; description: string }> = [
  { id: "weekly", label: "Weekly", description: "Nexus Points earned in the last 7 days" },
  { id: "monthly", label: "Monthly", description: "Nexus Points earned in the last 30 days" },
  { id: "alltime", label: "Season", description: "NP earned in the active season — spending does not lower your place" },
]

const podium = {
  1: { order: "order-2", height: "h-40 sm:h-48", avatar: "h-[86px] w-[86px] sm:h-24 sm:w-24", tone: "from-amber-300 via-yellow-400 to-amber-600", surface: "from-yellow-200 via-amber-300 to-amber-500", delay: "120ms" },
  2: { order: "order-1", height: "h-28 sm:h-36", avatar: "h-[68px] w-[68px] sm:h-20 sm:w-20", tone: "from-slate-200 via-slate-300 to-slate-500", surface: "from-white via-slate-200 to-slate-400", delay: "40ms" },
  3: { order: "order-3", height: "h-24 sm:h-32", avatar: "h-16 w-16 sm:h-[74px] sm:w-[74px]", tone: "from-orange-300 via-orange-400 to-orange-700", surface: "from-orange-200 via-orange-300 to-orange-500", delay: "200ms" },
} as const

function formatNP(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
  return value.toLocaleString()
}

function subtitle(entry: LeaderboardEntry) {
  return entry.classLevel || entry.level || (entry.equippedTitle ? TITLE_LABELS[entry.equippedTitle] : null) || "MedNexus learner"
}

function Avatar({ entry, size, orbit = false, rank }: {
  entry: LeaderboardEntry
  size: string
  orbit?: boolean
  rank?: 1 | 2 | 3
}) {
  const frame = entry.equippedFrame ? getCosmeticPresentation(entry.equippedFrame).className ?? "" : ""
  const frameLabel = getCosmeticAccessibleLabel(entry.equippedFrame)
  const avatar = entry.equippedAvatar ? STORE_ITEMS.find((item) => item.id === entry.equippedAvatar) : null
  const medal = rank === 1
    ? "border-amber-300 bg-amber-400 text-amber-950"
    : rank === 2
      ? "border-slate-200 bg-slate-300 text-slate-900"
      : "border-orange-300 bg-orange-400 text-orange-950"
  const orbitStrong = rank === 1
    ? "border-amber-400/70"
    : rank === 2
      ? "border-slate-400/70"
      : "border-orange-400/70"
  const orbitSoft = rank === 1
    ? "border-amber-300/35"
    : rank === 2
      ? "border-slate-300/35"
      : "border-orange-300/35"
  const orbitDot = rank === 1
    ? "bg-amber-400"
    : rank === 2
      ? "bg-slate-300"
      : "bg-orange-400"
  return (
    <div role="img" aria-label={`${entry.name}'s avatar${frameLabel ? ` with ${frameLabel} frame` : ""}`} className={"leaderboard-avatar-stage relative shrink-0 " + size}>
      {orbit && <>
        <span className={"leaderboard-orbit leaderboard-orbit-a absolute -inset-3 rounded-full border-2 border-dashed " + orbitStrong} />
        <span className={"leaderboard-orbit leaderboard-orbit-b absolute -inset-5 rounded-full border " + orbitSoft} />
        <span className={"leaderboard-particle leaderboard-particle-a absolute -right-4 top-1/2 h-2.5 w-2.5 rounded-full shadow-[0_0_12px_currentColor] " + orbitDot} />
        <span className="leaderboard-particle leaderboard-particle-b absolute -left-3 bottom-0 h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.7)]" />
        <span className="leaderboard-star leaderboard-star-a absolute -left-5 -top-3 text-primary" aria-hidden>✦</span>
        <span className="leaderboard-star leaderboard-star-b absolute -right-5 top-0 text-amber-400" aria-hidden>★</span>
        <span className="leaderboard-star leaderboard-star-c absolute -right-3 -bottom-3 text-primary/70" aria-hidden>✧</span>
      </>}
      <div className={"leaderboard-avatar-frame relative flex h-full w-full items-center justify-center rounded-full border-2 border-card bg-card p-1 shadow-xl " + frame}>
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-extrabold text-primary">
          {avatar?.imagePath
            ? <img src={avatar.imagePath} alt="" className="h-full w-full object-cover" />
            : (entry.name[0] ?? "?").toUpperCase()}
        </div>
        {rank && <span className={"absolute bottom-0 left-1/2 z-20 flex h-6 min-w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 px-1 text-[11px] font-black shadow-md " + medal}>{rank}</span>}
      </div>
    </div>
  )
}

function PodiumPlace({ entry, onSelect }: { entry: LeaderboardEntry; onSelect: () => void }) {
  const style = podium[entry.rank as 1 | 2 | 3]
  if (!style) return null
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ animationDelay: style.delay }}
      className={"leaderboard-podium-entry group flex min-w-0 flex-1 flex-col items-center self-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " + style.order}
      aria-label={`Open ${entry.name}'s profile, rank ${entry.rank}`}
    >
      <div className="relative z-10 flex min-w-0 flex-col items-center">
        {entry.rank === 1 && <Crown className="leaderboard-crown absolute -top-9 z-20 fill-amber-300 text-amber-500 drop-shadow-[0_4px_8px_rgba(245,158,11,0.45)]" size={30} aria-hidden />}
        <Avatar entry={entry} size={style.avatar} orbit rank={entry.rank as 1 | 2 | 3} />
        <p className="mt-5 max-w-[104px] truncate text-sm font-bold text-foreground sm:max-w-[150px] sm:text-base">{entry.name}</p>
        <p className="max-w-[104px] truncate text-[10px] uppercase tracking-wide text-muted-foreground sm:max-w-[150px]">{subtitle(entry)}</p>
      </div>
      <div className={"leaderboard-pedestal-shell relative mt-4 w-full max-w-[132px] transition-transform group-hover:-translate-y-1 sm:max-w-[170px] " + style.height}>
        <span className={"leaderboard-pedestal-surface absolute inset-x-[10%] -top-3 h-7 rounded-[50%] bg-gradient-to-r shadow-inner " + style.surface} aria-hidden />
        <div className={"leaderboard-pedestal flex h-full w-full flex-col items-center overflow-hidden bg-gradient-to-b px-2 pt-5 shadow-xl " + style.tone}>
          <span className="leaderboard-pedestal-shine absolute inset-y-4 left-[18%] w-[14%] rounded-full bg-white/25 blur-sm" aria-hidden />
          <span className="relative z-10 rounded-xl border border-white/25 bg-white/30 px-2.5 py-1 text-xs font-black tabular-nums text-slate-900 shadow-sm backdrop-blur-sm sm:text-sm">{formatNP(entry.np)} NP</span>
          {entry.rank === 1
            ? <Trophy className="relative z-10 mt-auto mb-5 text-white/95 drop-shadow-md" size={27} aria-hidden />
            : <Medal className="relative z-10 mt-auto mb-5 text-white/90 drop-shadow-md" size={22} aria-hidden />}
        </div>
      </div>
    </button>
  )
}

function CompetitorRow({ entry, viewer, index, onSelect }: { entry: LeaderboardEntry; viewer: boolean; index: number; onSelect: () => void }) {
  const [engaged, setEngaged] = useState(false)
  const cosmeticLabel = getCosmeticAccessibleLabel(entry.equippedHighlight)
  return (
    <CosmeticHighlight as="button" cosmeticId={entry.equippedHighlight} size="leaderboard" motionState={engaged ? "focused" : "static"} playerRank={entry.rank}
      wrapperProps={{ type: "button", onClick: onSelect, "aria-label": `Open ${entry.name}'s profile, rank ${entry.rank}${cosmeticLabel ? `, ${cosmeticLabel} highlight` : ""}`, style: { animationDelay: `${Math.min(index, 10) * 45}ms` }, onPointerEnter: () => setEngaged(true), onPointerLeave: () => setEngaged(false), onFocus: () => setEngaged(true), onBlur: () => setEngaged(false) }}
      className={"leaderboard-row flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4 " + (viewer ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "")}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-black tabular-nums text-muted-foreground ring-1 ring-border/70">{entry.rank}</span>
      <Avatar entry={entry} size="h-11 w-11 sm:h-12 sm:w-12" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold text-foreground sm:text-base">{entry.name}</span>
          {viewer && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">You</span>}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">{subtitle(entry)}</span>
      </span>
      {entry.accuracy > 0 && !entry.accuracySuppressed && <span className="hidden text-xs font-medium text-muted-foreground min-[390px]:inline">🎯 {entry.accuracy}%</span>}
      <span className="shrink-0 text-sm font-black tabular-nums text-foreground sm:text-base">{formatNP(entry.np)} <span className="text-[10px] font-bold text-muted-foreground">NP</span></span>
    </CosmeticHighlight>
  )
}

const DIAGNOSTIC_COSMETICS = ["highlight_gold", "highlight_amethyst", "highlight_legendary_crimson", "highlight_legendary_emerald", "highlight_mythic_lightning"]
const DIAGNOSTIC_FRAMES = ["frame_neon", "frame_fire", "frame_legendary_diamond", "frame_mythic_nebula", "frame_lightning"]

function CosmeticPerformanceDiagnostic() {
  const entries: LeaderboardEntry[] = Array.from({ length: 50 }, (_, index) => ({
    rank: index + 1,
    uid: `cosmetic-diagnostic-${index}`,
    name: `Equipped learner ${String(index + 1).padStart(2, "0")}`,
    level: "Performance diagnostic",
    classLevel: "Performance diagnostic",
    np: 100_000 - index * 731,
    accuracy: 75 + index % 24,
    equippedTitle: "title_attending",
    equippedFrame: DIAGNOSTIC_FRAMES[index % DIAGNOSTIC_FRAMES.length],
    equippedHighlight: DIAGNOSTIC_COSMETICS[index % DIAGNOSTIC_COSMETICS.length],
    equippedAvatar: null,
  }))
  return <section aria-label="Cosmetic performance diagnostic" className="space-y-2">
    <div className="sticky top-0 z-20 rounded-2xl border border-amber-400/50 bg-amber-50 p-3 text-xs font-medium text-amber-950 shadow-sm">
      Development diagnostic: 50 equipped entries. Hover or keyboard-focus a row to enable its full cosmetic motion.
    </div>
    {entries.map((entry, index) => <CompetitorRow key={entry.uid} entry={entry} viewer={false} index={index} onSelect={() => undefined} />)}
  </section>
}

function ViewerCard({ entry, onProfile, onStudy }: { entry: LeaderboardEntry; onProfile: () => void; onStudy: () => void }) {
  return (
    <section className="leaderboard-viewer fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl overflow-hidden rounded-2xl border border-primary-foreground/15 bg-primary p-3 text-primary-foreground shadow-2xl md:sticky md:bottom-4 md:inset-x-auto md:p-4">
      <span className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-primary-foreground/10 blur-2xl" aria-hidden />
      <div className="flex items-center gap-3">
        <button type="button" onClick={onProfile} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground">
          <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-primary-foreground/15 text-sm font-black ring-1 ring-primary-foreground/15">
            <span className="text-[8px] font-bold uppercase tracking-wide opacity-70">Rank</span>
            <span>{entry.rank}</span>
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground/70">Your ranking</span>
            <span className="block truncate text-sm font-bold sm:text-base">{formatNP(entry.np)} NP earned</span>
          </span>
        </button>
        <button type="button" onClick={onStudy} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-primary-foreground px-3 text-xs font-bold text-primary shadow-sm transition hover:scale-[1.02] sm:px-5 sm:text-sm">
          Start studying <ArrowRight size={16} />
        </button>
      </div>
    </section>
  )
}

export function LeaderboardScreen({ onNavigate }: LeaderboardScreenProps) {
  const { user } = useApp()
  const [tab, setTab] = useState<RankingTab>("monthly")
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [viewerEntry, setViewerEntry] = useState<LeaderboardEntry | null>(null)
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDiagnostic, setShowDiagnostic] = useState(false)

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setShowDiagnostic(new URLSearchParams(window.location.search).get("cosmeticPerf") === "1")
    }
  }, [])

  const fetchData = useCallback(async (range: RankingTab) => {
    setLoading(true)
    setError(null)
    try {
      const sessionToken = localStorage.getItem("mednexus-user-token")
      const guestToken = localStorage.getItem("mednexus-guest-token")
      const headers: Record<string, string> = {}
      if (sessionToken) headers["x-session-token"] = sessionToken
      else if (guestToken) headers["x-guest-token"] = guestToken
      const response = await fetch(`/api/leaderboard?tab=${range}`, { headers })
      const body = await response.json().catch(() => ({})) as { entries?: LeaderboardEntry[]; viewerEntry?: LeaderboardEntry | null; code?: LeaderboardErrorCode }
      if (!response.ok) {
        if (response.status === 401) throw new Error("AUTH_EXPIRED")
        throw new Error(body.code ?? "UNKNOWN")
      }
      setEntries(body.entries ?? [])
      setViewerEntry(body.viewerEntry ?? null)
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "UNKNOWN"
      setError(code === "ECONOMY_SEASON_MISSING" || code === "ECONOMY_SCHEMA_NOT_READY"
        ? "Season setup is underway. Rankings will be available shortly."
        : code === "LEADERBOARD_DATA_INVALID"
          ? "Rankings are temporarily unavailable while we verify the data."
          : code === "AUTH_EXPIRED"
            ? "Your authentication has expired. Please sign in again, then retry."
            : "Could not load the rankings. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData(tab) }, [fetchData, tab])

  const currentRange = ranges.find((range) => range.id === tab) ?? ranges[1]
  const selectedIndex = ranges.findIndex((range) => range.id === tab)
  const top3 = entries.slice(0, 3)
  const competitors = entries.slice(3)
  const showViewer = viewerEntry && !loading && !error

  return (
    <div className="mx-auto max-w-3xl space-y-5 overflow-x-hidden pb-44 md:pb-10">
      {showDiagnostic && <CosmeticPerformanceDiagnostic />}
      {!showDiagnostic && <>
      <header className="relative text-center">
        <div className="mx-auto flex items-center justify-center gap-2">
          <Trophy className="text-primary" size={22} aria-hidden />
          <h1 className="text-xl font-black text-foreground sm:text-2xl">Rankings</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{currentRange.description}</p>
        <button type="button" onClick={() => void fetchData(tab)} className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-muted" aria-label="Refresh rankings">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <div className="relative grid grid-cols-3 rounded-2xl bg-muted p-1" role="tablist" aria-label="Ranking period">
        <span className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-card shadow-sm transition-transform duration-300 ease-out motion-reduce:transition-none" style={{ transform: `translateX(${selectedIndex * 100}%)` }} aria-hidden />
        {ranges.map((range) => <button key={range.id} type="button" role="tab" aria-selected={tab === range.id} onClick={() => setTab(range.id)} className={"relative z-10 min-h-11 rounded-xl px-1 text-xs font-bold transition-colors sm:text-sm " + (tab === range.id ? "text-primary" : "text-muted-foreground hover:text-foreground")}>{range.label}</button>)}
      </div>

      {loading && <div className="space-y-5">
        <div className="flex h-80 items-end justify-center gap-2 rounded-3xl border border-border bg-card px-4 pb-0 sm:gap-5">{[2, 1, 3].map((rank) => <div key={rank} className={"w-1/3 max-w-[150px] animate-pulse rounded-t-3xl bg-muted " + (rank === 1 ? "h-52" : rank === 2 ? "h-40" : "h-32")} />)}</div>
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-[72px] animate-pulse rounded-2xl bg-muted" />)}
      </div>}

      {!loading && error && <div className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-card py-16 text-center"><Trophy className="text-muted-foreground" size={38}/><p className="text-sm text-muted-foreground">{error}</p><button onClick={() => void fetchData(tab)} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground">Retry</button></div>}

      {!loading && !error && entries.length === 0 && <div className="flex flex-col items-center gap-3 rounded-3xl border border-border bg-card py-16 text-center"><Trophy className="text-primary" size={46}/><h2 className="font-bold">No rankings yet</h2><p className="max-w-sm px-5 text-sm text-muted-foreground">Start answering questions to become the first learner on this leaderboard.</p>{onNavigate && <button onClick={() => onNavigate("modules")} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">Start studying <ArrowRight size={16}/></button>}</div>}

      {!loading && !error && entries.length > 0 && <>
        <section className="leaderboard-stage relative overflow-hidden bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.13),transparent_48%)] px-1 pt-12 sm:px-5 sm:pt-16">
          <span className="leaderboard-field-star pointer-events-none absolute left-[8%] top-12 text-primary/60">✦</span>
          <span className="leaderboard-field-star leaderboard-field-star-delay pointer-events-none absolute right-[9%] top-20 text-amber-400/80">★</span>
          <span className="leaderboard-field-star pointer-events-none absolute left-[46%] top-4 text-primary/45">✧</span>
          <span className="leaderboard-field-dot pointer-events-none absolute left-[18%] top-[42%] h-1.5 w-1.5 rounded-full bg-primary/45" />
          <span className="leaderboard-field-dot leaderboard-field-star-delay pointer-events-none absolute right-[21%] top-[35%] h-2 w-2 rounded-full bg-amber-400/65" />
          <div className="relative z-10 flex min-h-[330px] items-end justify-center gap-1.5 sm:min-h-[410px] sm:gap-4">
            {top3.map((entry) => <PodiumPlace key={entry.uid} entry={entry} onSelect={() => setSelected(entry)} />)}
          </div>
          <div className="pointer-events-none absolute inset-x-[4%] bottom-0 h-5 rounded-[50%] bg-foreground/10 blur-md" aria-hidden />
        </section>

        {tab !== "alltime" && <p className="text-center text-[11px] text-muted-foreground">Accuracy appears after 50 questions in this ranking period.</p>}

        {competitors.length > 0 && <section className="space-y-2" aria-label="Competitors">
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Competitors</h2>
          {competitors.map((entry, index) => <CompetitorRow key={entry.uid} entry={entry} viewer={entry.uid === user?.uid} index={index} onSelect={() => setSelected(entry)} />)}
        </section>}
      </>}

      {showViewer && viewerEntry && <ViewerCard entry={viewerEntry} onProfile={() => setSelected(viewerEntry)} onStudy={() => onNavigate?.("modules")} />}
      {selected && <PublicProfileModal entry={selected} npLabel={tab === "alltime" ? "Lifetime NP" : "NP Earned This Period"} onClose={() => setSelected(null)} />}
      </>}
    </div>
  )
}

const VISUAL_PREVIEW_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, uid: "preview-1", name: "Ama Mensah", level: "Level 400", classLevel: "Level 400", np: 12840, accuracy: 94, equippedTitle: "title_attending", equippedFrame: "frame_legendary_diamond", equippedHighlight: null, equippedAvatar: "avatar_scrub_tech" },
  { rank: 2, uid: "preview-2", name: "Kojo Asare", level: "Level 500", classLevel: "Level 500", np: 11320, accuracy: 91, equippedTitle: null, equippedFrame: "frame_neon", equippedHighlight: null, equippedAvatar: null },
  { rank: 3, uid: "preview-3", name: "Esi Owusu", level: "Level 300", classLevel: "Level 300", np: 10890, accuracy: 89, equippedTitle: null, equippedFrame: "frame_fire", equippedHighlight: null, equippedAvatar: null },
  { rank: 4, uid: "preview-4", name: "Bright Woode", level: "Level 400", classLevel: "Level 400", np: 9740, accuracy: 88, equippedTitle: "title_attending", equippedFrame: "frame_neon", equippedHighlight: "highlight_gold", equippedAvatar: null },
  { rank: 5, uid: "preview-5", name: "Nana Yeboah", level: "Level 400", classLevel: "Level 400", np: 8610, accuracy: 86, equippedTitle: null, equippedFrame: null, equippedHighlight: null, equippedAvatar: null },
  { rank: 6, uid: "preview-6", name: "Adwoa Nyarko", level: "Level 500", classLevel: "Level 500", np: 7950, accuracy: 84, equippedTitle: null, equippedFrame: null, equippedHighlight: null, equippedAvatar: null },
]

/** Development-only composition used by the visual QA route. */
export function LeaderboardVisualPreview() {
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null)
  const top3 = VISUAL_PREVIEW_ENTRIES.slice(0, 3)
  const competitors = VISUAL_PREVIEW_ENTRIES.slice(3)
  const viewer = VISUAL_PREVIEW_ENTRIES[3]
  return (
    <main className="min-h-screen bg-background px-3 py-5 text-foreground sm:px-8 sm:py-8">
      <div className="mx-auto max-w-3xl space-y-5 overflow-x-hidden pb-40">
        <header className="text-center">
          <div className="flex items-center justify-center gap-2"><Trophy className="text-primary" size={22} /><h1 className="text-xl font-black sm:text-2xl">Rankings</h1></div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">Nexus Points earned in the last 30 days</p>
        </header>
        <div className="relative grid grid-cols-3 rounded-2xl bg-muted p-1" role="tablist" aria-label="Preview ranking period">
          <span className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] translate-x-full rounded-xl bg-card shadow-sm" aria-hidden />
          {ranges.map((range) => <button key={range.id} type="button" role="tab" aria-selected={range.id === "monthly"} className={"relative z-10 min-h-11 rounded-xl px-1 text-xs font-bold sm:text-sm " + (range.id === "monthly" ? "text-primary" : "text-muted-foreground")}>{range.label}</button>)}
        </div>
        <section className="leaderboard-stage relative overflow-hidden bg-[radial-gradient(circle_at_50%_35%,hsl(var(--primary)/0.13),transparent_48%)] px-1 pt-12 sm:px-5 sm:pt-16">
          <span className="leaderboard-field-star pointer-events-none absolute left-[8%] top-12 text-primary/60">✦</span>
          <span className="leaderboard-field-star leaderboard-field-star-delay pointer-events-none absolute right-[9%] top-20 text-amber-400/80">★</span>
          <span className="leaderboard-field-star pointer-events-none absolute left-[46%] top-4 text-primary/45">✧</span>
          <div className="relative z-10 flex min-h-[330px] items-end justify-center gap-1.5 sm:min-h-[410px] sm:gap-4">
            {top3.map((entry) => <PodiumPlace key={entry.uid} entry={entry} onSelect={() => setSelected(entry)} />)}
          </div>
          <div className="pointer-events-none absolute inset-x-[4%] bottom-0 h-5 rounded-[50%] bg-foreground/10 blur-md" aria-hidden />
        </section>
        <section className="space-y-2" aria-label="Preview competitors">
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Competitors</h2>
          {competitors.map((entry, index) => <CompetitorRow key={entry.uid} entry={entry} viewer={entry.uid === viewer.uid} index={index} onSelect={() => setSelected(entry)} />)}
        </section>
        <ViewerCard entry={viewer} onProfile={() => setSelected(viewer)} onStudy={() => undefined} />
        {selected && <PublicProfileModal entry={selected} npLabel="NP Earned This Period" onClose={() => setSelected(null)} />}
      </div>
    </main>
  )
}
