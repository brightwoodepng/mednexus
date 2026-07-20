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
  ArrowRightIcon,
  ChevronLeftIcon,
  StarIcon,
  SearchIcon,
  DownloadIcon,
} from "@/components/icons"

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

// ── Palette ───────────────────────────────────────────────────────────────────
// Keyed by module index so colour is stable and consistent between both views.

const CARD_PALETTES = [
  { ring: "hover:ring-rose-400/50",    icon: "bg-rose-100 text-rose-600",      bar: "#f43f5e" },
  { ring: "hover:ring-sky-400/50",     icon: "bg-sky-100 text-sky-600",         bar: "#0ea5e9" },
  { ring: "hover:ring-violet-400/50",  icon: "bg-violet-100 text-violet-600",   bar: "#8b5cf6" },
  { ring: "hover:ring-emerald-400/50", icon: "bg-emerald-100 text-emerald-600", bar: "#10b981" },
  { ring: "hover:ring-amber-400/50",   icon: "bg-amber-100 text-amber-600",     bar: "#f59e0b" },
  { ring: "hover:ring-fuchsia-400/50", icon: "bg-fuchsia-100 text-fuchsia-600", bar: "#d946ef" },
  { ring: "hover:ring-cyan-400/50",    icon: "bg-cyan-100 text-cyan-600",       bar: "#06b6d4" },
  { ring: "hover:ring-orange-400/50",  icon: "bg-orange-100 text-orange-600",   bar: "#f97316" },
]

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

  return (
    <div className="mx-auto max-w-6xl space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center w-full gap-4 mb-6">

        {/* Left group: Title + View toggle */}
        <div className="flex flex-col md:flex-row md:items-center gap-4">

          {/* Title */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <LayersIcon size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Module Library</h1>
              <p className="text-xs text-muted-foreground">
                {view === "module"
                  ? `${modules.length} module${modules.length !== 1 ? "s" : ""}`
                  : `${allDisciplines.length} discipline${allDisciplines.length !== 1 ? "s" : ""} across ${modules.length} module${modules.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* View toggle — pill; full-width on mobile, content-width on desktop */}
          <div className="flex w-full md:w-fit rounded-xl border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => switchView("module")}
              className={`flex-1 md:flex-none flex justify-center items-center text-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                view === "module"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayersIcon size={13} />
              <span className="whitespace-nowrap text-xs">By Module</span>
            </button>
            <button
              type="button"
              onClick={() => switchView("discipline")}
              className={`flex-1 md:flex-none flex justify-center items-center text-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                view === "discipline"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GraduationCapIcon size={13} />
              <span className="whitespace-nowrap text-xs">By Discipline</span>
            </button>
          </div>
        </div>

        {/* Right group: Search bar (left) + Sort dropdown (right) */}
        <div className="flex flex-col md:flex-row md:items-center gap-4">

          {/* Search */}
          <div className="relative w-full md:w-64 lg:w-auto lg:max-w-md">
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

          {/* Sort dropdown */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="shrink-0 w-full md:w-auto p-2 md:px-4 md:py-2 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {view === "module" && <option value="starred">Starred First</option>}
            <option value="az">A → Z</option>
            <option value="most">Most Questions</option>
          </select>
        </div>
      </div>

      {/* ── Grid / empty state ── */}
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

// ── Module grid ───────────────────────────────────────────────────────────────

function ModuleGrid({
  modules,
  allModules,
  coverage,
  favorites,
  onOpen,
  onToggleFav,
}: {
  modules:    string[]
  allModules: string[]
  coverage:   Record<string, { attempted: number; total: number; correct: number }>
  favorites:  string[]
  onOpen:     (mod: string) => void
  onToggleFav:(mod: string) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {modules.map((mod) => {
        const palette    = CARD_PALETTES[allModules.indexOf(mod) % CARD_PALETTES.length]
        const total      = getModuleQuestionCount(mod)
        const disciplines = getDisciplinesForModule(mod)
        const isFav      = favorites.includes(mod)

        return (
          <div
            key={mod}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-0 transition-all hover:shadow-md hover:ring-2 active:scale-[0.98] ${palette.ring}`}
          >
            {/* Colour top bar */}
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 h-1 opacity-80"
              style={{ background: palette.bar }}
            />

            <div className="p-5">
              <div className="mb-3 mt-1 flex items-start justify-between gap-2">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${palette.icon}`}>
                  <LayersIcon size={18} />
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onToggleFav(mod) }}
                  aria-label={isFav ? "Unstar module" : "Star module"}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all ${
                    isFav ? "text-amber-400 hover:text-amber-500" : "text-muted-foreground/30 hover:text-amber-400"
                  }`}
                >
                  <StarIcon size={16} className={isFav ? "fill-amber-400 drop-shadow-sm" : ""} />
                </button>
              </div>

              <h3 className="font-bold text-foreground leading-snug">{mod}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {disciplines.length} discipline{disciplines.length !== 1 ? "s" : ""} · {total}Q
              </p>

              <button
                type="button"
                onClick={() => onOpen(mod)}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all"
                style={{ background: `${palette.bar}18`, color: palette.bar }}
              >
                Open Module
                <ArrowRightIcon size={13} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Discipline grid ───────────────────────────────────────────────────────────

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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {disciplines.map(({ discipline, module: mod, moduleIndex, total }) => {
        const palette = CARD_PALETTES[moduleIndex % CARD_PALETTES.length]
        const cov     = coverage[discipline]

        return (
          <button
            key={`${mod}::${discipline}`}
            type="button"
            onClick={() => onSelect(mod, discipline)}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-sm ring-0 transition-all hover:shadow-md hover:ring-2 active:scale-[0.98] ${palette.ring}`}
          >
            {/* Colour top bar */}
            <div
              className="pointer-events-none absolute left-0 right-0 top-0 h-1 opacity-80"
              style={{ background: palette.bar }}
            />

            <div className="mb-3 mt-1 flex items-start justify-between gap-2">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${palette.icon}`}>
                <GraduationCapIcon size={18} />
              </div>
              <ArrowRightIcon
                size={16}
                className="mt-1 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                style={{ color: palette.bar }}
              />
            </div>

            <h3 className="font-bold text-foreground leading-snug">{discipline}</h3>
            {/* Parent module shown as a muted subtitle */}
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: palette.bar }}>
              {mod}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{total}Q</p>
          </button>
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
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-6">

      {/* Back + module header */}
      {/*
        Mobile  (< sm): flex-col — Title [order-1] then Back [order-2], Export hidden
        Desktop (sm+):  flex-row — Back [sm:order-1] | Title [sm:order-2] | Export [sm:order-3]
      */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">

        {/* Title + metadata */}
        <div className="order-1 sm:order-2 min-w-0 sm:flex-1">
          <h2 className="truncate text-[25px] sm:text-xl font-bold tracking-tight leading-tight">
            {module}
          </h2>
          <p className="mt-1 text-[15px] sm:text-sm text-muted-foreground">
            {totalInModule} questions · {disciplines.length} discipline{disciplines.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Back button — below title on mobile, before title on sm+ */}
        <button
          type="button"
          onClick={onBack}
          className="order-2 sm:order-1 mt-3 sm:mt-0 self-start flex items-center gap-1.5 rounded-full sm:rounded-xl border border-border px-4 sm:px-3 py-2.5 sm:py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeftIcon size={15} />
          Back
        </button>

        {/* Export JSON — hidden on mobile, visible sm+ */}
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

      {/* Discipline grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-6 lg:grid-cols-3 xl:grid-cols-4">

        {/* "All Disciplines" card */}
        <button
          type="button"
          onClick={() => onSelectDiscipline(null)}
          className="group relative overflow-hidden rounded-2xl border-2 border-primary/25 bg-primary/8 p-5 text-left shadow-sm ring-0 transition-all hover:border-primary/50 hover:shadow-md hover:ring-2 hover:ring-primary/30 active:scale-[0.98]"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCapIcon size={22} />
            </div>
            <ArrowRightIcon
              size={18}
              className="mt-0.5 text-primary opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
            />
          </div>
          <h3 className="font-bold text-foreground">All Disciplines</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{totalInModule} questions · all topics</p>
        </button>

        {disciplines.map((disc, i) => {
          const dPalette = CARD_PALETTES[i % CARD_PALETTES.length]
          const cov      = coverage[disc]

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
                {cov ? `${cov.total} questions` : "no questions yet"}
              </p>
            </button>
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
