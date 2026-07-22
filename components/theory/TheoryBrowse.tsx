"use client"

/**
 * TheoryBrowse — browse view for /theory/browse.
 *
 * Reads ?category and ?discipline from the URL via useSearchParams.
 * When a category is active, shows a discipline grid.
 * When a discipline is selected, fetches questions and shows sets of 20.
 * Clicking a set navigates to /theory/study/[setId].
 */

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"

// ── Types ──────────────────────────────────────────────────────────────────────

interface TheoryQuestion {
  id: string
  category: string
  module: string
  setNumber: number
  prompt: string
  modelAnswer: string
  criticalFlags: string[]
  pastPapers: string[]
  tags: string[]
}

interface QuestionSet {
  setIndex: number   // 1-based
  label: string      // "Set 1: Q1–Q20"
  questions: TheoryQuestion[]
  isComplete: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SET_SIZE = 20

const CATEGORY_LABELS: Record<string, string> = {
  module: "End of Module",
  year:   "End of Year",
}

const DISCIPLINES = [
  { name: "Internal Medicine",        emoji: "🫀" },
  { name: "Surgery",                  emoji: "🔪" },
  { name: "Obstetrics & Gynaecology", emoji: "🤰" },
  { name: "Paediatrics",              emoji: "👶" },
  { name: "Community Medicine",       emoji: "🏘️" },
  { name: "Dermatology",              emoji: "🩺" },
]

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function buildSetId(category: string, module: string, setIndex: number) {
  return `${slugify(category)}--${slugify(module)}--set${setIndex}`
}

// ── Auth helper ────────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const guest = localStorage.getItem("mednexus-guest-token")
    if (guest) return { "x-guest-token": guest }
    const user  = localStorage.getItem("mednexus-user-token")
    if (user)  return { "x-session-token": user }
  } catch { /* ignore */ }
  return {}
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function ChevronRightIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function ChevronLeftIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function LayersIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}

function CheckCircleIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

// ── Discipline Grid ────────────────────────────────────────────────────────────

