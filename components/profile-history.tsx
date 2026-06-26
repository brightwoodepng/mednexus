"use client"

import { useState, useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useQuestions } from "@/contexts/questions-context"
import {
  UserIcon,
  ListChecksIcon,
  TargetIcon,
  FlameIcon,
  CheckIcon,
  XIcon,
  EyeOffIcon,
  PencilIcon,
  BookOpenIcon,
  ChevronDownIcon,
  LayersIcon,
} from "@/components/icons"
import {
  getLiveModules,
  getDisciplinesForModule,
  getModuleQuestionCount,
} from "@/lib/modules"
import type { HistoryEntry, ExamScore } from "@/lib/types"

// ── Module + Discipline Coverage ─────────────────────────────────────────────

function ModuleCoverage() {
  const { progress } = useApp()
  const { questions } = useQuestions()
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const modules = getLiveModules()

  // Build per-subject totals from question bank
  const totalBySubject = useMemo(() => {
    const map: Record<string, number> = {}
    for (const q of questions) {
      map[q.subject] = (map[q.subject] ?? 0) + 1
    }
    return map
  }, [questions])

  // Build per-subject stats from history
  const subjectStats = useMemo(() => {
    const attemptedIds: Record<string, Set<string>> = {}
    const correctBySubject: Record<string, number> = {}
    for (const entry of progress.history) {
      if (!attemptedIds[entry.subject]) attemptedIds[entry.subject] = new Set()
      attemptedIds[entry.subject].add(entry.questionId)
      if (entry.isCorrect) {
        correctBySubject[entry.subject] = (correctBySubject[entry.subject] ?? 0) + 1
      }
    }
    return { attemptedIds, correctBySubject }
  }, [progress.history])

  // Build module-level stats
  const moduleRows = useMemo(() => {
    return modules.map((mod) => {
      const disciplines = getDisciplinesForModule(mod)
      const totalQ = getModuleQuestionCount(mod)
      let attempted = 0
      let correct = 0
      for (const disc of disciplines) {
        const ids = subjectStats.attemptedIds[disc]
        if (ids) attempted += ids.size
        correct += subjectStats.correctBySubject[disc] ?? 0
      }
      const coverage = totalQ > 0 ? Math.round((attempted / totalQ) * 100) : 0
      const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : null
      return { mod, disciplines, totalQ, attempted, correct, coverage, accuracy }
    })
  }, [modules, subjectStats])

  function toggleModule(mod: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(mod)) next.delete(mod)
      else next.add(mod)
      return next
    })
  }

  const totalAttempted = moduleRows.filter((r) => r.attempted > 0).length

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <LayersIcon size={16} className="text-primary shrink-0" />
          <h2 className="font-semibold text-foreground">Coverage</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totalAttempted} of {modules.length} modules started · tap a module to see discipline breakdown
        </p>
      </div>

      {moduleRows.length === 0 ? (
        <div className="p-10 text-center">
          <BookOpenIcon size={28} className="mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No modules found.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {moduleRows.map((row) => {
            const isExpanded = expandedModules.has(row.mod)
            const barColor = row.coverage >= 70 ? "#10b981" : row.coverage >= 40 ? "#0ea5e9" : "#8b5cf6"

            return (
              <li key={row.mod}>
                {/* Module row — always visible */}
                <button
                  type="button"
                  onClick={() => toggleModule(row.mod)}
                  className="w-full px-5 py-3.5 text-left hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronDownIcon
                        size={13}
                        className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      />
                      <span className="text-sm font-semibold text-foreground truncate">{row.mod}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {row.accuracy !== null && (
                        <span className={`text-xs font-semibold tabular-nums ${
                          row.accuracy >= 70 ? "text-primary" : row.accuracy >= 50 ? "text-amber-600" : "text-destructive"
                        }`}>
                          {row.accuracy}% acc
                        </span>
                      )}
                      <span className="text-xs font-bold tabular-nums" style={{ color: barColor }}>
                        {row.coverage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(row.coverage, row.attempted > 0 ? 2 : 0)}%`, background: barColor }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {row.attempted} of {row.totalQ} questions attempted
                  </p>
                </button>

                {/* Discipline breakdown — collapsible */}
                {isExpanded && (
                  <ul className="border-t border-border bg-muted/20 divide-y divide-border/50">
                    {row.disciplines.map((disc) => {
                      const total = totalBySubject[disc] ?? 0
                      const attemptedIds = subjectStats.attemptedIds[disc]
                      const attempted = attemptedIds?.size ?? 0
                      const correct = subjectStats.correctBySubject[disc] ?? 0
                      const cov = total > 0 ? Math.round((attempted / total) * 100) : 0
                      const acc = attempted > 0 ? Math.round((correct / attempted) * 100) : null
                      const dColor = cov >= 70 ? "#10b981" : cov >= 40 ? "#0ea5e9" : "#f59e0b"
                      return (
                        <li key={disc} className="px-8 py-3">
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <span className="text-xs font-medium text-foreground truncate">{disc}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              {acc !== null && (
                                <span className={`text-[11px] tabular-nums ${
                                  acc >= 70 ? "text-primary" : acc >= 50 ? "text-amber-600" : "text-destructive"
                                }`}>
                                  {acc}% acc
                                </span>
                              )}
                              <span className="text-[11px] font-semibold tabular-nums" style={{ color: dColor }}>
                                {cov}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(cov, attempted > 0 ? 2 : 0)}%`, background: dColor }}
                            />
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {attempted}/{total} Qs
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Exam Scores ──────────────────────────────────────────────────────────────

function ExamScores({ scores }: { scores: ExamScore[] }) {
  if (scores.length === 0) return null

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">Exam History</h2>
        <span className="text-sm text-muted-foreground">{scores.length} session{scores.length !== 1 ? "s" : ""}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {scores.slice(0, 10).map((s) => (
          <li key={s.id} className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <span className={`text-sm font-bold tabular-nums ${
                s.score >= 70 ? "text-primary" : s.score >= 50 ? "text-amber-600" : "text-destructive"
              }`}>{s.score}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {s.discipline ?? s.moduleName}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.correct}/{s.total} correct · {formatDuration(s.timeTakenMs)}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(s.date)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Profile Header ───────────────────────────────────────────────────────────

function ProfileHeader() {
  const { user, cloudEnabled, progress, updateName, signOutUser } = useApp()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const accuracy = progress.totalAnswered
    ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100)
    : 0

  function startEdit() {
    setDraft(user?.name ?? "")
    setEditing(true)
  }

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    setSaving(true)
    await updateName(draft.trim())
    setSaving(false)
    setEditing(false)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm text-2xl font-bold select-none">
          {(user?.name ?? "C")[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={saveName} className="flex items-center gap-2">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 w-48"
                placeholder="Your name"
              />
              <button
                type="submit"
                disabled={saving || !draft.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                <CheckIcon size={14} />
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
              >
                <XIcon size={14} />
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{user?.name ?? "Clinician"}</h1>
              <button
                type="button"
                onClick={startEdit}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Edit name"
              >
                <PencilIcon size={13} />
              </button>
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              cloudEnabled
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}>
              {cloudEnabled ? "☁ Synced to cloud" : "Saving locally…"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={signOutUser}
          className="shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-px border-t border-border bg-border">
        <MiniStat icon={<ListChecksIcon size={15} />} label="Answered" value={progress.totalAnswered} />
        <MiniStat icon={<TargetIcon size={15} />} label="Accuracy" value={`${accuracy}%`} />
        <MiniStat icon={<FlameIcon size={15} />} label="Streak" value={`${progress.streak}d`} />
        <MiniStat icon={<UserIcon size={15} />} label="Flagged" value={progress.flaggedQuestionIds.length} />
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function ProfileHistory() {
  const { progress } = useApp()
  const examScores = progress.examScores ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ProfileHeader />
      <ModuleCoverage />
      <ExamScores scores={examScores} />

      {/* Per-question history */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Answer History</h2>
          <span className="text-sm text-muted-foreground">{progress.history.length} entries</span>
        </div>

        {progress.history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No history yet. Complete a study block and your answers will appear here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {progress.history.map((entry) => (
              <HistoryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const omitted = entry.selectedOption === null
  const correct = entry.isCorrect
  const accent = omitted ? "bg-muted-foreground/40" : correct ? "bg-primary" : "bg-destructive"

  return (
    <li className="flex overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <span className={`w-1 shrink-0 ${accent}`} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-3 p-3.5 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {entry.subject}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {entry.mode === "trial" ? "Tutor" : "Exam"}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
          </div>
          <p className="text-sm leading-snug text-foreground text-pretty">{entry.vignetteSnippet}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AnswerPill
            label="You"
            value={omitted ? "—" : entry.selectedOption!}
            tone={omitted ? "neutral" : correct ? "correct" : "incorrect"}
          />
          <AnswerPill label="Key" value={entry.correctOption} tone="correct" />
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            omitted
              ? "bg-muted text-muted-foreground"
              : correct
                ? "bg-primary/15 text-primary"
                : "bg-destructive/15 text-destructive"
          }`}>
            {omitted ? <EyeOffIcon size={15} /> : correct ? <CheckIcon size={15} /> : <XIcon size={15} />}
          </span>
        </div>
      </div>
    </li>
  )
}

function AnswerPill({ label, value, tone }: { label: string; value: string; tone: "correct" | "incorrect" | "neutral" }) {
  const toneClass =
    tone === "correct"
      ? "border-primary/40 bg-primary/10 text-primary"
      : tone === "incorrect"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground"
  return (
    <div className={`flex flex-col items-center rounded-lg border px-2.5 py-1 ${toneClass}`}>
      <span className="text-[10px] font-medium uppercase opacity-70">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center bg-card px-3 py-4 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="mt-1 text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  })
}

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.round((ms % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
