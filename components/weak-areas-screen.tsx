"use client"

import { useState, useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import {
  getWeakModulesForMode,
  getWeakDisciplinesForModule,
  getWeakCountForModule,
  getModuleQuestionCount,
} from "@/lib/modules"
import {
  ActivityIcon,
  ChevronLeftIcon,
  GraduationCapIcon,
  ArrowRightIcon,
  ZapIcon,
  TimerIcon,
} from "@/components/icons"
import type { HistoryEntry } from "@/lib/types"

interface QuizReadyConfig {
  module: string
  discipline: string | null
}

interface WeakAreasScreenProps {
  onReadyForQuiz: (config: QuizReadyConfig) => void
}

const TRIAL_PALETTES = [
  { ring: "hover:ring-rose-400/50",    icon: "bg-rose-100 text-rose-600",      bar: "#f43f5e" },
  { ring: "hover:ring-pink-400/50",    icon: "bg-pink-100 text-pink-600",      bar: "#ec4899" },
  { ring: "hover:ring-fuchsia-400/50", icon: "bg-fuchsia-100 text-fuchsia-600", bar: "#d946ef" },
  { ring: "hover:ring-red-400/50",     icon: "bg-red-100 text-red-600",        bar: "#ef4444" },
  { ring: "hover:ring-orange-400/50",  icon: "bg-orange-100 text-orange-600",  bar: "#f97316" },
  { ring: "hover:ring-rose-300/50",    icon: "bg-rose-50 text-rose-500",       bar: "#fb7185" },
]

const EXAM_PALETTES = [
  { ring: "hover:ring-amber-400/50",   icon: "bg-amber-100 text-amber-600",    bar: "#f59e0b" },
  { ring: "hover:ring-yellow-400/50",  icon: "bg-yellow-100 text-yellow-600",  bar: "#eab308" },
  { ring: "hover:ring-orange-400/50",  icon: "bg-orange-100 text-orange-600",  bar: "#f97316" },
  { ring: "hover:ring-amber-500/50",   icon: "bg-amber-200 text-amber-700",    bar: "#d97706" },
  { ring: "hover:ring-yellow-500/50",  icon: "bg-yellow-200 text-yellow-700",  bar: "#ca8a04" },
  { ring: "hover:ring-orange-500/50",  icon: "bg-orange-200 text-orange-700",  bar: "#ea580c" },
]

export function WeakAreasScreen({ onReadyForQuiz }: WeakAreasScreenProps) {
  const { progress } = useApp()
  const [mode, setMode] = useState<"trial" | "exam">("trial")
  const [viewingModule, setViewingModule] = useState<string | null>(null)

  const palettes = mode === "trial" ? TRIAL_PALETTES : EXAM_PALETTES
  const prefix = mode === "trial" ? "__weak_trial__|" : "__weak_exam__|"

  const weakModules = useMemo(
    () => getWeakModulesForMode(progress.history, mode),
    [progress.history, mode],
  )

  const totalWeak = useMemo(
    () => weakModules.reduce((sum, mod) => sum + getWeakCountForModule(progress.history, mode, mod), 0),
    [progress.history, mode, weakModules],
  )

  function switchMode(next: "trial" | "exam") {
    setMode(next)
    setViewingModule(null)
  }

  if (viewingModule) {
    return (
      <WeakModuleDisciplineView
        moduleName={viewingModule}
        mode={mode}
        history={progress.history}
        palettes={palettes}
        onBack={() => setViewingModule(null)}
        onSelectDiscipline={(disc) =>
          onReadyForQuiz({ module: `${prefix}${viewingModule}`, discipline: disc })
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm">
            <ActivityIcon size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Weak Areas</h1>
            <p className="text-xs text-muted-foreground">
              {totalWeak > 0
                ? `${totalWeak} question${totalWeak !== 1 ? "s" : ""} to review · ${mode} mode`
                : `No weak areas in ${mode} mode yet`}
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="ml-auto flex items-center rounded-xl border border-border bg-muted p-0.5">
          <button
            type="button"
            onClick={() => switchMode("trial")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === "trial"
                ? "bg-rose-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ZapIcon size={12} />
            Trial
          </button>
          <button
            type="button"
            onClick={() => switchMode("exam")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              mode === "exam"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TimerIcon size={12} />
            Exam
          </button>
        </div>
      </div>

      {/* Empty state */}
      {weakModules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20 text-center">
          <ActivityIcon size={40} className="mb-4 text-muted-foreground/25" />
          <p className="text-sm font-medium text-muted-foreground">
            No weak areas in {mode} mode
          </p>
          <p className="mt-1.5 max-w-xs text-xs text-muted-foreground/70 leading-relaxed">
            {mode === "trial"
              ? "Answer trial questions and any you get wrong will appear here for focused review."
              : "Complete exam sessions and questions you miss will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {weakModules.map((mod, i) => {
            const palette = palettes[i % palettes.length]
            const weakCount = getWeakCountForModule(progress.history, mode, mod)
            const totalCount = getModuleQuestionCount(mod)
            const pct = totalCount > 0 ? Math.round((weakCount / totalCount) * 100) : 0

            return (
              <div
                key={mod}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-0 transition-all hover:shadow-md hover:ring-2 active:scale-[0.98] ${palette.ring}`}
              >
                <div
                  className="pointer-events-none absolute left-0 right-0 top-0 h-1 opacity-80"
                  style={{ background: palette.bar }}
                />
                <div className="p-5">
                  <div className="mb-3 mt-1 flex items-start justify-between gap-2">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${palette.icon}`}>
                      <ActivityIcon size={18} />
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                      style={{ background: `${palette.bar}20`, color: palette.bar }}
                    >
                      {weakCount} to review
                    </span>
                  </div>

                  <h3 className="font-bold text-foreground leading-snug">{mod}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {pct}% of module needs review
                  </p>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: palette.bar }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingModule(mod)}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all"
                    style={{ background: `${palette.bar}18`, color: palette.bar }}
                  >
                    Review Module
                    <ArrowRightIcon size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Discipline drill-down ─────────────────────────────────────────────────────
function WeakModuleDisciplineView({
  moduleName,
  mode,
  history,
  palettes,
  onBack,
  onSelectDiscipline,
}: {
  moduleName: string
  mode: "trial" | "exam"
  history: HistoryEntry[]
  palettes: typeof TRIAL_PALETTES
  onBack: () => void
  onSelectDiscipline: (discipline: string | null) => void
}) {
  const weakDisciplines = getWeakDisciplinesForModule(history, mode, moduleName)
  const totalWeak = getWeakCountForModule(history, mode, moduleName)
  const primaryPalette = palettes[0]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeftIcon size={15} />
          Back
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold tracking-tight">{moduleName}</h2>
          <p className="text-sm text-muted-foreground">
            {totalWeak} weak question{totalWeak !== 1 ? "s" : ""} · {mode} mode · {weakDisciplines.length} discipline{weakDisciplines.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {/* All disciplines card */}
        <button
          type="button"
          onClick={() => onSelectDiscipline(null)}
          className="group relative overflow-hidden rounded-2xl border-2 p-5 text-left shadow-sm ring-0 transition-all hover:shadow-md hover:ring-2 active:scale-[0.98]"
          style={{
            borderColor: `${primaryPalette.bar}45`,
            background: `${primaryPalette.bar}0e`,
          }}
        >
          <div className="mb-4 flex items-start justify-between">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: primaryPalette.bar }}
            >
              <GraduationCapIcon size={22} />
            </div>
            <ArrowRightIcon
              size={18}
              className="mt-0.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
              style={{ color: primaryPalette.bar }}
            />
          </div>
          <h3 className="font-bold text-foreground">All Disciplines</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {totalWeak} question{totalWeak !== 1 ? "s" : ""} · all topics
          </p>
        </button>

        {/* Per-discipline cards */}
        {weakDisciplines.map((disc, i) => {
          const dPalette = palettes[i % palettes.length]
          const count = getWeakCountForModule(history, mode, moduleName, disc)

          return (
            <button
              key={disc}
              type="button"
              onClick={() => onSelectDiscipline(disc)}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-sm ring-0 transition-all hover:shadow-md hover:ring-2 active:scale-[0.98] ${dPalette.ring}`}
            >
              <div
                className="pointer-events-none absolute left-0 right-0 top-0 h-1 opacity-80"
                style={{ background: dPalette.bar }}
              />
              <div className="mb-4 flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${dPalette.icon}`}>
                  <GraduationCapIcon size={22} />
                </div>
                <ArrowRightIcon
                  size={18}
                  className="mt-0.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                  style={{ color: dPalette.bar }}
                />
              </div>
              <h3 className="font-bold text-foreground leading-snug">{disc}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {count} weak question{count !== 1 ? "s" : ""}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
