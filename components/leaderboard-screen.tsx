"use client"

import { useCallback, useEffect, useState } from "react"
import { ArrowRight, RefreshCw, Trophy } from "lucide-react"
import { useApp } from "@/contexts/app-context"
import { FRAME_RING_CLASSES, HIGHLIGHT_ROW_CLASSES, STORE_ITEMS, TITLE_LABELS } from "@/lib/economy"
import { PublicProfileModal } from "@/components/public-profile-modal"
import type { LeaderboardEntry } from "@/components/public-profile-modal"
import type { Screen } from "@/lib/view"

type RankingTab = "weekly" | "monthly" | "alltime"
type LeaderboardScreenProps = { onNavigate?: (screen: Screen) => void }

const ranges: Array<{ id: RankingTab; label: string; description: string }> = [
  { id: "weekly", label: "Weekly", description: "Nexus Points earned in the last 7 days" },
  { id: "monthly", label: "Monthly", description: "Nexus Points earned in the last 30 days" },
  { id: "alltime", label: "All Time", description: "Your complete Nexus Points ranking" },
]

const podium = {
  1: { order: "order-2", height: "h-36 sm:h-44", avatar: "h-[82px] w-[82px] sm:h-24 sm:w-24", tone: "from-amber-300 via-yellow-400 to-amber-500", badge: "bg-amber-400 text-amber-950", delay: "120ms" },
  2: { order: "order-1", height: "h-24 sm:h-32", avatar: "h-16 w-16 sm:h-[76px] sm:w-[76px]", tone: "from-slate-200 via-slate-300 to-slate-400", badge: "bg-slate-300 text-slate-800", delay: "40ms" },
  3: { order: "order-3", height: "h-20 sm:h-28", avatar: "h-14 w-14 sm:h-[70px] sm:w-[70px]", tone: "from-orange-300 via-orange-400 to-amber-600", badge: "bg-orange-400 text-orange-950", delay: "200ms" },
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
  const frame = entry.equippedFrame ? FRAME_RING_CLASSES[entry.equippedFrame] ?? "" : ""
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
    <div className={"leaderboard-avatar-stage relative shrink-0 " + size}>
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
        <Avatar entry={entry} size={style.avatar} orbit rank={entry.rank as 1 | 2 | 3} />
        <p className="mt-5 max-w-[104px] truncate text-sm font-bold text-foreground sm:max-w-[150px] sm:text-base">{entry.name}</p>
        <p className="max-w-[104px] truncate text-[10px] uppercase tracking-wide text-muted-foreground sm:max-w-[150px]">{subtitle(entry)}</p>
      </div>
      <div className={"leaderboard-pedestal mt-3 flex w-full max-w-[132px] flex-col items-center overflow-hidden bg-gradient-to-b px-2 pt-4 shadow-lg transition-transform group-hover:-translate-y-1 sm:max-w-[170px] " + style.height + " " + style.tone}>
        <span className="relative z-10 rounded-xl bg-white/30 px-2.5 py-1 text-xs font-black tabular-nums text-slate-900 backdrop-blur-sm sm:text-sm">{formatNP(entry.np)} NP</span>
        <Trophy className="relative z-10 mt-auto mb-4 text-white/90 drop-shadow" size={entry.rank === 1 ? 24 : 19} aria-hidden />
      </div>
    </button>
  )
}

function CompetitorRow({ entry, viewer, index, onSelect }: { entry: LeaderboardEntry; viewer: boolean; index: number; onSelect: () => void }) {
  const highlight = entry.equippedHighlight ? HIGHLIGHT_ROW_CLASSES[entry.equippedHighlight] ?? "" : ""
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ animationDelay: `${Math.min(index, 10) * 45}ms` }}
      className={"leaderboard-row flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:px-4 " + (viewer ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20 " : "") + highlight}
    >
      <span className="w-8 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">{entry.rank}</span>
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
    </button>
  )
}

function ViewerCard({ entry, onProfile, onStudy }: { entry: LeaderboardEntry; onProfile: () => void; onStudy: () => void }) {
  return (
    <section className="leaderboard-viewer fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-2xl rounded-2xl border border-primary/30 bg-primary p-3 text-primary-foreground shadow-2xl md:sticky md:bottom-4 md:inset-x-auto md:p-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onProfile} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-foreground/15 text-sm font-black">{entry.rank}</span>
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground/70">Your ranking</span>
            <span className="block truncate text-sm font-bold sm:text-base">{formatNP(entry.np)} Nexus Points</span>
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
      if (!response.ok) throw new Error("Failed to load")
      const body = await response.json()
      setEntries(body.entries ?? [])
      setViewerEntry(body.viewerEntry ?? null)
    } catch {
      setError("Could not load the rankings. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void fetchData(tab) }, [fetchData, tab])

  const currentRange = ranges.find((range) => range.id === tab) ?? ranges[1]
  const selectedIndex = ranges.findIndex((range) => range.id === tab)
  const top3 = entries.slice(0, 3)
  const competitors = entries.slice(3)
  const showViewer = viewerEntry && viewerEntry.rank > 10 && !loading && !error

  return (
    <div className="mx-auto max-w-3xl space-y-5 overflow-x-hidden pb-44 md:pb-10">
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
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-b from-primary/[0.08] via-card to-card px-2 pt-10 shadow-sm sm:px-6 sm:pt-14">
          <span className="leaderboard-field-star pointer-events-none absolute left-[8%] top-12 text-primary/60">✦</span>
          <span className="leaderboard-field-star leaderboard-field-star-delay pointer-events-none absolute right-[9%] top-20 text-amber-400/80">★</span>
          <span className="leaderboard-field-star pointer-events-none absolute left-[46%] top-4 text-primary/45">✧</span>
          <span className="leaderboard-field-dot pointer-events-none absolute left-[18%] top-[42%] h-1.5 w-1.5 rounded-full bg-primary/45" />
          <span className="leaderboard-field-dot leaderboard-field-star-delay pointer-events-none absolute right-[21%] top-[35%] h-2 w-2 rounded-full bg-amber-400/65" />
          <div className="flex min-h-[300px] items-end justify-center gap-1.5 sm:min-h-[365px] sm:gap-4">
            {top3.map((entry) => <PodiumPlace key={entry.uid} entry={entry} onSelect={() => setSelected(entry)} />)}
          </div>
        </section>

        {tab !== "alltime" && <p className="text-center text-[11px] text-muted-foreground">Accuracy appears after 50 questions in this ranking period.</p>}

        {competitors.length > 0 && <section className="space-y-2" aria-label="Competitors">
          <h2 className="px-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Competitors</h2>
          {competitors.map((entry, index) => <CompetitorRow key={entry.uid} entry={entry} viewer={entry.uid === user?.uid} index={index} onSelect={() => setSelected(entry)} />)}
        </section>}
      </>}

      {showViewer && viewerEntry && <ViewerCard entry={viewerEntry} onProfile={() => setSelected(viewerEntry)} onStudy={() => onNavigate?.("modules")} />}
      {selected && <PublicProfileModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
