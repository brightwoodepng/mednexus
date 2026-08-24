"use client"

import { useState, useMemo, useEffect } from "react"
import { useApp } from "@/contexts/app-context"
import { useQuestions } from "@/contexts/questions-context"
import {
  CheckIcon,
  XIcon,
  EyeOffIcon,
  PencilIcon,
  BookOpenIcon,
  ClipboardListIcon,
} from "@/components/icons"
import type { HistoryEntry, ExamScore, Question } from "@/lib/types"
import { useEconomy } from "@/contexts/economy-context"
import { STORE_ITEMS, TITLE_LABELS } from "@/lib/economy"
import { XP_CONFIG } from "@/lib/xp-config"
import { TrialReviewPanel } from "@/components/trial-review-panel"
import type { StudyHubId } from "@/components/study-hub-switcher"
import type { Screen } from "@/lib/view"
import { CosmeticFrame, CosmeticTitle } from "@/components/cosmetics"
import { TutorialSettings } from "@/components/onboarding/TutorialSettings"

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
  const { balance, lifetimeEarned, lifetimeXP, equippedCosmetics, grantDevNP } = useEconomy()
  const clinicalRank = [...XP_CONFIG.clinicalRanks].reverse().find(rank => lifetimeXP >= rank.minimumXP) ?? XP_CONFIG.clinicalRanks[0]
  const clinicalRankIndex = XP_CONFIG.clinicalRanks.findIndex(rank => rank.name === clinicalRank.name)
  const nextClinicalRank = XP_CONFIG.clinicalRanks[clinicalRankIndex + 1]
  const rankProgress = nextClinicalRank
    ? Math.min(100, Math.max(0, (lifetimeXP - clinicalRank.minimumXP) / (nextClinicalRank.minimumXP - clinicalRank.minimumXP) * 100))
    : 100
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
            <CosmeticFrame cosmeticId={equippedCosmetics.frame} size="profile" motionState="focused" interactionState="focused" className="rounded-full ring-offset-2 ring-offset-card">
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
            </CosmeticFrame>
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
            ? <p className="text-sm text-purple-400 italic font-semibold"><CosmeticTitle cosmeticId={equippedCosmetics.title} size="profile">{equippedTitleLabel}</CosmeticTitle></p>
            : <p className="text-sm text-purple-400/40 italic">No title equipped</p>
          }

          {/* Spendable, lifetime, and progression totals are intentionally distinct. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold text-amber-500">
              NP Balance <strong className="tabular-nums">{balance.toLocaleString()}</strong>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Lifetime NP <strong className="tabular-nums">{lifetimeEarned.toLocaleString()}</strong>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
              Lifetime XP <strong className="tabular-nums">{lifetimeXP.toLocaleString()}</strong> · <strong>{clinicalRank.name}</strong>
            </span>
          </div>
          <div className="mt-2 max-w-sm" aria-label={nextClinicalRank ? `${Math.round(rankProgress)} percent progress to ${nextClinicalRank.name}` : "Highest clinical rank reached"}>
            <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-semibold text-muted-foreground">
              <span>{clinicalRank.name}</span>
              <span>{nextClinicalRank ? `${Math.max(0, nextClinicalRank.minimumXP - lifetimeXP).toLocaleString()} XP to ${nextClinicalRank.name}` : "Highest rank reached"}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-violet-500" style={{ width: `${rankProgress}%` }} /></div>
          </div>
          <details className="mt-2 max-w-sm rounded-xl border border-border/60 bg-background/45 px-3 py-2">
            <summary className="cursor-pointer text-xs font-bold text-muted-foreground">View all {XP_CONFIG.clinicalRanks.length} clinical ranks</summary>
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
              {XP_CONFIG.clinicalRanks.map(rank => <div key={rank.name} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[11px] ${rank.name === clinicalRank.name ? "bg-violet-500/10 text-violet-700 dark:text-violet-300" : "text-muted-foreground"}`}><span className="font-semibold">{rank.name}</span><span className="shrink-0 tabular-nums">{rank.minimumXP.toLocaleString()} XP{rank.npReward ? ` · +${rank.npReward.toLocaleString()} NP` : ""}</span></div>)}
            </div>
          </details>

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
          onClick={signOutUser}
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
  const { questions, loadQuestionSet } = useQuestions()
  const [openModule, setOpenModule] = useState<string | null>(null)

  // History navigation is metadata-only. Fetch records only when the learner
  // opens one module for review, never the entire bank on profile render.
  useEffect(() => {
    if (openModule) void loadQuestionSet({ module: openModule })
  }, [loadQuestionSet, openModule])

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

  const authHeaders = (): Record<string, string> => {
    const sessionToken = localStorage.getItem("mednexus-user-token")
    if (sessionToken) return { "x-session-token": sessionToken }
    const guestToken = localStorage.getItem("mednexus-guest-token")
    return guestToken ? { "x-guest-token": guestToken } : {}
  }

  // Load current privacy state
  useEffect(() => {
    fetch("/api/user/privacy", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setIsPrivate(d.isPrivate ?? false) })
      .catch(() => setIsPrivate(false))
  }, [user.uid])

  async function toggle() {
    if (!user || isPrivate === null || saving) return
    setSaving(true)
    const next = !isPrivate
    try {
      const res = await fetch("/api/user/privacy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ isPrivate: next }),
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

type TheoryDashboardData = { authenticated: boolean; displayName: string; totals: { total: number; completed: number }; collections: Array<{ id: string; title: string; kind: string; groups: number; sets: number; total: number; completed: number }>; continueStudying: { prompt: string; collection: string; groupName: string; setTitle: string; lastStudiedAt: string } | null; counts: { bookmarks: number; notes: number; drafts: number; revision: number }; recentSets: Array<{ collection: string; groupName: string; setTitle: string; lastStudiedAt: string }> }

function TheoryProfilePanel({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { progress } = useApp()
  const [data, setData] = useState<TheoryDashboardData | null>(null)
  useEffect(() => { fetch("/api/theory/dashboard").then((r) => r.ok ? r.json() : null).then(setData).catch(() => setData(null)) }, [])
  const totals = data?.totals ?? { total: 0, completed: 0 }
  const collection = (name: string) => data?.collections.find((item) => item.title.toLowerCase() === name.toLowerCase())
  const progressFor = (name: string) => { const item = collection(name); return item ? `${item.completed} / ${item.total}` : "0 / 0" }
  const cards = [
    ["End of Module", progressFor("End of Module")], ["End of Year", progressFor("End of Year")],
    ["Questions read", String(totals.completed)], ["Questions remaining", String(Math.max(0, totals.total - totals.completed))],
    ["Revision queue", String(data?.counts.revision ?? 0)], ["Practice drafts", String(data?.counts.drafts ?? 0)],
  ]
  const recent = data?.continueStudying ? `Continue: ${data.continueStudying.prompt}` : data?.recentSets?.[0] ? `Recently studied: ${data.recentSets[0].groupName} · ${data.recentSets[0].setTitle}` : "No Theory study activity yet"
  return <section className="space-y-5" aria-labelledby="theory-learning-title">
    <div className="overflow-hidden rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/10 via-card to-card p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-teal-700 dark:text-teal-300">Theory Vault</p><h2 id="theory-learning-title" className="mt-2 text-xl font-bold">Theory learning overview</h2><p className="mt-1 text-sm text-muted-foreground">Questions read, deliberate revision and clinical recall — separate from MCQ performance.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">{cards.map(([label, value]) => <div key={label} className="rounded-xl border border-border/70 bg-background/65 p-3"><p className="text-lg font-bold tabular-nums text-foreground">{value}</p><p className="text-xs font-semibold text-muted-foreground">{label}</p></div>)}</div>
      <p className="mt-4 rounded-xl bg-background/60 px-3 py-2 text-sm text-muted-foreground">{progress.streak > 0 ? `${progress.streak}-day study streak · ` : ""}{recent}</p>
    </div>
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="font-semibold">Study organisation</h2><div className="mt-3 grid gap-2 sm:grid-cols-3"><Stat label="Groups available" value={String(data?.collections.reduce((sum, item) => sum + item.groups, 0) ?? 0)} /><Stat label="Sets available" value={String(data?.collections.reduce((sum, item) => sum + item.sets, 0) ?? 0)} /><Stat label="Bookmarks saved" value={String(data?.counts.bookmarks ?? 0)} /><Stat label="Notes created" value={String(data?.counts.notes ?? 0)} /><Stat label="Revision queue" value={String(data?.counts.revision ?? 0)} /><Stat label="Drafts saved" value={String(data?.counts.drafts ?? 0)} /></div></div>
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="font-semibold">Recent Theory activity</h2><p className="mt-2 text-sm text-muted-foreground">{recent}</p><p className="mt-1 text-sm text-muted-foreground">{data?.recentSets?.[0] ? `${data.recentSets[0].collection} · ${data.recentSets[0].groupName}` : "Complete a review or self-rated practice attempt to build your history."}</p></div>
    <div className="flex flex-wrap gap-2">{[["Continue Studying", "theory-dashboard"], ["Browse End of Module", "theory-browse"], ["Browse End of Year", "theory-browse"], ["Open Bookmarks", "theory-bookmarks"], ["Open My Notes", "theory-notes"], ["Open Revision Queue", "theory-revision"], ["View Progress", "theory-progress"]].map(([label, screen]) => <button key={label} type="button" onClick={() => onNavigate(screen as Screen)} className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold transition hover:border-primary/40 hover:bg-primary/5">{label}</button>)}</div>
  </section>
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/55 px-3 py-2.5"><p className="text-sm font-bold">{value}</p><p className="text-[11px] font-medium text-muted-foreground">{label}</p></div> }

export function ProfileHistory({ activeHub = "mcq-qbank", onNavigate = () => {} }: { activeHub?: StudyHubId; onNavigate?: (screen: Screen) => void }) {
  const { progress } = useApp()
  const examScores = progress.examScores ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ProfileHeader />
      <TutorialSettings />
      {activeHub === "theory-vault" ? <TheoryProfilePanel onNavigate={onNavigate} /> : <><CosmeticLoadout />
      <PrivacySettings />
      <ModuleReviewSection />
      <ExamScores scores={examScores} /></>}
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

  const slots = [
    {
      type: "title" as const,
      label: "Title",
      description: "Shown beneath your name",
      items: ownedTitles,
      equipped: equippedCosmetics.title,
      getName: (item: typeof STORE_ITEMS[number]) => TITLE_LABELS[item.id] ?? item.name,
    },
    {
      type: "frame" as const,
      label: "Avatar Frame",
      description: "Ring effect around your avatar",
      items: ownedFrames,
      equipped: equippedCosmetics.frame,
      getName: (item: typeof STORE_ITEMS[number]) => item.name,
    },
    {
      type: "avatar" as const,
      label: "Avatar",
      description: "Your profile picture",
      items: ownedAvatars,
      equipped: equippedCosmetics.avatar,
      getName: (item: typeof STORE_ITEMS[number]) => item.name,
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">

      {/* Header */}
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">✨</span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Cosmetic Loadout</h2>
            <p className="text-xs text-muted-foreground">Tap any item to equip it</p>
          </div>
        </div>
      </div>

      {/* Slots */}
      <div className="divide-y divide-border">
        {slots.map(({ type, label, description, items, equipped, getName }) => (
          <div key={type} className="px-5 py-4">

            {/* Slot header */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="text-[11px] text-muted-foreground/60">{description}</p>
              </div>
              {savingType === type && (
                <span className="animate-pulse text-[10px] text-muted-foreground">Saving…</span>
              )}
            </div>

            {/* Item chips */}
            {items.length === 0 ? (
              <p className="text-sm italic text-muted-foreground/50">
                No {label.toLowerCase()}s owned — visit the Nexus Store
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {/* None / unequip chip */}
                <button
                  type="button"
                  onClick={() => equipped && handleEquip(type, null)}
                  disabled={savingType === type || !equipped}
                  className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all disabled:cursor-default disabled:opacity-40 ${
                    !equipped
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                  }`}
                >
                  None
                </button>

                {/* Owned item chips */}
                {items.map((item) => {
                  const isEquipped = equipped === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => !isEquipped && handleEquip(type, item.id)}
                      disabled={savingType === type || isEquipped}
                      title={item.desc}
                      className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all disabled:cursor-default ${
                        isEquipped
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <span className="text-sm leading-none">{item.icon}</span>
                      <span>{getName(item)}</span>
                      {isEquipped && (
                        <span className="ml-0.5 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                          On
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
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
