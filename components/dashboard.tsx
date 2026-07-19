"use client"

import { useState, useEffect, useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useStudyMode } from "@/contexts/study-mode-context"
import { useTheme } from "@/contexts/theme-context"
import {
  getLiveModules,
  getDisciplinesForModule,
  getModuleQuestionCount,
  getQuestionsForModuleAndDiscipline,
  getWeakAreaQuestions,
  getDisciplineCoverage,
} from "@/lib/modules"
import {
  ArrowRightIcon,
  ActivityIcon,
  LayersIcon,
  ChevronLeftIcon,
  AwardIcon,
  TimerIcon,
  ChevronDownIcon,
} from "@/components/icons"
import { CARD_PALETTES, UniversalModuleCard, UniversalDisciplineCard } from "@/components/shared-cards"

interface QuizReadyConfig {
  module: string
  discipline: string | null
}

interface DashboardProps {
  onReadyForQuiz: (config: QuizReadyConfig) => void
  onOpenModules: (module?: string) => void
  onOpenWeakAreas: () => void
  onOpenLiveAssessments: () => void
}

interface LiveAssessment {
  id: string
  title: string
  timeLimitMins: number
  questionCount: number
  status: string
}

function useLiveAssessments() {
  const [liveExams, setLiveExams] = useState<LiveAssessment[]>([])
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/assessments")
        if (res.ok) {
          const data = await res.json()
          setLiveExams((data.assessments ?? []).filter((a: LiveAssessment) => a.status === "live"))
        }
      } catch {}
    }
    check()
    const id = setInterval(check, 30_000)
    return () => clearInterval(id)
  }, [])
  return liveExams
}

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


