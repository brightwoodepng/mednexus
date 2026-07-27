"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft, ArrowRight, BookOpen, Bookmark, Check, CheckCircle2, ChevronDown, ChevronRight,
  Clock3, Download, FileText, FolderOpen, ListChecks, LoaderCircle, Mic, NotebookPen,
  RefreshCw, Save, Search, ShieldCheck, Sparkles, Square, Target, Timer, X,
} from "lucide-react"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/contexts/theme-context"
import { TheoryMarkdown } from "@/components/theory-markdown"
import { TheoryQuestionMedia } from "@/components/theory-question-media"
import type { TheoryQuestionDetail, TheorySelfRating, TheoryStudyMode } from "@/lib/types"

type View = "Dashboard" | "Browse Questions" | "Bookmarks" | "My Notes" | "Revision Queue" | "Progress" | "Search"
type DashboardData = {
  authenticated: boolean
  displayName: string
  totals: { total: number; completed: number }
  collections: Array<{ id: string; slug: string; title: string; kind: string; groups: number; sets: number; total: number; completed: number }>
  continueStudying: null | { id: string; setId: string | null; setTitle: string | null; setNumber: number | null; setLabel: string | null; collection: string; groupName: string; lastStudiedAt: string; setTotal: number; setCompleted: number }
  counts: { bookmarks: number; notes: number; drafts: number; revision: number }
  recentSets: Array<{ id: string; setId: string; setTitle: string; setNumber: number; setLabel: string; collection: string; groupName: string; lastStudiedAt: string; progressPercent: number }>
}
type CatalogData = {
  collections: Array<{ id: string; slug: string; title: string; kind: string; totalQuestions: number; completedQuestions: number }>
  modules: Array<{ id: string; collectionId: string; name: string; description: string }>
  disciplines: Array<{ id: string; collectionId: string; name: string }>
  sets: Array<{ id: string; collectionId: string; moduleId: string | null; disciplineId: string | null; name: string; description: string; setNumber: number; setLabel: string; totalQuestions: number; completedQuestions: number; rangeStart: number | null; rangeEnd: number | null }>
}
type SetData = {
  id: string; name: string; description: string; setNumber: number; setLabel: string; collectionTitle: string; collectionId: string
  moduleName: string | null; disciplineName: string | null; moduleId: string | null; disciplineId: string | null
  total: number; completed: number; progressPercent: number
  questions: Array<{ id: string; title: string; prompt: string; sortOrder: number; marks: number | null; completed: boolean; bookmarked: boolean; revision: boolean; draft: boolean }>
}
type LibraryItem = {
  id: string; title: string; prompt: string; collection: string; module: string | null; discipline: string | null
  setTitle: string | null; setNumber: number | null; setLabel: string | null; updatedAt: string; note: string | null; priority: number; confidence: string | null
}
type ProgressData = {
  totals: { total: number; completed: number; inProgress: number; needsRevision: number; high: number; medium: number; low: number; attempts: number; drafts: number; bookmarks: number; notes: number; revisions: number }
  groups: Array<{ collectionId: string; collection: string; groupId: string; name: string; total: number; completed: number; totalSets: number; completedSets: number }>
  recent: Array<{ type: string; occurredAt: string; questionId: string; prompt: string; groupName: string; setTitle: string; setNumber: number | null; setLabel: string | null }>
}
type TheoryAiStatus = {
  available: boolean
  consent: { required: boolean; version: string }
  actions: { refineNote: boolean; transcribeNote: boolean; transcribeAnswer: boolean }
  dailyLimit: number
  remaining: { refinements: number; transcriptions: number }
}

const card = "rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition"

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.")
  return data as T
}

async function mutate(payload: Record<string, unknown>) {
  return api<Record<string, unknown>>("/api/theory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not studied yet"
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))
}

function progressStatus(completed: number, total: number) {
  if (!completed) return "Not Started"
  if (completed >= total) return "Completed"
  return "In Progress"
}

