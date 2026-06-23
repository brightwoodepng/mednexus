"use client"

import { useState, useEffect } from "react"
import { useApp } from "@/contexts/app-context"
import { getSubjects, getQuestionCount, getWeakAreaQuestions, ALL_SUBJECTS, WEAK_AREAS } from "@/lib/modules"
import {
  BookOpenIcon,
  GraduationCapIcon,
  ArrowRightIcon,
  ActivityIcon,
} from "@/components/icons"

interface DashboardProps {
  onSelectModule: (subject: string) => void
}

// Greeting based on time of day — reactive, updates each hour
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
    // Recompute at the top of every hour
    function scheduleNext() {
      const now = new Date()
      const msToNextHour =
        (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1000 - now.getMilliseconds()
      return setTimeout(() => {
        setGreeting(compute())
        scheduleNext()
      }, msToNextHour)
    }
    const t = scheduleNext()
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return greeting
}

// Motivational subtitle lines (cycles by day)
const MOTIVATIONS = [
  "Every question builds your clinical edge.",
  "Knowledge is the best stethoscope.",
  "Commit to the process — excellence follows.",
  "The best clinicians never stop learning.",
  "Focus. Practice. Master.",
  "Sharpen your reasoning, one vignette at a time.",
  "Your future patients are counting on today's study.",
]

// Per-module card accent palettes — index cycles across subjects
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

export function Dashboard({ onSelectModule }: DashboardProps) {
  const { user, progress } = useApp()
  const greeting = useGreeting()
  const subjects = getSubjects()
  const accuracy = progress.totalAnswered
    ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
    : 0
  const weakAreaQuestions = getWeakAreaQuestions(progress.history)
  const weakAreaCount = weakAreaQuestions.length

  const firstName = user?.name?.split(" ").pop() ?? "Clinician"
  const motivation = MOTIVATIONS[new Date().getDate() % MOTIVATIONS.length]

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* ── Hero greeting ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-primary px-7 py-7 text-primary-foreground shadow-lg sm:px-8 sm:py-8">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-20 h-28 w-28 rounded-full bg-white/6" />
        <div className="pointer-events-none absolute bottom-4 left-1/2 h-16 w-16 rounded-full bg-white/5" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{greeting},</p>
            <h1 className="mt-0.5 text-3xl font-bold tracking-tight sm:text-4xl">{firstName} 👋</h1>
            <p className="mt-2 max-w-xs text-sm opacity-75 text-pretty">{motivation}</p>
          </div>

          {/* Streak badge */}
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

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <section aria-label="Progress at a glance">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            icon="📋"
            label="Answered"
            value={progress.totalAnswered}
            sub="questions"
            color="bg-sky-50 text-sky-700 border-sky-200/80"
          />
          <StatCard
            icon="🎯"
            label="Accuracy"
            value={`${accuracy}%`}
            sub={progress.totalAnswered ? `${progress.totalCorrect} correct` : "no data yet"}
            color="bg-emerald-50 text-emerald-700 border-emerald-200/80"
          />
          <StatCard
            icon="🚩"
            label="Flagged"
            value={progress.flaggedQuestionIds.length}
            sub="for review"
            color="bg-amber-50 text-amber-700 border-amber-200/80"
          />
          <StatCard
            icon="🔥"
            label="Streak"
            value={`${progress.streak}d`}
            sub={progress.lastStudyDate ? `last: ${fmtDate(progress.lastStudyDate)}` : "start today!"}
            color="bg-rose-50 text-rose-700 border-rose-200/80"
          />
        </div>
      </section>

      {/* ── Study Modules ───────────────────────────────────────────────── */}
      <section aria-label="Study modules">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <BookOpenIcon size={16} />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Study Modules</h2>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {subjects.length + 1 + (weakAreaCount > 0 ? 1 : 0)} modules
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {/* All Subjects — primary featured card */}
          <button
            type="button"
            onClick={() => onSelectModule(ALL_SUBJECTS)}
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
            <h3 className="font-bold text-foreground">{ALL_SUBJECTS}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {getQuestionCount(ALL_SUBJECTS)} questions · all topics
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-primary/15">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: progress.totalAnswered ? `${Math.min(100, Math.round((progress.totalAnswered / getQuestionCount(ALL_SUBJECTS)) * 100))}%` : "0%" }}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {progress.totalAnswered
                ? `${Math.min(100, Math.round((progress.totalAnswered / getQuestionCount(ALL_SUBJECTS)) * 100))}% attempted`
                : "Not started"}
            </p>
          </button>

          {/* Weak Areas — only when user has wrong answers */}
          {weakAreaCount > 0 && (
            <button
              type="button"
              onClick={() => onSelectModule(WEAK_AREAS)}
              className="group relative overflow-hidden rounded-2xl border-2 border-destructive/25 bg-destructive/8 p-5 text-left shadow-sm ring-0 transition-all hover:border-destructive/50 hover:shadow-md hover:ring-2 hover:ring-destructive/30 active:scale-[0.98]"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500 text-white shadow-sm">
                  <ActivityIcon size={22} />
                </div>
                <ArrowRightIcon
                  size={18}
                  className="mt-0.5 text-rose-500 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </div>
              <h3 className="font-bold text-foreground">{WEAK_AREAS}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {weakAreaCount} question{weakAreaCount === 1 ? "" : "s"} to review
              </p>
              <div className="mt-3 flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-destructive/70" />
                <span className="text-[11px] font-medium text-destructive">Needs attention</span>
              </div>
            </button>
          )}

          {/* Per-subject cards */}
          {subjects.map((subject, i) => {
            const palette = CARD_PALETTES[i % CARD_PALETTES.length]
            return (
              <button
                key={subject}
                type="button"
                onClick={() => onSelectModule(subject)}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-sm ring-0 transition-all hover:border-border hover:shadow-md hover:ring-2 active:scale-[0.98] ${palette.ring}`}
              >
                {/* Colored top stripe */}
                <div
                  className="pointer-events-none absolute left-0 right-0 top-0 h-1 opacity-70"
                  style={{ background: palette.bar }}
                />
                <div className="mb-4 mt-1 flex items-start justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${palette.icon}`}>
                    <BookOpenIcon size={20} />
                  </div>
                  <ArrowRightIcon
                    size={18}
                    className="mt-0.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                  />
                </div>
                <h3 className="font-bold text-foreground">{subject}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {getQuestionCount(subject)} questions
                </p>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, color,
}: {
  icon: string
  label: string
  value: string | number
  sub: string
  color: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between">
        <span className="text-xl">{icon}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${color}`}>
          {label}
        </span>
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