export function Dashboard({ onReadyForQuiz, onOpenModules, onOpenWeakAreas, onOpenLiveAssessments }: DashboardProps) {
  const { user, progress } = useApp()
  const { globalMode } = useStudyMode()
  const { isGlassEnabled } = useTheme()
  const greeting = useGreeting()
  const liveExams = useLiveAssessments()

  const firstName = user?.name?.split(" ").pop() ?? "Clinician"
  const motivation = MOTIVATIONS[new Date().getDate() % MOTIVATIONS.length]

  // Trial-only stats (from history entries with mode="trial")
  const trialHistory = progress.history.filter((e) => e.mode === "trial")
  const trialAnswered = trialHistory.filter((e) => e.selectedOption !== null).length
  const trialCorrect = trialHistory.filter((e) => e.isCorrect).length
  const trialAccuracy = trialAnswered ? Math.round((trialCorrect / trialAnswered) * 100) : 0

  // Exam-only stats (from saved exam scores)
  const examScores = progress.examScores ?? []
  const examsTaken = examScores.length
  const avgExamScore = examsTaken
    ? Math.round(examScores.reduce((s, e) => s + e.score, 0) / examsTaken)
    : 0
  const bestExamScore = examsTaken ? Math.max(...examScores.map((e) => e.score)) : 0

  return (
    <div className="mx-auto max-w-md space-y-5">

      {/* Live Assessment Banner */}
      {liveExams.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-emerald-500 px-5 py-4 shadow-lg sm:rounded-3xl sm:px-6 sm:py-5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/[0.07]" />
          <div className="pointer-events-none absolute -bottom-8 right-24 h-20 w-20 rounded-full bg-white/[0.05]" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
                </span>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">Live Now</p>
                {liveExams.map((exam) => (
                  <p key={exam.id} className="text-base font-bold text-white leading-snug">{exam.title}</p>
                ))}
                <p className="mt-0.5 text-xs text-white/70">
                  {liveExams[0].questionCount} questions · {liveExams[0].timeLimitMins} min
                  {liveExams.length > 1 && ` · +${liveExams.length - 1} more`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenLiveAssessments}
              className="shrink-0 flex min-h-14 items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-emerald-700 shadow-sm hover:bg-white/90 transition-colors sm:min-h-0"
            >
              Join Now
              <ArrowRightIcon size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-primary px-5 py-5 text-primary-foreground shadow-lg sm:rounded-3xl sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-10 right-20 h-28 w-28 rounded-full bg-white/[0.04]" />
        <div className="pointer-events-none absolute bottom-4 left-1/2 h-16 w-16 rounded-full bg-white/[0.03]" />
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

      {/* Stats row — different cards per mode */}
      <section>
        {globalMode === "trial" ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            <StatCard glass={isGlassEnabled} icon="📋" label="Answered" value={trialAnswered} sub="trial questions" color="bg-sky-50 text-sky-700 border-sky-200/80" />
            <StatCard glass={isGlassEnabled} icon="🎯" label="Accuracy" value={`${trialAccuracy}%`} sub={trialAnswered ? `${trialCorrect} correct` : "no data yet"} color="bg-emerald-50 text-emerald-700 border-emerald-200/80" />
            <StatCard glass={isGlassEnabled} icon="🚩" label="Flagged" value={progress.flaggedQuestionIds.length} sub="for review" color="bg-amber-50 text-amber-700 border-amber-200/80" />
            <StatCard glass={isGlassEnabled} icon="🔥" label="Streak" value={`${progress.streak}d`} sub={progress.lastStudyDate ? `last: ${fmtDate(progress.lastStudyDate)}` : "start today!"} color="bg-rose-50 text-rose-700 border-rose-200/80" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
            <StatCard glass={isGlassEnabled} icon="📝" label="Exams Taken" value={examsTaken} sub="mock exams" color="bg-sky-50 text-sky-700 border-sky-200/80" />
            <StatCard glass={isGlassEnabled} icon="🎯" label="Avg Score" value={examsTaken ? `${avgExamScore}%` : "—"} sub={examsTaken ? `across ${examsTaken} exam${examsTaken !== 1 ? "s" : ""}` : "no exams yet"} color="bg-emerald-50 text-emerald-700 border-emerald-200/80" />
            <StatCard glass={isGlassEnabled} icon="🏆" label="Best Score" value={examsTaken ? `${bestExamScore}%` : "—"} sub={examsTaken ? "personal best" : "no exams yet"} color="bg-amber-50 text-amber-700 border-amber-200/80" />
            <StatCard glass={isGlassEnabled} icon="🔥" label="Streak" value={`${progress.streak}d`} sub={progress.lastStudyDate ? `last: ${fmtDate(progress.lastStudyDate)}` : "start today!"} color="bg-rose-50 text-rose-700 border-rose-200/80" />
          </div>
        )}
      </section>

      {/* Mode-specific content */}
      {globalMode === "trial" ? (
        <TrialDashboard
          onReadyForQuiz={onReadyForQuiz}
          onOpenModules={onOpenModules}
          onOpenWeakAreas={onOpenWeakAreas}
        />
      ) : (
        <ExamDashboard onReadyForQuiz={onReadyForQuiz} onOpenModules={onOpenModules} />
      )}
    </div>
  )
}

// ── Coverage List ─────────────────────────────────────────────────────────────
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