function Empty({ icon: Icon = FileText, title, text }: { icon?: typeof FileText; title: string; text: string }) {
  return <div className={`${card} py-12 text-center`}><Icon className="mx-auto text-primary" size={30}/><h2 className="mt-4 text-lg font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{text}</p></div>
}

function ProgressBar({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/></div>
}

function KeyPointsList({ points }: { points: string[] }) {
  return <ul className="space-y-2">
    {points.map(point => (
      <li key={point} className="flex items-start gap-3 rounded-xl bg-primary/5 px-4 py-2.5 text-sm">
        <CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={15}/>
        <span>{point}</span>
      </li>
    ))}
  </ul>
}

function KeyPointsSection({ points }: { points: string[] }) {
  if (!points.length) return null
  return <>
    <details className="group mt-5 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 sm:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-primary [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><CheckCircle2 size={13}/></span>
          Key Points
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px]">{points.length}</span>
        </span>
        <ChevronDown size={17} className="transition-transform group-open:rotate-180"/>
      </summary>
      <div className="border-t border-primary/15 p-3"><KeyPointsList points={points}/></div>
    </details>
    <div className="mt-5 hidden sm:block">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 size={12}/>
        </div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Key Points</h3>
      </div>
      <KeyPointsList points={points}/>
    </div>
  </>
}

function SignInNotice() {
  return <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">Sign in with a student account to save drafts, bookmarks, notes, revision items, and progress.</div>
}

