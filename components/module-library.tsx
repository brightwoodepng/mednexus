"use client"

import { useState, useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import {
  getLiveModules,
  getDisciplinesForModule,
  getModuleQuestionCount,
  getDisciplineCoverage,
  getQuestionsForModuleAndDiscipline,
  getQuestionsForModule,
} from "@/lib/modules"
import {
  LayersIcon,
  GraduationCapIcon,
  ChevronLeftIcon,
  SearchIcon,
  DownloadIcon,
} from "@/components/icons"
import { CARD_PALETTES, UniversalModuleCard, UniversalDisciplineCard } from "@/components/shared-cards"

// ── Types ────────────────────────────────────────────────────────────────────

interface QuizReadyConfig {
  module: string
  discipline: string | null
}

interface ModuleLibraryProps {
  onReadyForQuiz: (config: QuizReadyConfig) => void
  initialModule?: string | null
}

type ViewMode = "module" | "discipline"
type SortKey  = "az" | "most" | "starred"

// ── Sort cycle config ─────────────────────────────────────────────────────────

const MODULE_SORT_CYCLE:     SortKey[] = ["starred", "az", "most"]
const DISCIPLINE_SORT_CYCLE: SortKey[] = ["az", "most"]
const SORT_BADGE: Record<SortKey, string> = { starred: "★", az: "A–Z", most: "#Q" }

// ── Inline sort icon ──────────────────────────────────────────────────────────

function SortLinesIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="7"  x2="3"  y2="7"  />
      <line x1="21" y1="12" x2="7"  y2="12" />
      <line x1="21" y1="17" x2="11" y2="17" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ModuleLibrary({ onReadyForQuiz, initialModule }: ModuleLibraryProps) {
  const { progress, toggleFavoriteModule } = useApp()

  const [view,          setView         ] = useState<ViewMode>("module")
  const [viewingModule, setViewingModule ] = useState<string | null>(initialModule ?? null)
  const [search,        setSearch        ] = useState("")
  const [sort,          setSort          ] = useState<SortKey>("starred")

  const modules   = getLiveModules()
  const coverage  = getDisciplineCoverage(progress.history)
  const favorites = progress.favoriteModules ?? []

  // Switch view: always reset search, drill-down, and sort to sensible defaults.
  function switchView(next: ViewMode) {
    setView(next)
    setViewingModule(null)
    setSearch("")
    setSort(next === "discipline" ? "az" : "starred")
  }

  // ── Module-view data ──────────────────────────────────────────────────────

  const filteredModules = useMemo(() => {
    let list = modules
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((m) => m.toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => {
      if (sort === "az")   return a.localeCompare(b)
      if (sort === "most") return getModuleQuestionCount(b) - getModuleQuestionCount(a)
      // "starred" — favourites first, then A→Z
      const aFav = favorites.includes(a) ? 0 : 1
      const bFav = favorites.includes(b) ? 0 : 1
      return aFav - bFav || a.localeCompare(b)
    })
  }, [modules, favorites, sort, search])

  // ── Discipline-view data ──────────────────────────────────────────────────
  // Flat list: one entry per (module, discipline) pair.
  // moduleIndex is the position of the parent module in getLiveModules() — used
  // to keep the palette colour consistent with the module view.

  const allDisciplines = useMemo(() => {
    type DisciplineEntry = {
      discipline:  string
      module:      string
      moduleIndex: number
      total:       number
    }
    const result: DisciplineEntry[] = []
    modules.forEach((mod, modIdx) => {
      getDisciplinesForModule(mod).forEach((disc) => {
        result.push({
          discipline:  disc,
          module:      mod,
          moduleIndex: modIdx,
          total:       getQuestionsForModuleAndDiscipline(mod, disc).length,
        })
      })
    })
    return result
  }, [modules])

  const filteredDisciplines = useMemo(() => {
    let list = allDisciplines
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (d) => d.discipline.toLowerCase().includes(q) || d.module.toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) =>
      sort === "most"
        ? b.total - a.total
        : a.discipline.localeCompare(b.discipline),
    )
  }, [allDisciplines, sort, search])

  // ── Drill-down: module → discipline list ──────────────────────────────────

  if (view === "module" && viewingModule) {
    return (
      <ModuleDrillDown
        module={viewingModule}
        coverage={coverage}
        onBack={() => setViewingModule(null)}
        onSelectDiscipline={(disc) => onReadyForQuiz({ module: viewingModule, discipline: disc })}
      />
    )
  }

  // ── Shared values for the header ──────────────────────────────────────────

  const isEmpty = view === "module"
    ? filteredModules.length === 0
    : filteredDisciplines.length === 0

  // Cycle sort through the valid options for the current view
  function cycleSort() {
    const cycle = view === "module" ? MODULE_SORT_CYCLE : DISCIPLINE_SORT_CYCLE
    const idx = cycle.indexOf(sort)
    setSort(cycle[(idx + 1) % cycle.length])
  }

  return (
    <div className="mx-auto max-w-md space-y-3">

      {/* ── Row 1: Compact title ── */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <LayersIcon size={16} />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold tracking-tight leading-tight">Module Library</h1>
          <p className="text-[11px] leading-none text-muted-foreground">
            {view === "module"
              ? `${modules.length} module${modules.length !== 1 ? "s" : ""}`
              : `${allDisciplines.length} discipline${allDisciplines.length !== 1 ? "s" : ""} across ${modules.length} module${modules.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* ── Row 2: Full-width segmented toggle ── */}
      <div className="flex rounded-xl border border-border bg-muted p-0.5">
        <button
          type="button"
          onClick={() => switchView("module")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
            view === "module"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayersIcon size={12} />
          By Module
        </button>
        <button
          type="button"
          onClick={() => switchView("discipline")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
            view === "discipline"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <GraduationCapIcon size={12} />
          By Discipline
        </button>
      </div>

      {/* ── Row 3: Search + sort icon button ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <SearchIcon
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={view === "module" ? "Search modules…" : "Search disciplines…"}
            className="h-8 w-full rounded-lg border border-border bg-card pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        {/* Sort cycle button — tap to cycle through sort modes */}
        <button
          type="button"
          onClick={cycleSort}
          aria-label={`Sort: ${SORT_BADGE[sort]}`}
          className="flex h-8 w-auto shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <SortLinesIcon size={13} />
          <span className="text-[10px] font-semibold">{SORT_BADGE[sort]}</span>
        </button>
      </div>

      {/* ── List / empty state ── */}
      {isEmpty ? (
        <EmptyState onClear={() => setSearch("")} />
      ) : view === "module" ? (
        <ModuleGrid
          modules={filteredModules}
          allModules={modules}
          coverage={coverage}
          favorites={favorites}
          onOpen={setViewingModule}
          onToggleFav={toggleFavoriteModule}
        />
      ) : (
        <DisciplineGrid
          disciplines={filteredDisciplines}
          coverage={coverage}
          onSelect={(mod, disc) => onReadyForQuiz({ module: mod, discipline: disc })}
        />
      )}
    </div>
  )
}

// ── Module list ───────────────────────────────────────────────────────────────

function ModuleGrid({
  modules,
  allModules,
  coverage,
  favorites,
  onOpen,
  onToggleFav,
}: {
  modules:     string[]
  allModules:  string[]
  coverage:    Record<string, { attempted: number; total: number; correct: number }>
  favorites:   string[]
  onOpen:      (mod: string) => void
  onToggleFav: (mod: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {modules.map((mod) => {
        const total       = getModuleQuestionCount(mod)
        const disciplines = getDisciplinesForModule(mod)
        const isFav       = favorites.includes(mod)
        const attempted   = disciplines.reduce((sum, d) => sum + (coverage[d]?.attempted ?? 0), 0)
        const pct         = total > 0 ? Math.round((attempted / total) * 100) : 0
        return (
          <UniversalModuleCard
            key={mod}
            mod={mod}
            paletteIndex={allModules.indexOf(mod)}
            isFav={isFav}
            subtitle={`${disciplines.length} discipline${disciplines.length !== 1 ? "s" : ""} · ${total}Q`}
            pct={pct}
            onOpen={() => onOpen(mod)}
            onToggleFav={onToggleFav}
          />
        )
      })}
    </div>
  )
}

// ── Discipline list ───────────────────────────────────────────────────────────

function DisciplineGrid({
  disciplines,
  coverage,
  onSelect,
}: {
  disciplines: { discipline: string; module: string; moduleIndex: number; total: number }[]
  coverage:    Record<string, { attempted: number; total: number; correct: number }>
  onSelect:    (module: string, discipline: string) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {disciplines.map(({ discipline, module: mod, moduleIndex, total }) => {
        const cov = coverage[discipline]
        const pct = cov && cov.total > 0 ? Math.round((cov.attempted / cov.total) * 100) : 0
        return (
          <UniversalDisciplineCard
            key={`${mod}::${discipline}`}
            name={discipline}
            subtitle={`${mod} · ${total}Q${pct > 0 ? ` · ${pct}%` : ""}`}
            paletteIndex={moduleIndex}
            pct={pct}
            onSelect={() => onSelect(mod, discipline)}
          />
        )
      })}
    </div>
  )
}

// ── Module drill-down (module → its disciplines) ──────────────────────────────

function ModuleDrillDown({
  module,
  coverage,
  onBack,
  onSelectDiscipline,
}: {
  module:              string
  coverage:            Record<string, { attempted: number; total: number; correct: number }>
  onBack:              () => void
  onSelectDiscipline:  (discipline: string | null) => void
}) {
  const disciplines    = getDisciplinesForModule(module)
  const totalInModule  = getModuleQuestionCount(module)
  const modIndex       = getLiveModules().indexOf(module) % CARD_PALETTES.length
  const palette        = CARD_PALETTES[modIndex]

  function handleExportJSON() {
    const questions = getQuestionsForModule(module)
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `${module.replace(/\s+/g, "-")}-questions.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-md space-y-4">

      {/* Back + module header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
        <div className="order-1 sm:order-2 min-w-0 sm:flex-1">
          <h2 className="truncate text-[25px] sm:text-xl font-bold tracking-tight leading-tight">
            {module}
          </h2>
          <p className="mt-1 text-[15px] sm:text-sm text-muted-foreground">
            {totalInModule} questions · {disciplines.length} discipline{disciplines.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="order-2 sm:order-1 mt-3 sm:mt-0 self-start flex items-center gap-1.5 rounded-full sm:rounded-xl border border-border px-4 sm:px-3 py-2.5 sm:py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeftIcon size={15} />
          Back
        </button>
        <button
          type="button"
          onClick={handleExportJSON}
          disabled={totalInModule === 0}
          className="hidden sm:flex sm:order-3 sm:ml-auto items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <DownloadIcon size={13} />
          Export JSON
        </button>
      </div>

      {/* Discipline list */}
      <div className="flex flex-col gap-2">
        <UniversalDisciplineCard
          name="All Disciplines"
          subtitle={`${totalInModule} questions · all topics`}
          paletteIndex={0}
          isAllDisciplines
          onSelect={() => onSelectDiscipline(null)}
        />
        {disciplines.map((disc, i) => {
          const cov = coverage[disc]
          const pct = cov && cov.total > 0 ? Math.round((cov.attempted / cov.total) * 100) : 0
          return (
            <UniversalDisciplineCard
              key={disc}
              name={disc}
              subtitle={cov ? `${cov.total} questions${pct > 0 ? ` · ${pct}%` : ""}` : "no questions yet"}
              paletteIndex={i}
              pct={pct}
              onSelect={() => onSelectDiscipline(disc)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-14 text-center">
      <LayersIcon size={32} className="mb-3 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">Nothing matches your search</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 text-xs text-primary hover:underline"
      >
        Clear search
      </button>
    </div>
  )
}