// ── Trial Dashboard ───────────────────────────────────────────────────────────
function TrialDashboard({
  onReadyForQuiz,
  onOpenModules,
  onOpenWeakAreas,
}: {
  onReadyForQuiz: (c: QuizReadyConfig) => void
  onOpenModules: (module?: string) => void
  onOpenWeakAreas: () => void
}) {
  const { progress, toggleFavoriteModule } = useApp()

  const modules = getLiveModules()
  const weakAreaQuestions = getWeakAreaQuestions(progress.history)
  const weakAreaCount = weakAreaQuestions.length
  const favorites = progress.favoriteModules ?? []
  const coverage = getDisciplineCoverage(progress.history)

  const starredModules = useMemo(() => {
    const fav = modules.filter((m) => favorites.includes(m))
    if (fav.length > 0) return fav
    return modules.slice(0, 6)
  }, [modules, favorites])

  return (
    <div className="space-y-6">
      {/* Study Modules */}
      <section>
        {/* Section header */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <LayersIcon size={16} />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Study Modules</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenModules()}
            className="ml-auto text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            View all
            <ArrowRightIcon size={12} />
          </button>
        </div>

        {/* Weak Areas card */}
        {weakAreaCount > 0 && (
          <div className="mb-3">
            <button
              type="button"
              onClick={onOpenWeakAreas}
              className="group relative w-full overflow-hidden rounded-2xl border-2 border-rose-300/50 bg-rose-50/60 p-5 text-left shadow-sm transition-all hover:border-rose-400/70 hover:shadow-md hover:ring-2 hover:ring-rose-300/40 active:scale-[0.99] dark:border-rose-800/40 dark:bg-rose-900/20"
            >
              <div className="pointer-events-none absolute left-0 right-0 top-0 h-1 bg-rose-400/60" />
              <div className="flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm">
                  <ActivityIcon size={22} />
                </div>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-400">
                  {weakAreaCount} to review
                </span>
              </div>
              <h3 className="mt-3 font-bold text-foreground">Weak Areas</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">Questions you've struggled with most</p>
            </button>
          </div>
        )}

        {/* Module list — starred/recent preview */}
        <div className="flex flex-col gap-2">
          {starredModules.map((mod) => {
            const discs   = getDisciplinesForModule(mod)
            const total   = getModuleQuestionCount(mod)
            const attempted = discs.reduce((s, d) => s + (coverage[d]?.attempted ?? 0), 0)
            const pct     = total > 0 ? Math.round((attempted / total) * 100) : 0
            return (
              <UniversalModuleCard
                key={mod}
                mod={mod}
                paletteIndex={modules.indexOf(mod)}
                isFav={favorites.includes(mod)}
                subtitle={`${discs.length} discipline${discs.length !== 1 ? "s" : ""} · ${total}Q`}
                pct={pct}
                onOpen={() => onOpenModules(mod)}
                onToggleFav={toggleFavoriteModule}
              />
            )
          })}
        </div>

        {modules.length > starredModules.length && (
          <button
            type="button"
            onClick={() => onOpenModules()}
            className="mt-3 w-full rounded-xl border border-border py-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            View all {modules.length} modules
          </button>
        )}
      </section>
    </div>
  )
}

// ── Discipline View ───────────────────────────────────────────────────────────
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
              subtitle={`${getQuestionsForModuleAndDiscipline(module, disc).length} questions${pct > 0 ? ` · ${pct}%` : ""}`}
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

// ── Exam Dashboard ────────────────────────────────────────────────────────────
function ExamDashboard({
  onReadyForQuiz,
  onOpenModules,
}: {
  onReadyForQuiz: (c: QuizReadyConfig) => void
  onOpenModules: (module?: string) => void
}) {
  const { progress } = useApp()
  const modules = getLiveModules()
  const examScores = (progress.examScores ?? []).slice(0, 5)

  return (
    <div className="space-y-8">
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

      {/* Module grid for exam */}
      <section>
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500 text-white">
            <TimerIcon size={16} />
          </div>
          <h2 className="text-lg font-bold tracking-tight">Mock Exam Modules</h2>
          <button
            type="button"
            onClick={() => onOpenModules()}
            className="ml-auto text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            View all
            <ArrowRightIcon size={12} />
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {modules.map((mod, i) => {
            const total = getModuleQuestionCount(mod)
            return (
              <UniversalModuleCard
                key={mod}
                mod={mod}
                paletteIndex={i}
                subtitle={`${total}Q · 90s per question`}
                onOpen={() => onReadyForQuiz({ module: mod, discipline: null })}
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ glass, icon, label, value, sub, color }: { glass: boolean; icon: string; label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className={`flex flex-col gap-1 rounded-3xl p-4 sm:p-5 ${glass ? "glass-card" : "border bg-card shadow-sm"}`}>
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
