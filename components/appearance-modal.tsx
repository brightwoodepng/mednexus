"use client"

/**
 * AppearanceModal — Appearance settings panel housed inside a GlassCard.
 *
 * Structure:
 *   • Custom backdrop (blur + dim overlay)
 *   • GlassCard dialog panel (auto-adapts glass ↔ solid from global state)
 *     ├─ Sticky header  — "Appearance" title + X close button
 *     ├─ Subtitle
 *     ├─ Liquid Glass full-width toggle card
 *     ├─ Light themes grid  (Clinical Light, Ocean Breeze, Sandstone, Rose Quartz, Solar Flare)
 *     └─ Dark themes grid   (Classic Dark, Midnight Purple)
 */

import { useEffect } from "react"
import { GlassCard } from "@/components/ui/glass-card"
import { useTheme } from "@/contexts/theme-context"
import { THEMES, type ThemeId, type ThemeMeta } from "@/lib/themes"
import { XIcon, CheckIcon, SparklesIcon } from "@/components/icons"
import { cn } from "@/lib/utils"

// ── Theme subsets ─────────────────────────────────────────────────────────────

const LIGHT_IDS: ThemeId[] = [
  "clinical-light",
  "ocean-breeze",
  "sandstone",
  "rose-quartz",
  "solar-flare",
]
const DARK_IDS: ThemeId[] = ["classic-dark", "midnight-purple", "forest-night", "nebula"]

const LIGHT_THEMES = THEMES.filter((t) => LIGHT_IDS.includes(t.id))
const DARK_THEMES = THEMES.filter((t) => DARK_IDS.includes(t.id))

// ── Props ─────────────────────────────────────────────────────────────────────

interface AppearanceModalProps {
  open: boolean
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AppearanceModal({ open, onClose }: AppearanceModalProps) {
  const { activeTheme, setActiveTheme, isGlassEnabled, setIsGlassEnabled } =
    useTheme()

  // Escape key + scroll lock
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Appearance"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in"
      />

      {/* ── GlassCard panel ───────────────────────────────────────────────── */}
      <GlassCard className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-border animate-ios-sheet">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border px-6 py-4 backdrop-blur-md bg-card/70">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6">
          {/* Subtitle */}
          <p className="mb-6 text-sm text-muted-foreground">
            Choose a theme and visual style. Changes apply instantly and are saved
            on this device.
          </p>

          {/* ── Liquid Glass toggle ─────────────────────────────────────────── */}
          <div className="mb-6 overflow-hidden rounded-2xl border border-border">
            <button
              type="button"
              onClick={() => setIsGlassEnabled(!isGlassEnabled)}
              className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/30"
            >
              {/* Liquid Glass icon */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border bg-primary/10 text-primary shadow-sm">
                <SparklesIcon size={28} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Liquid Glass</p>
                  {isGlassEnabled && (
                    <ActiveBadge />
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  Frosted glass sidebar and cards — works with any theme.
                </p>
              </div>

              {/* Toggle switch */}
              <ToggleSwitch on={isGlassEnabled} />
            </button>
          </div>

          {/* ── Theme grids ─────────────────────────────────────────────────── */}
          <ThemeSection
            label="☀️  Light"
            themes={LIGHT_THEMES}
            active={activeTheme}
            onSelect={setActiveTheme}
          />
          <ThemeSection
            label="🌙  Dark"
            themes={DARK_THEMES}
            active={activeTheme}
            onSelect={setActiveTheme}
          />
        </div>
      </GlassCard>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Three overlapping circles showing bg → surface → primary. */
function ThemeCircles({ swatch }: { swatch: ThemeMeta["swatch"] }) {
  return (
    <div className="relative h-12 w-14 shrink-0">
      {/* bg — largest, leftmost */}
      <div
        className="absolute left-0 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full border-2 border-white/25 shadow-sm"
        style={{ background: swatch.bg }}
      />
      {/* surface — medium, overlapping centre */}
      <div
        className="absolute left-[14px] top-1/2 h-9 w-9 -translate-y-1/2 rounded-full border-2 border-white/25 shadow-sm"
        style={{ background: swatch.surface }}
      />
      {/* primary — smallest, rightmost */}
      <div
        className="absolute right-0 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full border-2 border-white/30 shadow"
        style={{ background: swatch.primary }}
      />
    </div>
  )
}


/** "On" badge shown next to an active item label. */
function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      <CheckIcon size={10} /> On
    </span>
  )
}

/** Animated toggle pill. */
function ToggleSwitch({ on }: { on: boolean }) {
  return (
    <div
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200",
        on ? "bg-primary" : "bg-muted-foreground/30",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
          on ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </div>
  )
}

/** Labelled grid of theme cards. */
function ThemeSection({
  label,
  themes,
  active,
  onSelect,
}: {
  label: string
  themes: ThemeMeta[]
  active: ThemeId
  onSelect: (id: ThemeId) => void
}) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {themes.map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            isActive={active === t.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

/** Single selectable theme card with overlapping-circles preview. */
function ThemeCard({
  theme,
  isActive,
  onSelect,
}: {
  theme: ThemeMeta
  isActive: boolean
  onSelect: (id: ThemeId) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className={cn(
        "group flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all",
        isActive
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border hover:border-primary/40 hover:bg-muted/40",
      )}
    >
      {/* Overlapping circles preview */}
      <ThemeCircles swatch={theme.swatch} />

      {/* Text */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold">{theme.name}</h3>
          {isActive && <ActiveBadge />}
        </div>
        <p className="mt-0.5 text-pretty text-xs leading-snug text-muted-foreground">
          {theme.description}
        </p>
      </div>

      {/* Checkmark (active only) */}
      {isActive && (
        <div className="shrink-0 text-primary">
          <CheckIcon size={16} />
        </div>
      )}
    </button>
  )
}