export function TheoryVault({ initialView = "Dashboard", externalQuery, onExternalQueryChange, onQuestionViewChange }: { initialView?: View; externalQuery?: string; onExternalQueryChange?: (q: string) => void; onQuestionViewChange?: (active: boolean) => void }) {
  const { user } = useApp()
  const registered = user?.role === "user" && user.sessionVerified
  const [view, setView] = useState<View>(initialView)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [catalog, setCatalog] = useState<CatalogData | null>(null)
  const [setData, setSetData] = useState<SetData | null>(null)
  const [questionId, setQuestionId] = useState<string | null>(null)
  const [sessionQuestionIds, setSessionQuestionIds] = useState<string[] | null>(null)
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [internalQuery, setInternalQuery] = useState("")
  const globalQuery = externalQuery !== undefined ? externalQuery : internalQuery
  const setGlobalQuery = onExternalQueryChange ?? setInternalQuery
  const showingQuestion = questionId !== null

  const loadDashboard = useCallback(async () => {
    setLoading(true); setError("")
    try { setDashboard(await api<DashboardData>("/api/theory/dashboard")) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load Theory Vault.") }
    finally { setLoading(false) }
  }, [])

  const loadCatalog = useCallback(async () => {
    setLoading(true); setError("")
    try { setCatalog(await api<CatalogData>("/api/theory?mode=catalog")) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to browse Theory Vault.") }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (view === "Dashboard") void loadDashboard()
    else if (view === "Browse Questions") void loadCatalog()
    else setLoading(false)
  }, [view, loadDashboard, loadCatalog])

  useEffect(() => {
    onQuestionViewChange?.(showingQuestion)
    return () => {
      if (showingQuestion) onQuestionViewChange?.(false)
    }
  }, [onQuestionViewChange, showingQuestion])

  const navigate = (next: View) => {
    setQuestionId(null); setSessionQuestionIds(null); setSetData(null); setCollectionId(null); setGroupId(null); setError(""); setView(next)
  }
  const search = () => {
    if (!globalQuery.trim()) return
    setView("Search")
  }
  const openSet = async (id: string) => {
    setLoading(true); setError("")
    try { setSetData(await api<SetData>(`/api/theory?mode=set&id=${encodeURIComponent(id)}`)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open this set.") }
    finally { setLoading(false) }
  }
  const openQuestion = (id: string) => { setSessionQuestionIds(null); setQuestionId(id) }
  const openSession = (questionIds: string[]) => {
    if (!questionIds.length) return
    setSessionQuestionIds(questionIds)
    setQuestionId(questionIds[0])
  }
  const finishQuestion = async (setId: string | null) => {
    setQuestionId(null)
    setSessionQuestionIds(null)
    if (setId) await openSet(setId)
  }

  return <div className="mx-auto max-w-7xl space-y-5">

    {error && <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    {loading ? <div className={`${card} py-14 text-center text-sm text-muted-foreground`}>Opening Theory Vault…</div>
      : questionId ? <StudyQuestion questionId={questionId} sessionQuestionIds={sessionQuestionIds} registered={Boolean(registered)} onBack={() => { setQuestionId(null); setSessionQuestionIds(null) }} onFinish={finishQuestion} onMove={setQuestionId}/>
      : setData ? <SetOverview data={setData} registered={Boolean(registered)} onBack={() => setSetData(null)} onOpen={openQuestion} onSession={openSession}/>
      : view === "Dashboard" ? <Dashboard data={dashboard} displayName={user?.name} onView={navigate} onCollection={id => { setCollectionId(id); setView("Browse Questions") }} onSet={openSet} onQuestion={openQuestion}/>
      : view === "Browse Questions" ? <Catalog data={catalog} collectionId={collectionId} groupId={groupId} onCollection={setCollectionId} onGroup={setGroupId} onBack={() => groupId ? setGroupId(null) : setCollectionId(null)} onSet={openSet}/>
      : view === "Search" ? <SearchView initialQuery={globalQuery} onOpen={openQuestion}/>
      : view === "Progress" ? <ProgressView registered={Boolean(registered)}/>
      : <LibraryView view={view} registered={Boolean(registered)} onOpen={openQuestion} onSession={openSession}/>}
  </div>
}

const CATEGORY_PALETTES = [
  { ring: "hover:ring-sky-400/50",     icon: "bg-sky-100 text-sky-600",         bar: "#0ea5e9" },
  { ring: "hover:ring-violet-400/50",  icon: "bg-violet-100 text-violet-600",   bar: "#8b5cf6" },
  { ring: "hover:ring-emerald-400/50", icon: "bg-emerald-100 text-emerald-600", bar: "#10b981" },
  { ring: "hover:ring-amber-400/50",   icon: "bg-amber-100 text-amber-600",     bar: "#f59e0b" },
]

const THEORY_MOTIVATIONS = [
  "Every answer you write sharpens your reasoning.",
  "Clinical mastery is built one question at a time.",
  "Write it out — that's how it sticks.",
  "The best doctors never stop studying.",
  "Active recall beats passive reading, every time.",
  "Your future patients benefit from today's effort.",
  "Understand the 'why' behind every answer.",
]

function TheoryStatCard({ glass, emoji, label, value, sub, color, onClick }: { glass: boolean; emoji: string; label: string; value: string | number; sub: string; color: string; onClick?: () => void }) {
  const base = `flex flex-col gap-1 rounded-3xl p-4 sm:p-5 ${glass ? "glass-card" : "border bg-card shadow-sm"} ${onClick ? "cursor-pointer transition-opacity hover:opacity-80" : ""}`
  return (
    <div className={base} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="flex items-center justify-between">
        <span className="text-xl">{emoji}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${color}`}>{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function Dashboard({ data, displayName, onView, onCollection, onSet, onQuestion }: {
  data: DashboardData | null; displayName?: string; onView: (view: View) => void; onCollection: (id: string) => void
  onSet: (id: string) => void; onQuestion: (id: string) => void
}) {
  const { isGlassEnabled } = useTheme()
  if (!data) return <Empty title="Theory Vault is unavailable" text="Connect the application database and run migrations to begin."/>
  const total = Number(data.totals.total), completed = Number(data.totals.completed)
  const overall = total ? Math.round(completed / total * 100) : 0
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
  const firstName = (displayName || data.displayName)?.split(" ")[0] ?? "there"
  const motivation = THEORY_MOTIVATIONS[new Date().getDate() % THEORY_MOTIVATIONS.length]
  const categories = ["End of Module", "End of Year"].map(title => data.collections.find(item => item.title === title) ?? { id: "", title, groups: 0, sets: 0, total: 0, completed: 0 })
  const resume = () => data.continueStudying?.setId ? onSet(data.continueStudying.setId) : onView("Browse Questions")

  return <div className="space-y-5 sm:space-y-8">
    {!data.authenticated && <SignInNotice/>}

    {/* ── Hero banner — matches MCQ style ── */}
    <div className="relative">
      <div className="relative rounded-2xl bg-primary px-5 py-5 text-primary-foreground shadow-lg sm:rounded-3xl sm:px-8 sm:py-8 overflow-hidden">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.07]" />
        <div className="pointer-events-none absolute -bottom-10 right-20 h-28 w-28 rounded-full bg-white/[0.04]" />
        <div className="pointer-events-none absolute bottom-4 left-1/2 h-16 w-16 rounded-full bg-white/[0.03]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium opacity-80">{greeting},</p>
            <h1 className="mt-0.5 text-3xl font-bold tracking-tight sm:text-4xl">{firstName} 👋</h1>
            <p className="mt-2 max-w-xs text-sm opacity-75 text-pretty">{motivation}</p>
          </div>
          <button type="button" onClick={resume} className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30">
            <BookOpen size={16}/> Continue
          </button>
        </div>
      </div>
    </div>

    {/* ── Stat cards — matches MCQ StatCard style ── */}
    <section>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
        <TheoryStatCard glass={isGlassEnabled} emoji="📋" label="Completed" value={completed} sub={total ? `of ${total} questions` : "no questions yet"} color="bg-sky-50 text-sky-700 border-sky-200/80" onClick={() => onView("Progress")} />
        <TheoryStatCard glass={isGlassEnabled} emoji="🔁" label="Revision" value={data.counts.revision} sub="items queued" color="bg-amber-50 text-amber-700 border-amber-200/80" onClick={() => onView("Revision Queue")} />
        <TheoryStatCard glass={isGlassEnabled} emoji="🔖" label="Bookmarks" value={data.counts.bookmarks} sub="saved questions" color="bg-violet-50 text-violet-700 border-violet-200/80" onClick={() => onView("Bookmarks")} />
        <TheoryStatCard glass={isGlassEnabled} emoji="📝" label="Notes" value={data.counts.notes} sub="notes created" color="bg-rose-50 text-rose-700 border-rose-200/80" onClick={() => onView("My Notes")} />
      </div>
    </section>

    {/* ── Study Categories ── */}
    <section>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FolderOpen size={16} />
          </div>
          <h2 className="text-lg font-bold tracking-tight">Study Categories</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {categories.map((category, idx) => {
          const palette = CATEGORY_PALETTES[idx % CATEGORY_PALETTES.length]
          const catProgress = category.total ? Math.round(Number(category.completed) / Number(category.total) * 100) : 0
          const subLabel = category.title === "End of Module" ? "modules" : "disciplines"
          return (
            <div key={category.title} className={`group relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm ring-0 transition-all hover:shadow-md hover:ring-2 active:scale-[0.98] ${palette.ring}`}>
              {/* Color top bar — same as MCQ ModuleCard */}
              <div className="pointer-events-none absolute left-0 right-0 top-0 h-1 opacity-80" style={{ background: palette.bar }} />
              <div className="p-4 sm:p-5">
                <div className="mb-3 mt-1 flex items-start justify-between gap-2">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${palette.icon}`}>
                    <FolderOpen size={18} />
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${palette.bar}18`, color: palette.bar }}>{catProgress}%</span>
                </div>
                <h3 className="font-bold text-foreground leading-snug">{category.title}</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">{category.groups} {subLabel} · {category.sets} sets · {category.total}Q</p>
                <but…10434 tokens truncated…privacy notice and check your daily quota first." : `Dictate ${target}`}
          className={`${button} w-full border border-border disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto`}>
          {transcribing ? <LoaderCircle className="animate-spin" size={15}/> : <Mic size={15}/>}
          {transcribing ? "Transcribing…" : "Dictate"}
        </button>
      )}
      {recording && <>
        <span className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 text-sm font-bold text-destructive sm:flex-none">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive"/> {timer} / 5:00
        </span>
        <button type="button" onClick={stopRecording} className={`${button} flex-1 bg-primary text-primary-foreground sm:flex-none`}><Square size={14} fill="currentColor"/> Stop</button>
        <button type="button" onClick={cancelRecording} className={`${button} flex-1 border border-border sm:flex-none`}><X size={15}/> Cancel</button>
      </>}
      {error && <p className="w-full text-xs leading-5 text-destructive">{error}</p>}
    </div>
  )
}

function NoteEditor({
  note, questionId, registered, aiStatus, onChange, onSave, onQuota,
}: {
  note: string
  questionId: string
  registered: boolean
  aiStatus: TheoryAiStatus | null
  onChange: (value: string) => void
  onSave: () => void
  onQuota: (kind: "refinements" | "transcriptions", remaining: number) => void
}) {
  const [refining, setRefining] = useState(false)
  const [preview, setPreview] = useState<{ original: string; refined: string } | null>(null)
  const [error, setError] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const aiEnabled = registered && Boolean(aiStatus?.available) && !aiStatus?.consent.required

  const refine = async () => {
    if (!note.trim()) {
      setError("Write a note before asking Gemini to refine it.")
      return
    }
    setRefining(true)
    setError("")
    setPreview(null)
    try {
      const result = await api<{ refinedNote: string; remaining: number }>("/api/theory/ai/refine-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, note }),
      })
      setPreview({ original: note, refined: result.refinedNote })
      onQuota("refinements", result.remaining)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gemini could not refine this note.")
    } finally {
      setRefining(false)
    }
  }
  const insertNoteTranscript = (text: string, position: number) => {
    onChange(insertDictation(note, text, position))
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }

  return (
    <aside className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-5 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><NotebookPen size={13}/></div>
        <h2 className="font-bold">My Note</h2>
      </div>
      <div className="p-4">
        <textarea ref={textareaRef} value={note} onChange={event => onChange(event.target.value)} rows={9}
          placeholder="Jot down key takeaways, mnemonics, or reminders…"
          className="w-full rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/25"/>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={refine}
            disabled={!aiEnabled || refining || !note.trim() || (aiStatus?.remaining.refinements ?? 0) <= 0}
            className={`${button} flex-1 border border-primary/30 text-primary disabled:cursor-not-allowed disabled:opacity-50`}>
            {refining ? <LoaderCircle className="animate-spin" size={15}/> : <Sparkles size={15}/>}
            {refining ? "Refining…" : "Refine with AI"}
          </button>
          {registered && <DictationControl questionId={questionId} target="note" textareaRef={textareaRef}
            disabled={!aiEnabled || (aiStatus?.remaining.transcriptions ?? 0) <= 0}
            onTranscript={insertNoteTranscript}
            onQuota={remaining => onQuota("transcriptions", remaining)}/>}
        </div>
        {aiEnabled && aiStatus && <p className="mt-2 text-xs text-muted-foreground">
          {aiStatus.remaining.refinements} refinements · {aiStatus.remaining.transcriptions} transcriptions left today
        </p>}
        {error && <p className="mt-2 text-xs leading-5 text-destructive">{error}</p>}
        {preview && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Review the polished note</p>
            <div className="mt-3 grid gap-3">
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Original</p>
                <div className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-xs leading-5">{preview.original}</div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">Polished</p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-primary/20 bg-background p-3 text-xs leading-5"><TheoryMarkdown children={preview.refined}/></div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => { onChange(preview.refined); setPreview(null) }} className={`${button} min-h-9 flex-1 bg-primary text-primary-foreground`}>Accept</button>
              <button onClick={() => setPreview(null)} className={`${button} min-h-9 flex-1 border border-border`}>Discard</button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Accepting changes the editor only. Use Save Note when you are ready.</p>
          </div>
        )}
        <button onClick={onSave} className={`${button} mt-3 w-full bg-primary text-primary-foreground`}><Save size={15}/> Save Note</button>
      </div>
    </aside>
  )
}

function Rating({ label, text, onClick }: { label: string; text: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-xl border border-border p-4 text-left transition hover:border-primary/45 hover:bg-primary/5"><b>{label}</b><span className="mt-1 block text-xs text-muted-foreground">{text}</span></button>
}

function TheoryLibraryCard({ item, colored, onOpen }: { item: LibraryItem; colored: boolean; onOpen: (id: string) => void }) {
  const palette = CATEGORY_PALETTES[item.collection === "End of Year" ? 1 : 0]
  return <article className={`relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-all sm:p-5 ${colored ? `ring-0 hover:shadow-md hover:ring-2 ${palette.ring}` : ""}`}>
    {colored && <div className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-80" style={{ background: palette.bar }}/>}
    <div className="flex items-start gap-2">
      {colored && <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${palette.icon}`}><Bookmark size={14} fill="currentColor"/></div>}
      <p className={`min-w-0 break-words text-xs font-semibold ${colored ? "rounded-full px-2.5 py-1" : "text-primary"}`} style={colored ? { background: `${palette.bar}18`, color: palette.bar } : undefined}>
        {item.collection} · {item.module ?? item.discipline} · {item.setLabel ?? "Unassigned"}
      </p>
    </div>
    <h2 className="mt-2 break-words font-bold">{item.title || item.prompt}</h2>
    {item.note && <p className="mt-3 line-clamp-3 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{item.note}</p>}
    <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-muted-foreground">{dateLabel(item.updatedAt)}{item.confidence ? ` · ${item.confidence} confidence` : ""}</span>
      <button onClick={() => onOpen(item.id)} className={`${button} w-full border border-border px-3 sm:w-auto`}>Open Question<ChevronRight size={16}/></button>
    </div>
  </article>
}

function LibraryView({ view, registered, onOpen, onSession }: { view: Exclude<View, "Dashboard" | "Browse Questions" | "Search" | "Progress">; registered: boolean; onOpen: (id: string) => void; onSession: (ids: string[]) => void }) {
  const apiView = view === "My Notes" ? "notes" : view === "Revision Queue" ? "revision" : "bookmarks"
  const [items, setItems] = useState<LibraryItem[]>([])
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState("recent")
  const [error, setError] = useState("")
  useEffect(() => {
    if (!registered) return
    const timer = window.setTimeout(() => {
      void api<{ items: LibraryItem[] }>(`/api/theory?mode=library&view=${apiView}&q=${encodeURIComponent(query)}&sort=${sort}`)
        .then(data => setItems(data.items)).catch(cause => setError(cause.message))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [apiView, query, registered, sort])
  if (!registered) return <><SignInNotice/><Empty icon={view === "Bookmarks" ? Bookmark : view === "My Notes" ? NotebookPen : RefreshCw} title={view} text="This personal study space becomes available after you sign in."/></>
  const emptyText = view === "Bookmarks" ? "Bookmark important questions for quick access." : view === "My Notes" ? "Your notes will appear here." : "No questions need revision yet."
  return <div className="space-y-4"><div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-bold">{view}</h1><p className="mt-1 text-sm text-muted-foreground">{items.length} items</p></div><ExportButton source={apiView}/></div>
    {error && <div className="text-sm text-destructive">{error}</div>}<div className="grid gap-3 sm:grid-cols-[1fr_180px]"><label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${view.toLowerCase()}`} className="min-w-0 w-full bg-transparent text-sm outline-none"/></label><select value={sort} onChange={event => setSort(event.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-card px-3 text-sm"><option value="recent">Recently added</option><option value="module">Module / discipline</option>{view === "Revision Queue" && <option value="priority">Priority</option>}</select></div>
    {view === "Revision Queue" && items.length > 0 && <button onClick={async () => { const session = await mutate({ action: "session", kind: "revision" }) as { questionIds?: string[] }; if (session.questionIds?.[0]) onSession(session.questionIds) }} className={`${button} w-full bg-primary text-primary-foreground sm:w-auto`}><Timer size={16}/> Start Revision</button>}
    {items.length ? <div className="space-y-3">{items.map(item => <TheoryLibraryCard key={item.id} item={item} colored={view === "Bookmarks"} onOpen={onOpen}/>)}</div> : <Empty icon={view === "Bookmarks" ? Bookmark : view === "My Notes" ? NotebookPen : RefreshCw} title="Nothing here yet" text={emptyText}/>}
  </div>
}

function SearchView({ initialQuery, onOpen }: { initialQuery: string; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState(initialQuery)
  const [items, setItems] = useState<Array<{ id: string; title: string; prompt: string; collection: string; module: string | null; discipline: string | null; setTitle: string | null; setNumber: number | null; setLabel: string | null }>>([])
  const [total, setTotal] = useState(0)
  useEffect(() => {
    if (query.trim().length < 2) { setItems([]); setTotal(0); return }
    const timer = window.setTimeout(() => {
      void api<{ items: typeof items; total: number }>(`/api/theory?mode=search&q=${encodeURIComponent(query)}`)
        .then(data => { setItems(data.items); setTotal(data.total) }).catch(() => { setItems([]); setTotal(0) })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])
  return <div className="space-y-4"><div><h1 className="text-2xl font-bold">Search Theory Vault</h1><p className="mt-1 text-sm text-muted-foreground">Search modules, disciplines, sets, prompts, model answers, tags, and your notes.</p></div><label className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card px-4"><Search size={18}/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} className="w-full bg-transparent outline-none" placeholder="Enter at least two characters"/></label><p className="text-sm text-muted-foreground">{total} results</p>
    {items.length ? <div className="space-y-3">{items.map(item => <button key={item.id} onClick={() => onOpen(item.id)} className={`${card} w-full text-left hover:border-primary/45`}><p className="text-xs font-semibold text-primary">{item.collection} · {item.module ?? item.discipline} · {item.setLabel ?? "Unassigned"}</p><h2 className="mt-2 font-bold"><Highlight text={item.title || item.prompt} query={query}/></h2><p className="mt-2 line-clamp-2 text-sm text-muted-foreground"><Highlight text={item.prompt} query={query}/></p></button>)}</div> : query.length >= 2 ? <Empty icon={Search} title="No matching theory content" text="Try a broader clinical term, module, discipline, or tag."/> : null}
  </div>
}

function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index < 0) return <>{text}</>
  return <>{text.slice(0, index)}<mark className="rounded bg-amber-200 px-0.5 text-foreground">{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>
}

function ProgressView({ registered }: { registered: boolean }) {
  const [data, setData] = useState<ProgressData | null>(null)
  useEffect(() => { if (registered) void api<ProgressData>("/api/theory?mode=progress").then(setData).catch(() => setData(null)) }, [registered])
  if (!registered) return <><SignInNotice/><Empty icon={Target} title="Theory progress" text="Sign in to track completed questions, confidence, sets, modules, and recent activity."/></>
  if (!data) return <div className={`${card} py-14 text-center text-sm text-muted-foreground`}>Loading Theory progress…</div>
  const total = Number(data.totals.total), completed = Number(data.totals.completed), overall = total ? Math.round(completed / total * 100) : 0
  const stats = [["Total Questions", total], ["Completed", completed], ["In Progress", data.totals.inProgress], ["Needs Revision", data.totals.needsRevision], ["Overall Completion", `${overall}%`]]
  return <div className="space-y-5 sm:space-y-6"><div><h1 className="text-2xl font-bold">Theory Vault Progress</h1><p className="mt-1 text-sm text-muted-foreground">Real activity from Review and Practice modes.</p></div><section className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-5">{stats.map(([label, value], index) => <div key={label} className={`${card} ${index === stats.length - 1 ? "col-span-2 xl:col-span-1" : ""}`}><p className="text-xl font-bold text-primary sm:text-2xl">{value}</p><p className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</p></div>)}</section>
    <section className={`${card} grid gap-5 md:grid-cols-2`}><div><h2 className="font-bold">Confidence distribution</h2><div className="mt-4 space-y-3">{[["High", data.totals.high], ["Medium", data.totals.medium], ["Low", data.totals.low]].map(([label, value]) => <div key={label as string} className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm"><span>{label}</span><b>{value}</b></div>)}</div></div><div><h2 className="font-bold">Study records</h2><div className="mt-4 grid grid-cols-2 gap-3">{[["Practice attempts",data.totals.attempts],["Drafts",data.totals.drafts],["Bookmarks",data.totals.bookmarks],["Notes",data.totals.notes]].map(([label,value]) => <div key={label as string} className="rounded-xl bg-muted p-3"><b className="text-xl">{value}</b><span className="block text-xs text-muted-foreground">{label}</span></div>)}</div></div></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">Module and year progress</h2>{data.groups.map(group => { const value = group.total ? Math.round(group.completed / group.total * 100) : 0; return <article key={`${group.collectionId}-${group.groupId}`} className={card}><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold text-primary">{group.collection}</p><h3 className="mt-1 font-bold">{group.name}</h3><p className="mt-1 text-xs text-muted-foreground">{group.completed}/{group.total} questions · {group.completedSets}/{group.totalSets} sets completed</p></div><b className="text-primary">{value}%</b></div><div className="mt-4"><ProgressBar value={value}/></div></article>})}</section>
    <section className={card}><h2 className="font-bold">Recent study activity</h2>{data.recent.length ? <div className="mt-3 divide-y divide-border">{data.recent.map((item, index) => <div key={`${item.occurredAt}-${index}`} className="py-3 text-sm"><b>{item.prompt || item.type}</b><p className="mt-1 text-xs text-muted-foreground">{item.groupName} · {item.setLabel ?? "Unassigned"} · {dateLabel(item.occurredAt)}</p></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Your recent Theory activity will appear here.</p>}</section>
  </div>
}

function ExportButton({ source, sourceId }: { source: "set" | "bookmarks" | "revision" | "notes"; sourceId?: string }) {
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState(true)
  const [notes, setNotes] = useState(source === "notes")
  const [busy, setBusy] = useState(false)
  const download = async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/theory/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, sourceId, includeAnswers: answers, includeNotes: notes }) })
      if (!response.ok) throw new Error("Export failed")
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a"); anchor.href = url
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "theory-vault.pdf"
      anchor.click(); URL.revokeObjectURL(url); setOpen(false)
    } finally { setBusy(false) }
  }
  return <div className="relative w-full sm:w-auto"><button onClick={() => setOpen(value => !value)} className={`${button} w-full border border-border sm:w-auto`}><Download size={16}/> Export PDF</button>{open && <div role="dialog" aria-label="PDF export options" className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-[60] rounded-2xl border border-border bg-card p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:z-20 sm:mt-2 sm:w-72 sm:shadow-xl"><h3 className="font-bold">PDF options</h3><label className="mt-3 flex min-h-11 items-center justify-between gap-4 text-sm">Questions and model answers<input type="checkbox" checked={answers} onChange={event => setAnswers(event.target.checked)} className="h-4 w-4 shrink-0 accent-primary"/></label><label className="mt-3 flex min-h-11 items-center justify-between gap-4 text-sm">Include personal notes<input type="checkbox" checked={notes} onChange={event => setNotes(event.target.checked)} className="h-4 w-4 shrink-0 accent-primary"/></label><button onClick={download} disabled={busy} className={`${button} mt-4 w-full bg-primary text-primary-foreground disabled:opacity-50`}>{busy ? "Generating…" : "Download PDF"}</button></div>}</div>
}