function DisciplineGrid({ category, onSelect }: { category: string; onSelect: (d: string) => void }) {
  const categoryLabel = CATEGORY_LABELS[category] ?? category

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{categoryLabel}</span>
        <ChevronRightIcon size={14} />
        <span>Select a Discipline</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {DISCIPLINES.map((d) => (
          <button
            key={d.name}
            type="button"
            onClick={() => onSelect(d.name)}
            className="group flex flex-col items-start gap-3 rounded-2xl border border-amber-200/60 bg-white/70 p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/60 hover:shadow-md dark:border-amber-800/30 dark:bg-amber-950/20 dark:hover:border-amber-600/40"
          >
            <span className="text-3xl">{d.emoji}</span>
            <div>
              <p className="text-sm font-semibold text-foreground leading-snug">{d.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">View question sets</p>
            </div>
            <ChevronRightIcon size={14} className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Set Cards ─────────────────────────────────────────────────────────────────

function SetGrid({ sets, category, discipline, onSelect }: {
  sets: QuestionSet[]
  category: string
  discipline: string
  onSelect: (setId: string) => void
}) {
  const categoryLabel = CATEGORY_LABELS[category] ?? category

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{categoryLabel}</span>
        <ChevronRightIcon size={14} />
        <span className="font-medium text-foreground">{discipline}</span>
        <ChevronRightIcon size={14} />
        <span>Question Sets</span>
      </div>

      {sets.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-300/60 bg-amber-50/40 py-20 text-center dark:border-amber-800/30 dark:bg-amber-950/10">
          <LayersIcon size={36} className="text-amber-400" />
          <div>
            <p className="font-semibold text-foreground">No questions yet</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Theory questions for <strong>{discipline}</strong> haven&apos;t been added yet.</p>
          </div>
          <span className="rounded-full border border-amber-300/50 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-700/30 dark:bg-amber-900/20 dark:text-amber-400">
            Coming Soon
          </span>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => {
            const setId = buildSetId(category, discipline, s.setIndex)
            return (
              <button
                key={s.setIndex}
                type="button"
                onClick={() => onSelect(setId)}
                className="group flex flex-col gap-4 rounded-2xl border border-amber-200/60 bg-white/70 p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-400/60 hover:shadow-md dark:border-amber-800/30 dark:bg-amber-950/20 dark:hover:border-amber-600/40"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                    <LayersIcon size={20} className="text-amber-600 dark:text-amber-400" />
                  </div>
                  {s.isComplete && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircleIcon size={10} />
                      Done
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-foreground">{s.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.questions.length} question{s.questions.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Start Set
                  <ChevronRightIcon size={13} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Inner component (uses useSearchParams) ─────────────────────────────────────

function BrowseInner() {
  const router        = useRouter()
  const searchParams  = useSearchParams()

  const category   = searchParams.get("category") ?? ""
  const discipline = searchParams.get("discipline") ?? ""

  const [questions,  setQuestions]  = useState<TheoryQuestion[]>([])
  const [loading,    setLoading]    = useState(false)
  const [fetchError, setFetchError] = useState("")

  // Fetch questions when a discipline is selected
  useEffect(() => {
    if (!category || !discipline) {
      setQuestions([])
      return
    }
    let cancelled = false
    setLoading(true)
    setFetchError("")
    ;(async () => {
      try {
        const headers = getAuthHeaders()
        const url = `/api/theory/questions?category=${encodeURIComponent(category)}&module=${encodeURIComponent(discipline)}`
        const res = await fetch(url, { headers, cache: "no-store" })
        if (cancelled) return
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setFetchError(data.error ?? `Error ${res.status}`)
          return
        }
        const data = await res.json()
        if (!cancelled) setQuestions(data.questions ?? [])
      } catch {
        if (!cancelled) setFetchError("Network error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [category, discipline])

  // Navigate to discipline
  function selectDiscipline(d: string) {
    const params = new URLSearchParams({ category, discipline: d })
    router.push(`/theory/browse?${params.toString()}`)
  }

  // Navigate to set
  function selectSet(setId: string) {
    router.push(`/theory/study/${setId}`)
  }

  // Back navigation
  function goBack() {
    if (discipline) {
      // Back to discipline list
      router.push(`/theory/browse?category=${encodeURIComponent(category)}`)
    } else {
      // Back to dashboard
      router.push("/theory")
    }
  }

  // Chunk questions into sets of SET_SIZE
  const sets: QuestionSet[] = []
  if (questions.length > 0) {
    const total = questions.length
    const numSets = Math.ceil(total / SET_SIZE)
    for (let i = 0; i < numSets; i++) {
      const start = i * SET_SIZE
      const chunk = questions.slice(start, start + SET_SIZE)
      const end   = start + chunk.length
      sets.push({
        setIndex:  i + 1,
        label:     `Set ${i + 1}: Q${start + 1}–Q${end}`,
        questions: chunk,
        isComplete: false, // completion tracking comes in a later prompt
      })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const categoryLabel = CATEGORY_LABELS[category] ?? category

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Go back"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Browse Questions</h1>
          <p className="text-xs text-muted-foreground">
            {discipline
              ? `${categoryLabel} › ${discipline}`
              : categoryLabel
                ? `${categoryLabel} — select a discipline`
                : "Select a category to start"}
          </p>
        </div>
      </div>

      {/* Content */}
      {!category ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-amber-300/60 bg-amber-50/40 py-20 text-center dark:border-amber-800/30 dark:bg-amber-950/10">
          <p className="text-sm font-medium text-muted-foreground">No category selected.</p>
          <button
            type="button"
            onClick={() => router.push("/theory")}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            Go to Dashboard
          </button>
        </div>
      ) : !discipline ? (
        <DisciplineGrid category={category} onSelect={selectDiscipline} />
      ) : loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : fetchError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="font-semibold text-destructive">Failed to load questions</p>
          <p className="mt-1 text-sm text-muted-foreground">{fetchError}</p>
        </div>
      ) : (
        <SetGrid sets={sets} category={category} discipline={discipline} onSelect={selectSet} />
      )}
    </div>
  )
}

// ── Public export (wrapped in Suspense for useSearchParams) ───────────────────

export function TheoryBrowse() {
  return (
    <Suspense fallback={
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-12 w-64 animate-pulse rounded-xl bg-muted/50" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      </div>
    }>
      <BrowseInner />
    </Suspense>
  )
}
