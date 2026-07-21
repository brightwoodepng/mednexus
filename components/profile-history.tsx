"use client"

import { useState, useMemo, useEffect } from "react"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { useQuestions } from "@/contexts/questions-context"
import {
  CheckIcon,
  XIcon,
  EyeOffIcon,
  PencilIcon,
  BookOpenIcon,
  ChevronDownIcon,
  LayersIcon,
  ClipboardListIcon,
} from "@/components/icons"
import {
  getLiveModules,
  getDisciplinesForModule,
  getModuleQuestionCount,
} from "@/lib/modules"
import type { HistoryEntry, ExamScore, Question } from "@/lib/types"
import { useEconomy } from "@/contexts/economy-context"
import { STORE_ITEMS, TITLE_LABELS, FRAME_RING_CLASSES } from "@/lib/economy"
import type { StoreItem } from "@/lib/economy"
import { TrialReviewPanel } from "@/components/trial-review-panel"

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
  const { user, cloudEnabled, updateName, signOutUser } = useApp()
  const { logoutAdmin, isAdmin } = useAdmin()
  const { balance, equippedCosmetics, grantDevNP } = useEconomy()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

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

  const equippedTitleLabel = equippedCosmetics.title
    ? (TITLE_LABELS[equippedCosmetics.title] ?? equippedCosmetics.title)
    : null

  const equippedAvatarItem = equippedCosmetics.avatar
    ? STORE_ITEMS.find((i) => i.id === equippedCosmetics.avatar)
    : null
  const avatarImagePath = equippedAvatarItem?.imagePath ?? null

  const frameClasses = equippedCosmetics.frame
    ? (FRAME_RING_CLASSES[equippedCosmetics.frame] ?? null)
    : null

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:p-6">

        {/* Avatar + Identity: flex-row on all screen sizes */}
        <div className="flex flex-row items-center gap-4 min-w-0 flex-1 sm:gap-4">

          {/* Avatar with frame wrapper and hover-edit overlay */}
          <div
            className="shrink-0 cursor-pointer group"
            onClick={startEdit}
            title="Edit display name"
          >
            {/* Frame ring wrapper — ring classes are layout-neutral outlines */}
            <div className={`rounded-full ${frameClasses ? `${frameClasses} ring-offset-2 ring-offset-card` : ""}`}>
              {/* Avatar circle */}
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm text-2xl font-bold select-none overflow-hidden">
                {avatarImagePath ? (
                  <img
                    src={avatarImagePath}
                    alt={equippedAvatarItem?.name ?? "Avatar"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (user?.name ?? "C")[0].toUpperCase()
                )}
                {/* Hover edit overlay — clipped to the circle by parent overflow-hidden */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <PencilIcon size={16} className="text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Identity column */}
          <div className="min-w-0 flex-1">
          {editing ? (
            <form onSubmit={saveName} className="flex items-center gap-2 mb-1">
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
            <button
              type="button"
              onClick={startEdit}
              className="group/name flex items-center gap-1.5 mb-0.5 text-left"
              aria-label="Edit name"
            >
              <h1 className="text-xl font-semibold tracking-tight">{user?.name ?? "Clinician"}</h1>
              <PencilIcon size={12} className="text-muted-foreground opacity-0 group-hover/name:opacity-100 transition-opacity" />
            </button>
          )}

          {/* Equipped title */}
          {equippedTitleLabel
            ? <p className="text-sm text-purple-400 italic font-semibold">{equippedTitleLabel}</p>
            : <p className="text-sm text-purple-400/40 italic">No title equipped</p>
          }

          {/* NP balance + admin cheat */}
          <div className="mt-1 flex items-center gap-1.5">
            <p className="text-sm font-bold text-amber-500 tabular-nums">
              ⚡ {balance.toLocaleString()} NP
            </p>
            {isAdmin && (
              <button
                type="button"
                onClick={grantDevNP}
                title="[Admin] Set balance to 999,999 NP"
                className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground/25 hover:text-amber-400/60 transition-colors text-[10px] font-bold leading-none select-none"
                aria-label="Admin: grant 999,999 NP"
              >
                +
              </button>
            )}
          </div>

          {/* Sync state */}
          <div className="mt-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              cloudEnabled
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}>
              {cloudEnabled ? "☁ Synced to cloud" : "Saving locally…"}
            </span>
          </div>
          </div>
          {/* end Identity column */}
        </div>
        {/* end Avatar + Identity wrapper */}

        {/* Sign out — full-width below on mobile, auto-width inline on desktop */}
        <button
          type="button"
          onClick={() => { logoutAdmin(); signOutUser() }}
          className="w-full sm:w-auto shrink-0 rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

// ── Continuous Module Review ─────────────────────────────────────────────────

function ModuleReviewSection() {
  const { progress } = useApp()
  const { questions } = useQuestions()
  const [openModule, setOpenModule] = useState<string | null>(null)

  // Fast question lookup by ID
  const questionById = useMemo(() => {
    const map = new Map<string, Question>()
    for (const q of questions) map.set(q.id, q)
    return map
  }, [questions])

  // Aggregate history → one record per module.
  // Only the LATEST attempt per questionId within a module is kept so the
  // answers map and correct-count reflect the user's most recent performance.
  const moduleData = useMemo(() => {
    const grouped = new Map<string, HistoryEntry[]>()
    for (const entry of progress.history) {
      const mod = entry.module ?? entry.subject ?? "Uncategorized"
      if (!grouped.has(mod)) grouped.set(mod, [])
      grouped.get(mod)!.push(entry)
    }

    const result: {
      module: string
      questions: Question[]
      answers: Record<string, string | string[] | null>
      correctCount: number
    }[] = []

    for (const [mod, entries] of grouped) {
      // Keep latest attempt per question
      const latestByQ = new Map<string, HistoryEntry>()
      for (const e of entries) {
        const prev = latestByQ.get(e.questionId)
        if (!prev || e.timestamp > prev.timestamp) latestByQ.set(e.questionId, e)
      }

      const qs: Question[] = []
      const answers: Record<string, string | string[] | null> = {}
      let correctCount = 0

      for (const [qId, entry] of latestByQ) {
        const q = questionById.get(qId)
        if (!q) continue
        qs.push(q)
        answers[qId] = entry.selectedOption
        if (entry.isCorrect) correctCount++
      }

      if (qs.length > 0) {
        result.push({ module: mod, questions: qs, answers, correctCount })
      }
    }

    // Most-answered modules first
    return result.sort((a, b) => b.questions.length - a.questions.length)
  }, [progress.history, questionById])

  const openData = openModule ? moduleData.find((m) => m.module === openModule) : null

  if (moduleData.length === 0) return null

  return (
    <>
      {/* Full-screen review overlay */}
      {openData && (
        <TrialReviewPanel
          questions={openData.questions}
          answers={openData.answers}
          subtitle={`${openData.module} · ${openData.questions.length} question${openData.questions.length !== 1 ? "s" : ""}`}
          onBack={() => setOpenModule(null)}
        />
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardListIcon size={16} className="text-primary shrink-0" />
              <h2 className="font-semibold text-foreground">Module Review</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap any module to review every question you&apos;ve answered — with All / Correct / Incorrect filters
            </p>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">
            {moduleData.length} module{moduleData.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {moduleData.map((mod) => {
            const total = mod.questions.length
            const accuracy = total > 0 ? Math.round((mod.correctCount / total) * 100) : 0
            const incorrect = total - mod.correctCount
            return (
              <button
                key={mod.module}
                type="button"
                onClick={() => setOpenModule(mod.module)}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99]"
              >
                {/* Title + accuracy badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{mod.module}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {total} question{total !== 1 ? "s" : ""} answered
                    </p>
                  </div>
                  <span className={`shrink-0 text-sm font-bold tabular-nums ${
                    accuracy >= 70 ? "text-primary" : accuracy >= 50 ? "text-amber-600 dark:text-amber-400" : "text-destructive"
                  }`}>
                    {accuracy}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${accuracy}%` }}
                  />
                </div>

                {/* Correct / Incorrect counts + CTA */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-3">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckIcon size={11} /> {mod.correctCount} correct
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-destructive">
                      <XIcon size={11} /> {incorrect} incorrect
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground transition-colors group-hover:text-primary">
                    Review →
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

// ── Privacy Settings ─────────────────────────────────────────────────────────

function PrivacySettings() {
  const { user } = useApp()
  const [isPrivate, setIsPrivate] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  // Only available to registered users (not guests)
  if (!user || user.role !== "user") return null

  // Load current privacy state
  useEffect(() => {
    fetch(`/api/user/privacy?uid=${encodeURIComponent(user.uid)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIsPrivate(d.isPrivate ?? false) })
      .catch(() => setIsPrivate(false))
  }, [user.uid])

  async function toggle() {
    if (isPrivate === null || saving) return
    setSaving(true)
    const next = !isPrivate
    try {
      const res = await fetch("/api/user/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, isPrivate: next }),
      })
      if (res.ok) setIsPrivate(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">🔒</span>
          <h2 className="font-semibold text-foreground">Privacy</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Control your visibility on the leaderboard</p>
      </div>
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Hide me from leaderboards</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isPrivate
              ? "Your profile is hidden. You won't appear in any rankings."
              : "Your profile is visible to all users on the leaderboard."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={isPrivate === null || saving}
          aria-pressed={isPrivate ?? false}
          className={`relative shrink-0 h-6 w-11 rounded-full transition-colors duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
            isPrivate ? "bg-primary" : "bg-muted-foreground/30"
          }`}
        >
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            isPrivate ? "translate-x-5" : "translate-x-0"
          }`} />
        </button>
      </div>
    </div>
  )
}

export function ProfileHistory() {
  const { progress } = useApp()
  const examScores = progress.examScores ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ProfileHeader />
      <CosmeticLoadout />
      <PrivacySettings />
      <ModuleCoverage />
      <ModuleReviewSection />
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
            value={omitted ? "—" : Array.isArray(entry.selectedOption) ? entry.selectedOption.join(", ") : entry.selectedOption!}
            tone={omitted ? "neutral" : correct ? "correct" : "incorrect"}
          />
          <AnswerPill label="Key" value={Array.isArray(entry.correctOption) ? entry.correctOption.join(", ") : (entry.correctOption ?? "—")} tone="correct" />
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

// ── Cosmetic Loadout ──────────────────────────────────────────────────────────

function LoadoutRow({
  label, emoji, items, equipped, saving, onEquip,
}: {
  label: string; emoji: string; items: StoreItem[]
  equipped: string | null; saving: boolean; onEquip: (id: string | null) => void
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="text-xl shrink-0 leading-none">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
        <select
          value={equipped ?? ""}
          onChange={(e) => onEquip(e.target.value || null)}
          disabled={saving || items.length === 0}
          className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">{items.length === 0 ? "None owned — visit the Game Store" : "— None —"}</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>{i.icon} {i.name}</option>
          ))}
        </select>
      </div>
      {saving && <span className="text-xs text-muted-foreground shrink-0 animate-pulse">Saving…</span>}
    </div>
  )
}

function CosmeticLoadout() {
  const { inventory, equippedCosmetics, equipCosmetic } = useEconomy()
  const [savingType, setSavingType] = useState<string | null>(null)

  const ownedAvatars = STORE_ITEMS.filter((i) => i.cosmeticType === "avatar" && (inventory[i.id] ?? 0) >= 1)
  const ownedTitles  = STORE_ITEMS.filter((i) => i.cosmeticType === "title"  && (inventory[i.id] ?? 0) >= 1)
  const ownedFrames  = STORE_ITEMS.filter((i) => i.cosmeticType === "frame"  && (inventory[i.id] ?? 0) >= 1)

  async function handleEquip(type: "avatar" | "title" | "frame", id: string | null) {
    setSavingType(type)
    await equipCosmetic(type, id)
    setSavingType(null)
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">✨</span>
          <h2 className="font-semibold text-foreground">Cosmetic Loadout</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Equip items you&apos;ve unlocked from the Game Store</p>
      </div>
      <div className="divide-y divide-border">
        <LoadoutRow
          label="Active Avatar" emoji="🧑‍⚕️"
          items={ownedAvatars} equipped={equippedCosmetics.avatar}
          saving={savingType === "avatar"} onEquip={(id) => handleEquip("avatar", id)}
        />
        <LoadoutRow
          label="Active Title" emoji="🏷️"
          items={ownedTitles} equipped={equippedCosmetics.title}
          saving={savingType === "title"} onEquip={(id) => handleEquip("title", id)}
        />
        <LoadoutRow
          label="Active Frame" emoji="🖼️"
          items={ownedFrames} equipped={equippedCosmetics.frame}
          saving={savingType === "frame"} onEquip={(id) => handleEquip("frame", id)}
        />
      </div>
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
