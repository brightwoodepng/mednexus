"use client"

import { StarIcon, LayersIcon, GraduationCapIcon } from "@/components/icons"

// ── Shared palette ────────────────────────────────────────────────────────────
// Single source of truth used by Dashboard, ModuleLibrary, and all drill-downs.

export const CARD_PALETTES = [
  { ring: "hover:ring-rose-400/50",    icon: "bg-rose-100 text-rose-600",      bar: "#f43f5e" },
  { ring: "hover:ring-sky-400/50",     icon: "bg-sky-100 text-sky-600",         bar: "#0ea5e9" },
  { ring: "hover:ring-violet-400/50",  icon: "bg-violet-100 text-violet-600",   bar: "#8b5cf6" },
  { ring: "hover:ring-emerald-400/50", icon: "bg-emerald-100 text-emerald-600", bar: "#10b981" },
  { ring: "hover:ring-amber-400/50",   icon: "bg-amber-100 text-amber-600",     bar: "#f59e0b" },
  { ring: "hover:ring-fuchsia-400/50", icon: "bg-fuchsia-100 text-fuchsia-600", bar: "#d946ef" },
  { ring: "hover:ring-cyan-400/50",    icon: "bg-cyan-100 text-cyan-600",       bar: "#06b6d4" },
  { ring: "hover:ring-orange-400/50",  icon: "bg-orange-100 text-orange-600",   bar: "#f97316" },
]

// ── UniversalModuleCard ───────────────────────────────────────────────────────
// Vertical-stacked card (~103 px tall). Sized so ~4.5 cards are visible on a
// standard phone screen. The entire card surface is the tap target — there is
// no separate "Open Module" button.

interface UniversalModuleCardProps {
  mod: string
  paletteIndex: number
  isFav?: boolean
  subtitle: string          // e.g. "3 disciplines · 42Q"
  pct?: number              // progress 0–100
  onOpen: () => void
  onToggleFav?: (mod: string) => void   // omit to hide the star
}

export function UniversalModuleCard({
  mod,
  paletteIndex,
  isFav = false,
  subtitle,
  pct = 0,
  onOpen,
  onToggleFav,
}: UniversalModuleCardProps) {
  const palette = CARD_PALETTES[paletteIndex % CARD_PALETTES.length]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={`group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-0 cursor-pointer transition-all hover:shadow-md hover:ring-2 active:scale-[0.98] ${palette.ring}`}
    >
      {/* Thin colour top bar */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 h-0.5 opacity-90"
        style={{ background: palette.bar }}
      />

      <div className="px-3.5 py-3">
        {/* Icon row + optional star */}
        <div className="flex items-start justify-between">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${palette.icon}`}>
            <LayersIcon size={16} />
          </div>
          {onToggleFav && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFav(mod) }}
              aria-label={isFav ? "Unstar module" : "Star module"}
              className={`-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                isFav ? "text-amber-400 hover:text-amber-500" : "text-muted-foreground/30 hover:text-amber-400"
              }`}
            >
              <StarIcon size={15} className={isFav ? "fill-amber-400 drop-shadow-sm" : ""} />
            </button>
          )}
        </div>

        {/* Title + subtitle */}
        <div className="mt-2">
          <h3 className="truncate text-sm font-bold leading-tight text-foreground">{mod}</h3>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {/* Progress bar at bottom */}
      {pct > 0 && (
        <div className="h-0.5 w-full overflow-hidden bg-muted">
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: palette.bar }} />
        </div>
      )}
    </div>
  )
}

// ── UniversalDisciplineCard ───────────────────────────────────────────────────
// Same proportions as UniversalModuleCard for visual consistency.

interface UniversalDisciplineCardProps {
  name: string
  subtitle: string
  paletteIndex: number
  pct?: number
  isAllDisciplines?: boolean
  onSelect: () => void
}

export function UniversalDisciplineCard({
  name,
  subtitle,
  paletteIndex,
  pct = 0,
  isAllDisciplines = false,
  onSelect,
}: UniversalDisciplineCardProps) {
  const palette = CARD_PALETTES[paletteIndex % CARD_PALETTES.length]

  if (isAllDisciplines) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="group relative w-full overflow-hidden rounded-xl border-2 border-primary/25 bg-primary/8 text-left shadow-sm ring-0 transition-all hover:border-primary/50 hover:shadow-md hover:ring-2 hover:ring-primary/30 active:scale-[0.98]"
      >
        <div className="px-3.5 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
            <GraduationCapIcon size={16} />
          </div>
          <div className="mt-2">
            <h3 className="text-sm font-bold leading-tight text-foreground">{name}</h3>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm ring-0 transition-all hover:shadow-md hover:ring-2 active:scale-[0.98] ${palette.ring}`}
    >
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 h-0.5 opacity-90"
        style={{ background: palette.bar }}
      />

      <div className="px-3.5 py-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-full ${palette.icon}`}>
          <GraduationCapIcon size={16} />
        </div>
        <div className="mt-2">
          <h3 className="truncate text-sm font-bold leading-tight text-foreground">{name}</h3>
          <p className="mt-0.5 truncate text-[11px] leading-tight text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {pct > 0 && (
        <div className="h-0.5 w-full overflow-hidden bg-muted">
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: palette.bar }} />
        </div>
      )}
    </button>
  )
}
