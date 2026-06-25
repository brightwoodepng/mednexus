"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/contexts/app-context"
import { useStudyMode } from "@/contexts/study-mode-context"
import {
  getModules,
  getDisciplinesForModule,
  getModuleQuestionCount,
  getQuestionsForModuleAndDiscipline,
  getWeakAreaQuestions,
  getDisciplineCoverage,
} from "@/lib/modules"
import {
  BookOpenIcon,
  GraduationCapIcon,
  ArrowRightIcon,
  ActivityIcon,
  LayersIcon,
  ChevronLeftIcon,
  TrendingUpIcon,
  AwardIcon,
  TimerIcon,
  ZapIcon,
  ChevronDownIcon,
} from "@/components/icons"

interface QuizReadyConfig {
  module: string
  discipline: string | null
}

interface DashboardProps {
  onReadyForQuiz: (config: QuizReadyConfig) => void
  requestedModule?: string | null
  onClearRequestedModule?: () => void
}

// Greeting based on time of day
function useGreeting() {
  function compute() {
    const h = new Date().getHours()
    if (h >= 5 && h < 12) return "Good morning"
    if (h >= 12 && h < 17) return "Good afternoon"
    if (h >= 17 && h < 21) return "Good evening"
    return "Good night"
  }
  const [greeting, setGreeting] = useState(compute)
  useEffect(() => {
    function scheduleNext() {
      const now = new Date()
      const msToNextHour = (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds()
      return setTimeout(() => { setGreeting(compute()); scheduleNext() }, msToNextHour)
    }
    const t = scheduleNext()
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return greeting
}

const MOTIVATIONS = [
  "Every question builds your clinical edge.",
  "Knowledge is the best stethoscope.",
  "Commit to the process — excellence follows.",
  "The best clinicians never stop learning.",
  "Focus. Practice. Master.",
  "Sharpen your reasoning, one vignette at a time.",
  "Your future patients are counting on today's study.",
]

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

export function Dashboard({ onReadyForQuiz, requestedModule, onClearRequestedModule }: DashboardProps) {
  const { user, progress } = useApp()
  const { globalMode } = useStudyMode()
  const greeting = useGreeting()

  const firstName = user?.name?.split(" ").pop() ?? "Clinician"
  const motivation = MOTIVATIONS[new Date().getDate() % MOTIVATIONS.length]
  const accuracy = progress.totalAnswered
    ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
    : 0

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-primary px-7 py-7 text-primary-foreground shadow-lg sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-20 h-28 w-28 rounded-full bg-white/6" />
        <div className="pointer-events-none absolute bottom-4 left-1/2 h-16 w-16 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{greeting},</p>
            <h1 className="mt-0.5 text-3xl font-bold tracking-tight sm:text-4xl">{firstName} 👋</h1>
            <p className="mt-2 max-w-xs text-sm opacity-75 text-pretty">{motivation}</p>
          </div>
          {progress.streak > 0 && (
            <div className="flex w-fit items-center gap-2 rounded-2xl bg-white/15 px-4 py-2.5 backdrop-blur-sm sm:flex-col sm:items-center sm:text-center">
              <span className="text-2xl leading-none">🔥</span>
              <div>
                <p className="text-xl font-bold leading-tight">{progress.streak}</p>
                <p className="text-xs opacity-80">day streak</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard icon="📋" label="Answered" value={progress.totalAnswered} sub="questions" color="bg-sky-50 text-sky-700 border-sky-200/80" />
          <StatCard icon="🎯" label="Accuracy" value={`${accuracy}%`} sub={progress.totalAnswered ? `${progress.totalCorrect} correct` : "no data yet"} color="bg-emerald-50 text-emerald-700 border-emerald-200/80" />
          <StatCard icon="🚩" label="Flagged" value={progress.flaggedQuestionIds.length} sub="for review" color="bg-amber-50 text-amber-700 border-amber-200/80" />
          <StatCard icon="🔥" label="Streak" value={`${progress.streak}d`} sub={progress.lastStudyDate ? `last: ${fmtDate(progress.lastStudyDate)}` : "start today!"} color="bg-rose-50 text-rose-700 border-rose-200/80" />
        </div>
      </section>

      {/* Mode-specific content */}
      {globalMode === "trial" ? (
        <TrialDashboard
          onReadyForQuiz={onReadyForQuiz}
          requestedModule={requestedModule}
          onClearRequestedModule={onClearRequestedModule}
        />
      ) : (
        <ExamDashboard onReadyForQuiz={onReadyForQuiz} />
      )}
    </div>
  )
}

// ── Coverage List (compact rows inside a card) ───────────────────────────────
const COVERAGE_COLLAPSE_THRESHOLD = 8

function CoverageList({ coverage }: { coverage: Record<string, { attempted: number; total: number; correct: number }> }) {
  const [expanded, setExpanded] = useState(false)
  const entries = Object.entries(coverage)
    .filter(([, v]) => v.attempted > 0)
    .sort((a, b) => b[1].attempted - a[1].attempted)
  if (entries.length === 0) return null
  const visible = expanded ? entries : entries.slice(0, COVERAGE_COLLAPSE_THRESHOLD)
  const hidden = entries.length - COVERAGE_COLLAPSE_THRESHOLD

  return (
    <div>
      <ul className="divide-y divide-border">
        {visible.map(([disc, { attempted, total, correct }]) => {
          const pct = total > 0 ? Math.round((attempted / total) * 100) : 0
          const acc = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
          const barColor = acc >= 80 ? "#10b981" : acc >= 60 ? "#0ea5e9" : "#f59e0b"
          return (
            <li key={disc} className="flex items-center gap-3 px-4 py-2.5">
              <p className="w-28 shrink-0 truncate text-sm font-medium">{disc}</p>
              <div className="flex-1 min-w-0">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: barColor }}
                  />
                </div>
              </div>
              <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                {pct}%
              </span>
              <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {acc}% acc
              </span>
            </li>
          )
        })}
      </ul>
      {entries.length > COVERAGE_COLLAPSE_THRESHOLD && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-2.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
        >
          <ChevronDownIcon size={12} className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          {expanded ? "Show less" : `${hidden} more discipline${hidden !== 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  )
}

// ── Trial Dashboard ──────────────────────────────────────────────────────────
function TrialDashboard({
  onReadyForQuiz,
  requestedModule,
  onClearRequestedModule,
}: {
  onReadyForQuiz: (c: QuizReadyConfig) => void
  requestedModule?: string | null
  onClearRequestedModule?: () => void
}) {
  const { progress } = useApp()
  const [viewingModule, setViewingModule] = useState<string | null>(null)

  const modules = getModules()
  const weakAreaQuestions = getWeakAreaQuestions(progress.history)
  const weakAreaCount = weakAreaQuestions.length
  const coverage = getDisciplineCoverage(progress.history)

  // When sidebar selects a module, open it in the discipline view
  useEffect(() => {
    if (requestedModule) {
      setViewingModule(requestedModule)
      onClearRequestedModule?.()
    }
  }, [requestedModule, onClearRequestedModule])

  if (viewingModule) {
    return (
      <DisciplineView
        module={viewingModule}
        coverage={coverage}
        onBack={() => setViewingModule(null)}
        onSelectDiscipline={(discipline) => onReadyForQuiz({ module: viewingModule, discipline })}
      />
    )
  }

  // Only disciplines that have been attempted
  const attemptedCoverage = Object.fromEntries(
    Object.entries(coverage).filter(([, v]) => v.attempted > 0)
  )

  return (
    <div className="space-y-6">
      {/* Two-column layout: Coverage left, Modules right (on large screens) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── Discipline Coverage ── */}
        {Object.keys(attemptedCoverage).length > 0 && (
          <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <TrendingUpIcon size={15} className="text-emerald-500 shrink-0" />
              <h2 className="font-semibold text-sm tracking-tight">Discipline Coverage</h2>
              <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                {Object.keys(attemptedCoverage).length} attempted
              </span>
            </div>
            <CoverageList coverage={attemptedCoverage} />
          </section>
        )}

        {/* ── Study Modules ── */}
        <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <LayersIcon size={15} className="text-primary shrink-0" />
            <h2 className="font-semibold text-sm tracking-tight">Study Modules</h2>
            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
              {modules.length + (weakAreaCount > 0 ? 1 : 0)} total
            </span>
          </div>

          <ul className="divide-y divide-border">
            {/* Weak Areas row */}
            {weakAreaCount > 0 && (
              <li>
                <button
                  type="button"
                  onClick={() => onReadyForQuiz({ module: "__weak__", discipline: null })}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-destructive/5 transition-colors"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600">
                    <ActivityIcon size={14} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">Weak Areas</p>
                    <p className="text-[11px] text-muted-foreground">{weakAreaCount} to review</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold text-destructive bg-destructive/10 rounded-full px-2 py-0.5">
                    Review
                  </span>
                  <ArrowRightIcon size={14} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
            )}

            {/* Module rows */}
            {modules.map((mod, i) => {
              const palette = CARD_PALETTES[i % CARD_PALETTES.length]
              const total = getModuleQuestionCount(mod)
              const disciplines = getDisciplinesForModule(mod)
              return (
                <li key={mod}>
                  <button
                    type="button"
                    onClick={() => setViewingModule(mod)}
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                  >
                    <span
                      className="shrink-0 h-7 w-1 rounded-full"
                      style={{ background: palette.bar }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{mod}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {disciplines.length} discipline{disciplines.length !== 1 ? "s" : ""} · {total}Q
                      </p>
                    </div>
                    <ArrowRightIcon size={14} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

      </div>
    </div>
  )
}

// ── Discipline View (inside Trial mode, after clicking a module) ──────────────
function DisciplineView({
  module,
  coverage,
  onBack,
  onSelectDiscipline,
}: {
  module: string
  coverage: Record<string, { attempted: number; total: number; correct: number }>
  onBack: () => void
  onSelectDiscipline: (discipline: string | null) => void
}) {
  const disciplines = getDisciplinesForModule(module)
  const totalInModule = getModuleQuestionCount(module)

  return (
    <div className="space-y-6">
      {/* Back + module header */}
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
          <h2 className="truncate text-xl font-bold tracking-tight">{module}</h2>
          <p className="text-sm text-muted-foreground">{totalInModule} questions · {disciplines.length} disciplines</p>
        </div>
      </div>

      {/* Discipline grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {/* All disciplines */}
        <button
          type="button"
          onClick={() => onSelectDiscipline(null)}
          className="group relative overflow-hidden rounded-2xl border-2 border-primary/25 bg-primary/8 p-5 text-left shadow-sm ring-0 transition-all hover:border-primary/50 hover:shadow-md hover:ring-2 hover:ring-primary/30 active:scale-[0.98]"
        >
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <GraduationCapIcon size={22} />
            </div>
            <ArrowRightIcon size={18} className="mt-0.5 text-primary opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
          </div>
          <h3 className="font-bold text-foreground">All Disciplines</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{totalInModule} questions · all topics</p>
        </button>

        {disciplines.map((disc, i) => {
          const palette = CARD_PALETTES[i % CARD_PALETTES.length]
          const cov = coverage[disc]
          const pct = cov ? Math.round((cov.attempted / cov.total) * 100) : 0
          return (
            <button
              key={disc}
              type="button"
              onClick={() => onSelectDiscipline(disc)}
              className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-sm ring-0 transition-all hover:border-border hover:shadow-md hover:ring-2 active:scale-[0.98] ${palette.ring}`}
            >
              <div className="pointer-events-none absolute left-0 right-0 top-0 h-1 opacity-70" style={{ background: palette.bar }} />
              <div className="mb-4 mt-1 flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${palette.icon}`}>
                  <BookOpenIcon size={20} />
                </div>
                <ArrowRightIcon size={18} className="mt-0.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </div>
              <h3 className="font-bold text-foreground">{disc}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {getQuestionsForModuleAndDiscipline(module, disc).length} questions
              </p>
              {cov && cov.total > 0 && (
                <>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {pct > 0 ? `${pct}% attempted` : "Not started"}
                  </p>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Exam Dashboard ───────────────────────────────────────────────────────────
function ExamDashboard({ onReadyForQuiz }: { onReadyForQuiz: (c: QuizReadyConfig) => void }) {
  const { progress } = useApp()
  const modules = getModules()
  const examScores = (progress.examScores ?? []).slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Recent exam scores */}
      {examScores.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white">
              <AwardIcon size={16} />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Recent Exam Scores</h2>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            {examScores.map((s, i) => (
              <div key={s.id} className={`flex items-center gap-4 px-4 py-3 ${i !== 0 ? "border-t border-border/60" : ""}`}>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${s.score >= 85 ? "bg-emerald-100 text-emerald-700" : s.score >= 70 ? "bg-sky-100 text-sky-700" : s.score >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                  {s.score}%
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.moduleName}</p>
                  {s.discipline && <p className="truncate text-xs text-muted-foreground">{s.discipline}</p>}
                  <p className="text-xs text-muted-foreground">{s.correct}/{s.total} correct · {fmtMs(s.timeTakenMs)}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{fmtDate(s.date.slice(0, 10))}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modules for exam */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <TimerIcon size={15} className="text-amber-500 shrink-0" />
          <h2 className="font-semibold text-sm tracking-tight">Mock Exam Modules</h2>
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {modules.length} module{modules.length !== 1 ? "s" : ""} · timed
          </span>
        </div>
        <ul className="divide-y divide-border">
          {modules.map((mod, i) => {
            const palette = CARD_PALETTES[i % CARD_PALETTES.length]
            const total = getModuleQuestionCount(mod)
            return (
              <li key={mod}>
                <button
                  type="button"
                  onClick={() => onReadyForQuiz({ module: mod, discipline: null })}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <span
                    className="shrink-0 h-7 w-1 rounded-full"
                    style={{ background: palette.bar }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{mod}</p>
                    <p className="text-[11px] text-muted-foreground">{total}Q · 90s per question</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 border border-amber-200">
                    Timed
                  </span>
                  <ArrowRightIcon size={14} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}


// ── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${color}`}>{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function fmtMs(ms: number) {
  if (!ms) return "—"
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}
