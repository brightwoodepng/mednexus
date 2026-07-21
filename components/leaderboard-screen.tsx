"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useApp } from "@/contexts/app-context"
import { FRAME_RING_CLASSES, TITLE_LABELS, STORE_ITEMS, HIGHLIGHT_ROW_CLASSES } from "@/lib/economy"
import { RefreshCwIcon } from "@/components/icons"
import { PublicProfileModal } from "@/components/public-profile-modal"
import type { LeaderboardEntry } from "@/components/public-profile-modal"

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNP(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const PODIUM_STYLES: Record<number, { medal: string; ring: string; size: string; zIndex: string; order: string; yOffset: string; labelBg: string; labelText: string }> = {
  1: { medal: "🥇", ring: "ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]", size: "h-20 w-20", zIndex: "z-10", order: "order-2", yOffset: "-translate-y-4", labelBg: "bg-yellow-400/20 border border-yellow-400/40", labelText: "text-yellow-400" },
  2: { medal: "🥈", ring: "ring-4 ring-slate-400",                                          size: "h-16 w-16", zIndex: "z-0", order: "order-1", yOffset: "",              labelBg: "bg-slate-400/20 border border-slate-400/40", labelText: "text-slate-400" },
  3: { medal: "🥉", ring: "ring-4 ring-amber-600",                                          size: "h-14 w-14", zIndex: "z-0", order: "order-3", yOffset: "translate-y-2",  labelBg: "bg-amber-700/20 border border-amber-700/40",  labelText: "text-amber-600" },
}

function Avatar({ entry, size = "h-12 w-12", frameOverride }: { entry: LeaderboardEntry; size?: string; frameOverride?: string }) {
  const frameClasses = (entry.equippedFrame ? (FRAME_RING_CLASSES[entry.equippedFrame] ?? "") : "") || (frameOverride ?? "")
  const avatarItem = entry.equippedAvatar ? STORE_ITEMS.find(i => i.id === entry.equippedAvatar) : null
  return (
    <div className={`rounded-full ${frameClasses}`}>
      <div className={`flex ${size} items-center justify-center rounded-full bg-primary/10 text-primary font-bold overflow-hidden`}>
        {avatarItem?.imagePath
          ? <img src={avatarItem.imagePath} alt="" className="h-full w-full object-cover" />
          : (entry.name[0] ?? "?").toUpperCase()}
      </div>
    </div>
  )
}

// ── Podium (top 3) ─────────────────────────────────────────────────────────────

function PodiumCard({ entry, onSelect }: { entry: LeaderboardEntry; onSelect: () => void }) {
  const s = PODIUM_STYLES[entry.rank]
  const titleLabel = entry.equippedTitle ? (TITLE_LABELS[entry.equippedTitle] ?? null) : null

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-2 ${s.order} ${s.zIndex} group`}
    >
      {/* Medal */}
      <span className="text-2xl">{s.medal}</span>

      {/* Avatar */}
      <div className={`${s.yOffset} transition-transform duration-200 group-hover:scale-105`}>
        <Avatar entry={entry} size={s.size} />
      </div>

      {/* Name + title */}
      <div className="max-w-[90px] text-center">
        <p className="truncate text-sm font-bold text-foreground leading-tight">{entry.name}</p>
        {titleLabel && (
          <p className="truncate text-[10px] text-primary mt-0.5">{titleLabel}</p>
        )}
      </div>

      {/* NP badge */}
      <div className={`rounded-xl px-2.5 py-1 text-xs font-bold tabular-nums ${s.labelBg} ${s.labelText}`}>
        {formatNP(entry.np)} NP
      </div>

      {/* Accuracy */}
      {entry.accuracy > 0 && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
          🎯 {entry.accuracy}%
        </p>
      )}
    </button>
  )
}

// ── List row (rank 4+) ─────────────────────────────────────────────────────────

function ListRow({ entry, isViewer, onSelect }: { entry: LeaderboardEntry; isViewer: boolean; onSelect: () => void }) {
  const highlightCls = entry.equippedHighlight ? (HIGHLIGHT_ROW_CLASSES[entry.equippedHighlight] ?? "") : ""
  const titleLabel   = entry.equippedTitle ? (TITLE_LABELS[entry.equippedTitle] ?? null) : null

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-muted/60 ${isViewer ? "ring-2 ring-primary/40 bg-primary/5" : ""} ${highlightCls}`}
    >
      {/* Rank */}
      <span className="w-7 shrink-0 text-center text-sm font-bold text-muted-foreground tabular-nums">
        {entry.rank}
      </span>

      {/* Avatar (small) */}
      <Avatar entry={entry} size="h-10 w-10" />

      {/* Name + title */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">
          {entry.name}
          {isViewer && <span className="ml-1.5 text-[10px] text-primary font-bold">(you)</span>}
        </p>
        {titleLabel && (
          <p className="truncate text-[10px] text-muted-foreground">{titleLabel}</p>
        )}
      </div>

      {/* Accuracy tie-breaker */}
      {entry.accuracy > 0 && !entry.accuracySuppressed && (
        <span className="shrink-0 text-xs text-muted-foreground flex items-center gap-0.5">
          🎯 {entry.accuracy}%
        </span>
      )}

      {/* NP */}
      <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
        {formatNP(entry.np)} NP
      </span>
    </button>
  )
}

