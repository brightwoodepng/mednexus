"use client"

import { useEffect, useRef } from "react"
import {
  TITLE_LABELS,
  STORE_ITEMS,
  CLINICAL_TIERS,
  getClinicalTierIndex,
} from "@/lib/economy"
import { XIcon } from "@/components/icons"
import { CosmeticFrame } from "@/components/cosmetics"

export interface LeaderboardEntry {
  rank: number
  uid: string
  name: string
  level: string
  classLevel: string
  np: number
  rankPoints?: number
  accuracy: number
  weeklyQuestions?: number | null
  accuracySuppressed?: boolean
  equippedTitle: string | null
  equippedFrame: string | null
  equippedHighlight: string | null
  equippedAvatar: string | null
}

interface PublicProfileModalProps {
  entry: LeaderboardEntry
  npLabel?: string
  onClose: () => void
}

const MEDAL: Record<number, { label: string; color: string }> = {
  1: { label: "🥇", color: "text-yellow-400" },
  2: { label: "🥈", color: "text-slate-400" },
  3: { label: "🥉", color: "text-amber-600" },
}

function formatNP(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function PublicProfileModal({ entry, npLabel = "Lifetime NP", onClose }: PublicProfileModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  const avatarItem   = entry.equippedAvatar ? STORE_ITEMS.find(i => i.id === entry.equippedAvatar) : null
  const titleLabel   = entry.equippedTitle  ? (TITLE_LABELS[entry.equippedTitle] ?? null) : null

  const tierIdx  = getClinicalTierIndex(entry.rankPoints ?? 0)
  const tierName = CLINICAL_TIERS[tierIdx].name

  const medal = MEDAL[entry.rank]

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Header gradient band */}
        <div className="relative bg-gradient-to-br from-primary/80 to-primary px-6 pt-8 pb-16 text-primary-foreground">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
          >
            <XIcon size={15} />
          </button>

          {medal && (
            <div className="absolute left-5 top-5 text-3xl">{medal.label}</div>
          )}

          {/* Rank badge */}
          <div className="absolute right-16 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
            #{entry.rank}
          </div>
        </div>

        {/* Avatar — overlaps the header */}
        <div className="relative -mt-12 flex justify-center">
          <CosmeticFrame cosmeticId={entry.equippedFrame} size="profile" className="rounded-full p-0.5 bg-card">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-4xl font-bold text-primary overflow-hidden shadow-lg">
              {avatarItem?.imagePath ? (
                <img src={avatarItem.imagePath} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                (entry.name[0] ?? "?").toUpperCase()
              )}
            </div>
          </CosmeticFrame>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 pt-3 text-center space-y-4">
          {/* Name + title */}
          <div>
            <h2 className="text-xl font-bold text-foreground">{entry.name}</h2>
            {titleLabel && (
              <p className="mt-0.5 text-sm font-medium text-primary">{titleLabel}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">{tierName}</p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-muted px-2 py-3 text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">{formatNP(entry.np)}</p>
              <p className="text-[10px] text-muted-foreground">{npLabel}</p>
            </div>
            <div className="rounded-2xl bg-muted px-2 py-3 text-center">
              <p className="truncate text-sm font-bold text-foreground">{entry.rankPoints === undefined ? `#${entry.rank}` : tierName}</p>
              <p className="text-[10px] text-muted-foreground">{entry.rankPoints === undefined ? "Leaderboard Place" : "Clinical Rank"}</p>
            </div>
            <div className="rounded-2xl bg-muted px-2 py-3 text-center">
              <p className="text-lg font-bold text-foreground tabular-nums">
                {entry.accuracySuppressed ? (
                  <span className="text-muted-foreground text-sm">—</span>
                ) : (
                  `${entry.accuracy}%`
                )}
              </p>
              <p className="text-[10px] text-muted-foreground">Accuracy</p>
            </div>
          </div>

          {/* Class / level badges */}
          <div className="flex flex-wrap justify-center gap-2">
            {entry.classLevel && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {entry.classLevel}
              </span>
            )}
            {entry.level && entry.level !== entry.classLevel && (
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {entry.level}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
