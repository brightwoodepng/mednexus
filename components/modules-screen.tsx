"use client"

import { useState, useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import {
  getModules,
  getDisciplinesForModule,
  getModuleQuestionCount,
  getDisciplineCoverage,
  getQuestionsForModuleAndDiscipline,
} from "@/lib/modules"
import {
  LayersIcon,
  ArrowRightIcon,
  GraduationCapIcon,
  StarIcon,
  SearchIcon,
  ChevronDownIcon,
} from "@/components/icons"

interface QuizReadyConfig {
  module: string
  discipline: string | null
}

interface ModulesScreenProps {
  onReadyForQuiz: (config: QuizReadyConfig) => void
  initialModule?: string | null
}

const MODULE_COLORS = [
  { bar: "#f43f5e", bg: "bg-rose-500",    light: "bg-rose-50 dark:bg-rose-900/20",    border: "border-rose-200 dark:border-rose-800/40",    text: "text-rose-600 dark:text-rose-400"    },
  { bar: "#0ea5e9", bg: "bg-sky-500",     light: "bg-sky-50 dark:bg-sky-900/20",      border: "border-sky-200 dark:border-sky-800/40",      text: "text-sky-600 dark:text-sky-400"      },
  { bar: "#8b5cf6", bg: "bg-violet-500",  light: "bg-violet-50 dark:bg-violet-900/20",border: "border-violet-200 dark:border-violet-800/40",text: "text-violet-600 dark:text-violet-400" },
  { bar: "#10b981", bg: "bg-emerald-500", light: "bg-emerald-50 dark:bg-emerald-900/20",border: "border-emerald-200 dark:border-emerald-800/40",text: "text-emerald-600 dark:text-emerald-400"},
  { bar: "#f59e0b", bg: "bg-amber-500",   light: "bg-amber-50 dark:bg-amber-900/20",  border: "border-amber-200 dark:border-amber-800/40",  text: "text-amber-600 dark:text-amber-400"  },
  { bar: "#d946ef", bg: "bg-fuchsia-500", light: "bg-fuchsia-50 dark:bg-fuchsia-900/20",border:"border-fuchsia-200 dark:border-fuchsia-800/40",text:"text-fuchsia-600 dark:text-fuchsia-400"},
  { bar: "#06b6d4", bg: "bg-cyan-500",    light: "bg-cyan-50 dark:bg-cyan-900/20",    border: "border-cyan-200 dark:border-cyan-800/40",    text: "text-cyan-600 dark:text-cyan-400"    },
  { bar: "#f97316", bg: "bg-orange-500",  light: "bg-orange-50 dark:bg-orange-900/20",border: "border-orange-200 dark:border-orange-800/40",text: "text-orange-600 dark:text-orange-400" },
]

export function ModulesScreen({ onReadyForQuiz, initialModule }: ModulesScreenProps) {
  const { progress, toggleFavoriteModule } = useApp()
  const [openModule, setOpenModule] = useState<string | null>(initialModule ?? null)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<"az" | "za" | "most" | "starred">("starred")

  const modules = getModules()
  const coverage = getDisciplineCoverage(progress.history)
  const favorites = progress.favoriteModules ?? []

  const filtered = useMemo(() => {
    let list = modules
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((m) => m.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (sort === "az") return a.localeCompare(b)
      if (sort === "za") return b.localeCompare(a)
      if (sort === "most") return getModuleQuestionCount(b) - getModuleQuestionCount(a)
      const aFav = favorites.includes(a) ? 0 : 1
      const bFav = favorites.includes(b) ? 0 : 1
      return aFav - bFav || a.localeCompare(b)
    })
  }, [modules, favorites, sort, search])

  function toggle(mod: string) {
    setOpenModule((prev) => (prev === mod ? null : mod))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <LayersIcon size={18} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Study Modules</h1>
            <p className="text-xs text-muted-foreground">{modules.length} modules available</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 rounded-lg border border-border bg-card pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 w-32"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="starred">Starred First</option>
            <option value="az">A → Z</option>
            <option value="za">Z → A</option>
            <option value="most">Most Questions</option>
          </select>
        </div>
      </div>

      {/* Accordion list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-14 text-center">
          <LayersIcon size={32} className="mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No modules match your search</p>
          <button type="button" onClick={() => setSearch("")} className="mt-2 text-xs text-primary hover:underline">
            Clear search
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {filtered.map((mod, listIndex) => {
            const colorIdx = modules.indexOf(mod) % MODULE_COLORS.length
            const color = MODULE_COLORS[colorIdx]
            const total = getModuleQuestionCount(mod)
            const disciplines = getDisciplinesForModule(mod)
            const isFav = favorites.includes(mod)
            const isOpen = openModule === mod
            const isLast = listIndex === filtered.length - 1

            const attempted = disciplines.reduce((sum, d) => sum + (coverage[d]?.attempted ?? 0), 0)
            const pct = total > 0 ? Math.round((attempted / total) * 100) : 0

            return (
              <div key={mod} className={!isLast ? "border-b border-border" : ""}>
                {/* Module row (accordion trigger) */}
                <div className={`flex items-center gap-0 transition-colors ${isOpen ? "bg-muted/40" : "hover:bg-muted/30"}`}>
                  {/* Color accent bar */}
                  <div className="w-1 self-stretch shrink-0 rounded-l-none" style={{ background: color.bar }} />

                  {/* Main button */}
                  <button
                    type="button"
                    onClick={() => toggle(mod)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left"
                    aria-expanded={isOpen}
                  >
                    <ChevronDownIcon
                      size={16}
                      className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{mod}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{disciplines.length} discipline{disciplines.length !== 1 ? "s" : ""}</span>
                        <span>·</span>
                        <span>{total}Q</span>
                        {pct > 0 && (
                          <>
                            <span>·</span>
                            <span>{pct}% done</span>
                          </>
                        )}
                      </span>
                    </span>
                  </button>

                  {/* Star button */}
                  <button
                    type="button"
                    onClick={() => toggleFavoriteModule(mod)}
                    aria-label={isFav ? "Unstar module" : "Star module"}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors mr-1 ${
                      isFav ? "text-amber-400" : "text-muted-foreground/30 hover:text-amber-400"
                    }`}
                  >
                    <StarIcon size={15} className={isFav ? "fill-amber-400" : ""} />
                  </button>
                </div>

                {/* Progress bar (shown always, under row) */}
                {pct > 0 && !isOpen && (
                  <div className="mx-5 mb-2 h-0.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color.bar }} />
                  </div>
                )}

                {/* Expanded disciplines */}
                {isOpen && (
                  <div className="border-t border-border bg-background/50">
                    {/* All disciplines option */}
                    <DisciplineRow
                      label="All Disciplines"
                      sublabel={`${total} questions · all topics`}
                      icon={<GraduationCapIcon size={16} />}
                      iconBg="bg-primary text-primary-foreground"
                      pct={pct}
                      barColor={color.bar}
                      onClick={() => onReadyForQuiz({ module: mod, discipline: null })}
                      isFirst
                    />

                    {disciplines.map((disc, di) => {
                      const dColor = MODULE_COLORS[di % MODULE_COLORS.length]
                      const cov = coverage[disc]
                      const dTotal = getQuestionsForModuleAndDiscipline(mod, disc).length
                      const dPct = cov && cov.total > 0 ? Math.round((cov.attempted / cov.total) * 100) : 0
                      return (
                        <DisciplineRow
                          key={disc}
                          label={disc}
                          sublabel={`${dTotal} question${dTotal !== 1 ? "s" : ""}${dPct > 0 ? ` · ${dPct}% done` : ""}`}
                          icon={<LayersIcon size={14} />}
                          iconBg={`${dColor.light} ${dColor.text}`}
                          pct={dPct}
                          barColor={dColor.bar}
                          onClick={() => onReadyForQuiz({ module: mod, discipline: disc })}
                        />
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DisciplineRow({
  label,
  sublabel,
  icon,
  iconBg,
  pct,
  barColor,
  onClick,
  isFirst = false,
}: {
  label: string
  sublabel: string
  icon: React.ReactNode
  iconBg: string
  pct: number
  barColor: string
  onClick: () => void
  isFirst?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted ${!isFirst ? "border-t border-border/50" : ""}`}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
        {pct > 0 && (
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
          </div>
        )}
      </div>
      <ArrowRightIcon
        size={15}
        className="shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground"
      />
    </button>
  )
}