// ── Pinned viewer row ──────────────────────────────────────────────────────────

function PinnedViewerRow({ entry, tab, onSelect }: { entry: LeaderboardEntry; tab: string; onSelect: () => void }) {
  return (
    <div className="fixed bottom-16 left-0 right-0 z-30 flex justify-center px-3 pointer-events-none md:bottom-0">
      <div className="w-full max-w-2xl pointer-events-auto">
        <button
          type="button"
          onClick={onSelect}
          className="flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 backdrop-blur-md px-4 py-3 text-left shadow-lg ring-2 ring-primary/30"
        >
          <span className="w-7 shrink-0 text-center text-sm font-bold text-primary tabular-nums">
            {entry.rank > 50 ? "50+" : `#${entry.rank}`}
          </span>
          <Avatar entry={entry} size="h-10 w-10" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {entry.name} <span className="text-[10px] text-primary font-bold">(you)</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              {tab === "weekly" ? "Your weekly rank" : "Your all-time rank"}
            </p>
          </div>
          {entry.accuracy > 0 && !entry.accuracySuppressed && (
            <span className="shrink-0 text-xs text-muted-foreground flex items-center gap-0.5">
              🎯 {entry.accuracy}%
            </span>
          )}
          <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
            {formatNP(entry.np)} NP
          </span>
        </button>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function LeaderboardScreen() {
  const { user } = useApp()

  const [tab, setTab]           = useState<"alltime" | "weekly">("alltime")
  const [entries, setEntries]   = useState<LeaderboardEntry[]>([])
  const [viewerEntry, setViewerEntry] = useState<LeaderboardEntry | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null)

  const fetchData = useCallback(async (t: "alltime" | "weekly") => {
    setLoading(true)
    setError(null)
    try {
      const uid  = user?.role === "user" ? user.uid : ""
      const res  = await fetch(`/api/leaderboard?tab=${t}${uid ? `&uid=${encodeURIComponent(uid)}` : ""}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setEntries(data.entries ?? [])
      setViewerEntry(data.viewerEntry ?? null)
    } catch {
      setError("Could not load the leaderboard. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [user?.uid, user?.role])

  useEffect(() => { fetchData(tab) }, [tab, fetchData])

  const top3 = entries.slice(0, 3)
  const rest  = entries.slice(3)

  const viewerInTop10 = viewerEntry && viewerEntry.rank <= 10
  const showPinned    = viewerEntry && !viewerInTop10 && !loading && !error

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-32 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            🏆 Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tab === "alltime" ? "Ranked by all-time Nexus Points" : "Ranked by NP earned in the last 7 days"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => fetchData(tab)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
          title="Refresh"
        >
          <RefreshCwIcon size={14} />
        </button>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center gap-1 rounded-2xl bg-muted p-1 w-fit">
        {(["alltime", "weekly"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all duration-200 ${
              tab === t
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "alltime" ? "All-Time" : "This Week"}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {/* Podium skeleton */}
          <div className="flex items-end justify-center gap-6 py-8">
            {[2, 1, 3].map(i => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className={`rounded-full bg-muted animate-pulse ${i === 1 ? "h-20 w-20" : i === 2 ? "h-16 w-16" : "h-14 w-14"}`} />
                <div className="h-3 w-16 rounded-full bg-muted animate-pulse" />
                <div className="h-5 w-14 rounded-xl bg-muted animate-pulse" />
              </div>
            ))}
          </div>
          {/* List skeleton */}
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => fetchData(tab)}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="text-5xl">🏆</span>
          <p className="font-semibold text-foreground">No rankings yet</p>
          <p className="text-sm text-muted-foreground">
            {tab === "weekly"
              ? "No one has earned NP this week. Be the first!"
              : "Start earning Nexus Points to appear here."}
          </p>
        </div>
      )}

      {/* Content */}
      {!loading && !error && entries.length > 0 && (
        <div className="space-y-6">
          {/* Podium — top 3 */}
          {top3.length > 0 && (
            <div className="rounded-3xl border border-border bg-card px-4 py-8">
              <div className="flex items-end justify-center gap-6">
                {top3.map(e => (
                  <PodiumCard key={e.uid} entry={e} onSelect={() => setSelected(e)} />
                ))}
              </div>
            </div>
          )}

          {/* Weekly minimum volume notice */}
          {tab === "weekly" && (
            <p className="text-center text-xs text-muted-foreground">
              🎯 Accuracy is hidden until 50 questions are answered this week.
            </p>
          )}

          {/* Ranks 4–50 */}
          {rest.length > 0 && (
            <div className="space-y-1">
              {rest.map(e => (
                <ListRow
                  key={e.uid}
                  entry={e}
                  isViewer={e.uid === user?.uid}
                  onSelect={() => setSelected(e)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pinned viewer row (not in top 10) */}
      {showPinned && viewerEntry && (
        <PinnedViewerRow entry={viewerEntry} tab={tab} onSelect={() => setSelected(viewerEntry)} />
      )}

      {/* Public profile modal */}
      {selected && (
        <PublicProfileModal entry={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
