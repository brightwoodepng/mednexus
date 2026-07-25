"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft, ArrowRight, BookOpen, Bookmark, Check, CheckCircle2, ChevronRight,
  Clock3, Download, FileText, FolderOpen, ListChecks, NotebookPen, RefreshCw,
  Save, Search, Target, Timer, X,
} from "lucide-react"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/contexts/theme-context"
import { TheoryMarkdown } from "@/components/theory-markdown"
import type { TheoryQuestionDetail, TheorySelfRating, TheoryStudyMode } from "@/lib/types"

type View = "Dashboard" | "Browse Questions" | "Bookmarks" | "My Notes" | "Revision Queue" | "Progress" | "Search"
type DashboardData = {
  authenticated: boolean
  displayName: string
  totals: { total: number; completed: number }
  collections: Array<{ id: string; slug: string; title: string; kind: string; groups: number; sets: number; total: number; completed: number }>
  continueStudying: null | { id: string; setId: string | null; setTitle: string | null; collection: string; groupName: string; lastStudiedAt: string; setTotal: number; setCompleted: number }
  counts: { bookmarks: number; notes: number; drafts: number; revision: number }
  recentSets: Array<{ id: string; setId: string; setTitle: string; collection: string; groupName: string; lastStudiedAt: string; progressPercent: number }>
}
type CatalogData = {
  collections: Array<{ id: string; slug: string; title: string; kind: string; totalQuestions: number; completedQuestions: number }>
  modules: Array<{ id: string; collectionId: string; name: string; description: string }>
  disciplines: Array<{ id: string; collectionId: string; name: string }>
  sets: Array<{ id: string; collectionId: string; moduleId: string | null; disciplineId: string | null; name: string; description: string; totalQuestions: number; completedQuestions: number; rangeStart: number | null; rangeEnd: number | null }>
}
type SetData = {
  id: string; name: string; description: string; collectionTitle: string; collectionId: string
  moduleName: string | null; disciplineName: string | null; moduleId: string | null; disciplineId: string | null
  total: number; completed: number; progressPercent: number
  questions: Array<{ id: string; title: string; prompt: string; sortOrder: number; marks: number | null; completed: boolean; bookmarked: boolean; revision: boolean; draft: boolean }>
}
type LibraryItem = {
  id: string; title: string; prompt: string; collection: string; module: string | null; discipline: string | null
  setTitle: string | null; updatedAt: string; note: string | null; priority: number; confidence: string | null
}
type ProgressData = {
  totals: { total: number; completed: number; inProgress: number; needsRevision: number; high: number; medium: number; low: number; attempts: number; drafts: number; bookmarks: number; notes: number; revisions: number }
  groups: Array<{ collectionId: string; collection: string; groupId: string; name: string; total: number; completed: number; totalSets: number; completedSets: number }>
  recent: Array<{ type: string; occurredAt: string; questionId: string; prompt: string; groupName: string; setTitle: string }>
}

const card = "rounded-2xl border border-border bg-card p-5 shadow-sm"
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

function SignInNotice() {
  return <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">Sign in with a student account to save drafts, bookmarks, notes, revision items, and progress.</div>
}

export function TheoryVault({ initialView = "Dashboard", externalQuery, onExternalQueryChange }: { initialView?: View; externalQuery?: string; onExternalQueryChange?: (q: string) => void }) {
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

  return <div className="mx-auto max-w-7xl space-y-5">

    {error && <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    {loading ? <div className={`${card} py-14 text-center text-sm text-muted-foreground`}>Opening Theory Vault…</div>
      : questionId ? <StudyQuestion questionId={questionId} sessionQuestionIds={sessionQuestionIds} registered={Boolean(registered)} onBack={() => { setQuestionId(null); setSessionQuestionIds(null) }} onMove={setQuestionId}/>
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
  const resume = () => data.continueStudying ? onQuestion(data.continueStudying.id) : onView("Browse Questions")

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
          <div className="flex flex-col items-stretch gap-2">
            {overall > 0 && (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-white/15 px-5 py-2 backdrop-blur-sm text-center">
                <span className="text-lg leading-none">📖</span>
                <div>
                  <p className="text-base font-bold leading-tight">{overall}%</p>
                  <p className="text-[11px] opacity-80">complete</p>
                </div>
              </div>
            )}
            <button type="button" onClick={resume} className="flex items-center justify-center gap-2 rounded-2xl bg-white/20 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30">
              <BookOpen size={16}/> Continue
            </button>
          </div>
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

    {/* ── Study Categories + Recently Studied — two labelled sections, equal card height ── */}
    <div className="flex gap-4">

      {/* ── Left: Study Categories (takes 2/3) ── */}
      <div className="flex min-w-0 flex-[2] flex-col gap-2">
        {/* Section label */}
        <div className="flex h-8 items-center gap-2 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FolderOpen size={14} />
          </div>
          <h2 className="text-sm font-bold tracking-tight text-foreground/70">Study Categories</h2>
        </div>
        {/* Two cards side by side, same height */}
        <div className="grid flex-1 grid-cols-2 gap-4">
          {categories.map((category, idx) => {
            const palette = CATEGORY_PALETTES[idx % CATEGORY_PALETTES.length]
            const catProgress = category.total ? Math.round(Number(category.completed) / Number(category.total) * 100) : 0
            const subLabel = category.title === "End of Module" ? "modules" : "disciplines"
            return (
              <div key={category.title} className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:ring-2 active:scale-[0.98] ${palette.ring}`}>
                <div className="pointer-events-none absolute left-0 right-0 top-0 h-1 opacity-80" style={{ background: palette.bar }} />
                <div className="flex flex-1 flex-col p-5">
                  {/* Top row: icon + % */}
                  <div className="flex items-center justify-between">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${palette.icon}`}>
                      <FolderOpen size={17} />
                    </div>
                    <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: `${palette.bar}18`, color: palette.bar }}>{catProgress}%</span>
                  </div>
                  {/* Middle: title + meta — flex-1 pushes button to bottom */}
                  <div className="mt-4 flex-1">
                    <h3 className="font-bold leading-snug text-foreground">{category.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{category.groups} {subLabel} · {category.sets} sets · {category.total} Q</p>
                  </div>
                  {/* Bottom: browse button */}
                  <button
                    type="button"
                    disabled={!category.id}
                    onClick={() => category.id && onCollection(category.id)}
                    className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all disabled:opacity-40"
                    style={{ background: `${palette.bar}18`, color: palette.bar }}
                  >
                    Browse {category.title} <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Right: Recently Studied (takes 1/3) ── */}
      <div className="flex min-w-0 flex-[1] flex-col gap-2">
        {/* Section label */}
        <div className="flex h-8 items-center gap-2 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "#0d948820", color: "#0d9488" }}>
            <BookOpen size={14} />
          </div>
          <h2 className="text-sm font-bold tracking-tight text-foreground/70">Recently Studied</h2>
        </div>
        {/* Card — same height as category cards via flex-1 */}
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="pointer-events-none absolute left-0 right-0 top-0 h-1 opacity-80" style={{ background: "#0d9488" }} />
          <div className="flex flex-1 flex-col p-5">
            {/* Top row: matches icon row height of category cards */}
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#0d948820", color: "#0d9488" }}>
                <BookOpen size={17} />
              </div>
              <button type="button" onClick={() => onView("Progress")} className="rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors" style={{ background: "#0d948820", color: "#0d9488" }}>View all</button>
            </div>
            {/* Middle: content — flex-1 */}
            <div className="mt-4 flex-1">
              <h3 className="font-bold leading-snug text-foreground">Pick up where you stopped</h3>
              {data.recentSets.length ? (
                <div className="mt-3 space-y-2">
                  {data.recentSets.slice(0, 3).map(item => (
                    <div key={`${item.setId}-${item.lastStudiedAt}`} className="rounded-xl bg-muted/50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs font-semibold">{item.setTitle}</p>
                        <span className="shrink-0 text-[11px] font-bold" style={{ color: "#0d9488" }}>{item.progressPercent}%</span>
                      </div>
                      <div className="mt-1.5"><ProgressBar value={item.progressPercent}/></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">No sets studied yet. Start a theory set to track your progress here.</p>
              )}
            </div>
            {/* Bottom: action button — mirrors category card button */}
            <button
              type="button"
              onClick={() => data.recentSets[0] ? onSet(data.recentSets[0].setId) : onView("Browse Questions")}
              className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all"
              style={{ background: "#0d948820", color: "#0d9488" }}
            >
              {data.recentSets.length ? <>Continue Last Set <ChevronRight size={12} /></> : <>Browse Sets <ChevronRight size={12} /></>}
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
}

function Catalog({ data, collectionId, groupId, onCollection, onGroup, onBack, onSet }: {
  data: CatalogData | null; collectionId: string | null; groupId: string | null; onCollection: (id: string) => void
  onGroup: (id: string) => void; onBack: () => void; onSet: (id: string) => void
}) {
  if (!data?.collections.length) return <Empty title="Start your first theory set" text="No published Theory Vault content is available yet."/>
  const selectedCollection = data.collections.find(item => item.id === collectionId)
  const groups = selectedCollection?.kind === "end_of_module"
    ? data.modules.filter(item => item.collectionId === collectionId)
    : data.disciplines.filter(item => item.collectionId === collectionId)
  const sets = data.sets.filter(item => item.collectionId === collectionId && (!groupId || item.moduleId === groupId || item.disciplineId === groupId))
  if (!selectedCollection) return <div className="space-y-4"><div><h1 className="text-2xl font-bold">Browse Theory Questions</h1><p className="mt-1 text-sm text-muted-foreground">Choose End of Module or End of Year, then open a focused set.</p></div>
    <div className="grid gap-5 md:grid-cols-2">{data.collections.map(collection => <button type="button" key={collection.id} onClick={() => onCollection(collection.id)} className={`${card} p-6 text-left transition hover:border-primary/45`}>
      <BookOpen className="text-primary"/><h2 className="mt-5 text-xl font-bold">{collection.title}</h2><p className="mt-2 text-sm text-muted-foreground">{collection.totalQuestions} published questions</p><div className="mt-4"><ProgressBar value={collection.totalQuestions ? Math.round(collection.completedQuestions / collection.totalQuestions * 100) : 0}/></div>
    </button>)}</div></div>
  if (!groupId) return <div className="space-y-4"><button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft size={16}/> Categories</button><div><p className="text-sm text-primary">{selectedCollection.title}</p><h1 className="text-2xl font-bold">{selectedCollection.kind === "end_of_module" ? "Modules" : "Disciplines"}</h1></div>
    {groups.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{groups.map(group => {
      const count = data.sets.filter(item => item.moduleId === group.id || item.disciplineId === group.id).length
      return <button key={group.id} onClick={() => onGroup(group.id)} className={`${card} text-left hover:border-primary/45`}><FolderOpen className="text-primary"/><h2 className="mt-4 font-bold">{group.name}</h2><p className="mt-1 text-sm text-muted-foreground">{count} sets</p></button>
    })}</div> : <Empty title="No study groups yet" text="Published modules or disciplines will appear here."/>}</div>
  const groupName = groups.find(item => item.id === groupId)?.name ?? "Study sets"
  return <div className="space-y-4"><button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft size={16}/> {selectedCollection.title}</button><div><p className="text-sm text-primary">{selectedCollection.title}</p><h1 className="text-2xl font-bold">{groupName}</h1></div>
    {sets.length ? <div className="grid gap-4 md:grid-cols-2">{sets.map(set => {
      const progress = set.totalQuestions ? Math.round(set.completedQuestions / set.totalQuestions * 100) : 0
      return <article key={set.id} className={card}><div className="flex justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-primary">{progressStatus(set.completedQuestions, set.totalQuestions)}</p><h2 className="mt-2 text-lg font-bold">{set.name}</h2></div><span className="text-sm font-bold text-primary">{progress}%</span></div>
        <p className="mt-2 text-sm text-muted-foreground">{set.description || `${set.totalQuestions} focused long-answer questions`}</p>
        <p className="mt-3 text-xs text-muted-foreground">Questions {set.rangeStart ?? "—"}–{set.rangeEnd ?? "—"} · {set.totalQuestions} total</p><div className="mt-4"><ProgressBar value={progress}/></div>
        <button onClick={() => onSet(set.id)} className={`${button} mt-5 bg-primary text-primary-foreground`}>{set.completedQuestions ? "Continue Set" : "Start Set"}<ArrowRight size={16}/></button>
      </article>})}</div> : <Empty title="No published sets" text="This section does not have a published question set yet."/>}</div>
}

function SetOverview({ data, registered, onBack, onOpen, onSession }: { data: SetData; registered: boolean; onBack: () => void; onOpen: (id: string) => void; onSession: (ids: string[]) => void }) {
  const start = async () => {
    if (registered) {
      try {
        const session = await mutate({ action: "session", kind: "set", setId: data.id }) as { questionIds?: string[] }
        if (session.questionIds?.[0]) return onSession(session.questionIds)
      } catch {}
    }
    if (data.questions[0]) onOpen(data.questions.find(item => !item.completed)?.id ?? data.questions[0].id)
  }
  return <div className="space-y-5"><button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft size={16}/> Back to sets</button>
    {!registered && <SignInNotice/>}
    <header className={card}><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{data.collectionTitle} · {data.moduleName ?? data.disciplineName}</p><h1 className="mt-3 text-3xl font-bold">{data.name}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{data.description || "A focused set of long-answer questions."}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3"><div><b className="text-2xl">{data.total}</b><span className="block text-xs text-muted-foreground">Questions</span></div><div><b className="text-2xl">{data.completed}</b><span className="block text-xs text-muted-foreground">Completed</span></div><div><b className="text-2xl">{data.progressPercent}%</b><span className="block text-xs text-muted-foreground">Progress</span></div></div>
      <div className="mt-4"><ProgressBar value={data.progressPercent}/></div><div className="mt-5 flex flex-wrap gap-3"><button onClick={start} className={`${button} bg-primary text-primary-foreground`}>{data.completed ? "Continue Set" : "Start Set"}</button><ExportButton source="set" sourceId={data.id}/></div>
    </header>
    <section className={`${card} p-0`}><div className="border-b border-border px-5 py-4"><h2 className="font-bold">Questions</h2><p className="text-sm text-muted-foreground">Jump to any question in the set.</p></div><div className="divide-y divide-border">{data.questions.map((question, index) => <button key={question.id} onClick={() => onOpen(question.id)} className="grid w-full grid-cols-[36px_1fr_auto] items-center gap-3 px-5 py-4 text-left hover:bg-muted/50">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${question.completed ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{question.completed ? <Check size={15}/> : index + 1}</span>
      <span><b className="line-clamp-1">{question.title || question.prompt}</b><small className="mt-1 flex flex-wrap gap-2 text-muted-foreground">{question.marks != null && <span>{question.marks} marks</span>}{question.bookmarked && <span>Bookmarked</span>}{question.revision && <span>Revision</span>}{question.draft && <span>Draft saved</span>}</small></span><ChevronRight className="text-muted-foreground" size={18}/>
    </button>)}</div></section>
  </div>
}

function StudyQuestion({ questionId, sessionQuestionIds, registered, onBack, onMove }: { questionId: string; sessionQuestionIds: string[] | null; registered: boolean; onBack: () => void; onMove: (id: string) => void }) {
  const [question, setQuestion] = useState<TheoryQuestionDetail | null>(null)
  const [mode, setMode] = useState<TheoryStudyMode>("review")
  const [answer, setAnswer] = useState("")
  const [note, setNote] = useState("")
  const [revealed, setRevealed] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [message, setMessage] = useState("")
  const reviewRecorded = useRef(false)
  const restored = useRef(false)

  const load = useCallback(async () => {
    setMessage(""); reviewRecorded.current = false; restored.current = false
    try {
      const next = await api<TheoryQuestionDetail>(`/api/theory?mode=question&id=${encodeURIComponent(questionId)}`)
      const sessionIndex = sessionQuestionIds?.indexOf(questionId) ?? -1
      const stable = sessionIndex >= 0 && sessionQuestionIds ? {
        ...next,
        position: sessionIndex + 1,
        setTotal: sessionQuestionIds.length,
        previousId: sessionIndex > 0 ? sessionQuestionIds[sessionIndex - 1] : null,
        nextId: sessionIndex < sessionQuestionIds.length - 1 ? sessionQuestionIds[sessionIndex + 1] : null,
      } : next
      setQuestion(stable); setNote(next.state?.note ?? ""); setAnswer(next.state?.draft?.answerMd ?? "")
      restored.current = true
      if (registered) void mutate({ action: "opened", questionId })
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to open question.") }
  }, [questionId, registered, sessionQuestionIds])
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!registered || mode !== "review" || !question || reviewRecorded.current) return
    let visibleSeconds = 0
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return
      visibleSeconds += 1
      if (visibleSeconds >= 10 && !reviewRecorded.current) {
        reviewRecorded.current = true
        void mutate({ action: "reviewed", questionId: question.id }).then(() => setQuestion(current => current ? { ...current, state: current.state ? { ...current.state, completedAt: new Date().toISOString(), reviewedAt: new Date().toISOString() } : current.state } : current))
        window.clearInterval(timer)
      }
    }, 1000)
    return () => window.clearInterval(timer)
  }, [registered, mode, question])

  useEffect(() => {
    if (!registered || mode !== "practice" || !question || !restored.current) return
    setSaving("saving")
    const timer = window.setTimeout(() => {
      void mutate({ action: "draft", questionId: question.id, answer })
        .then(() => setSaving("saved")).catch(() => setSaving("error"))
    }, 800)
    return () => window.clearTimeout(timer)
  }, [answer, mode, question, registered])

  if (!question) return message ? <Empty title="Question unavailable" text={message}/> : <div className={`${card} py-14 text-center text-sm text-muted-foreground`}>Loading question…</div>
  const state = question.state
  const personalized = async (payload: Record<string, unknown>) => {
    if (!registered) return setMessage("Sign in with a student account to save this action.")
    try { await mutate({ ...payload, questionId: question.id }); setMessage("") }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "Unable to save.") }
  }
  const toggleBookmark = async () => {
    const enabled = !state?.bookmark
    await personalized({ action: "bookmark", enabled })
    setQuestion(current => current?.state ? { ...current, state: { ...current.state, bookmark: enabled } } : current)
  }
  const toggleRevision = async () => {
    const enabled = !state?.revision
    await personalized({ action: "revision", enabled, source: "manual" })
    setQuestion(current => current?.state ? { ...current, state: { ...current.state, revision: enabled } } : current)
  }
  const saveNote = async () => {
    await personalized({ action: "note", note })
    setQuestion(current => current?.state ? { ...current, state: { ...current.state, note } } : current)
  }
  const reveal = async () => {
    if (registered) await personalized({ action: "reveal" })
    setRevealed(true)
  }
  const submit = async () => {
    if (!registered) return setMessage("Sign in to submit and rate a practice answer.")
    await personalized({ action: "submit", answer })
    setSubmitted(true); setRevealed(true)
  }
  const rate = async (rating: TheorySelfRating) => {
    await personalized({ action: "rate", rating })
    const confidence = rating === "excellent" ? "high" : rating === "partial" ? "medium" : "low"
    setQuestion(current => current?.state ? { ...current, state: { ...current.state, completedAt: new Date().toISOString(), confidence, revision: rating === "needs_revision" ? true : rating === "excellent" ? false : current.state.revision } } : current)
    setMessage("Self-rating saved.")
  }
  const words = answer.trim() ? answer.trim().split(/\s+/u).length : 0

  return <div className="mx-auto max-w-6xl space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><button onClick={onBack} className="flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft size={16}/> Back to Set</button><div className="flex items-center gap-2"><span className="text-sm text-muted-foreground">Question {question.position} of {question.setTotal}</span><div className="flex rounded-xl bg-muted p-1"><button onClick={() => setMode("review")} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "review" ? "bg-card text-primary shadow-sm" : ""}`}>Review</button><button onClick={() => setMode("practice")} className={`rounded-lg px-3 py-2 text-sm font-bold ${mode === "practice" ? "bg-card text-primary shadow-sm" : ""}`}>Practice</button></div></div></div>
    {!registered && <SignInNotice/>}{message && <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">{message}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><p>{question.collectionTitle} · {question.moduleName ?? question.disciplineName} · {question.setTitle}</p><div className="flex gap-2"><button onClick={toggleBookmark} className={`${button} border border-border px-3 ${state?.bookmark ? "text-primary" : ""}`}><Bookmark size={16} fill={state?.bookmark ? "currentColor" : "none"}/> {state?.bookmark ? "Bookmarked" : "Bookmark"}</button><button onClick={toggleRevision} className={`${button} border border-border px-3 ${state?.revision ? "text-primary" : ""}`}><RefreshCw size={16}/> {state?.revision ? "In Revision" : "Mark for Revision"}</button></div></div>
    <article className={card}><p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{question.marks != null ? `${question.marks} marks` : "Theory question"}</p><h1 className="mt-3 text-2xl font-bold leading-snug">{question.title || question.prompt}</h1>{question.title && <p className="mt-4 leading-7">{question.prompt}</p>}</article>
    {mode === "review" ? <div className="grid gap-5 lg:grid-cols-[1fr_320px]"><article className={card}><h2 className="text-lg font-bold">Model Answer</h2><TheoryMarkdown className="mt-3" children={question.modelAnswer}/>{question.keyMarkingPoints.length > 0 && <><h3 className="mt-6 font-bold">Key points</h3><ul className="mt-3 space-y-2">{question.keyMarkingPoints.map(point => <li key={point} className="flex gap-2 text-sm"><CheckCircle2 className="mt-0.5 shrink-0 text-primary" size={17}/><span>{point}</span></li>)}</ul></>}{question.referencesMd && <><h3 className="mt-6 font-bold">References</h3><TheoryMarkdown className="mt-2" children={question.referencesMd}/></>}</article><NoteEditor note={note} onChange={setNote} onSave={saveNote}/></div>
      : <div className="space-y-5"><article className={card}><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">My Answer</h2><span className="text-xs text-muted-foreground">{words} words · {saving === "saving" ? "Saving…" : saving === "saved" ? "Draft saved" : saving === "error" ? "Autosave failed" : "Not saved yet"}</span></div><textarea value={answer} onChange={event => setAnswer(event.target.value)} disabled={submitted} rows={12} placeholder="Build a structured answer in Markdown…" className="mt-4 w-full resize-y rounded-xl border border-border bg-background p-4 text-sm leading-7 outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-70"/><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => personalized({ action: "draft", answer })} disabled={!registered || submitted} className={`${button} border border-border disabled:opacity-50`}><Save size={16}/> Save Draft</button><button onClick={submit} disabled={!registered || submitted} className={`${button} bg-primary text-primary-foreground disabled:opacity-50`}>Submit Answer</button><button onClick={reveal} className={`${button} border border-border`}>Reveal Model Answer</button></div></article>
        {(revealed || submitted) && <><div className="grid gap-5 lg:grid-cols-2"><article className={card}><h2 className="font-bold">My Answer</h2>{answer ? <TheoryMarkdown className="mt-3" children={answer}/> : <p className="mt-3 text-sm text-muted-foreground">No written answer was submitted.</p>}</article><article className={card}><h2 className="font-bold text-primary">Model Answer</h2><TheoryMarkdown className="mt-3" children={question.modelAnswer}/></article></div><article className={card}><h2 className="font-bold">How well did you answer?</h2><p className="mt-1 text-sm text-muted-foreground">This is self-assessment, not AI grading.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><Rating label="Excellent" text="Confident and complete" onClick={() => rate("excellent")}/><Rating label="Partial" text="Some gaps remain" onClick={() => rate("partial")}/><Rating label="Needs Revision" text="Add to revision queue" onClick={() => rate("needs_revision")}/></div></article></>}</div>}
    <div className="flex justify-between">{question.previousId ? <button onClick={() => onMove(question.previousId!)} className={`${button} border border-border`}><ArrowLeft size={17}/> Previous</button> : <span/>}{question.nextId && <button onClick={() => onMove(question.nextId!)} className={`${button} bg-primary text-primary-foreground`}>Next <ArrowRight size={17}/></button>}</div>
  </div>
}

function NoteEditor({ note, onChange, onSave }: { note: string; onChange: (value: string) => void; onSave: () => void }) {
  return <aside className={card}><div className="flex items-center gap-2"><NotebookPen className="text-primary" size={18}/><h2 className="font-bold">Personal Note</h2></div><textarea value={note} onChange={event => onChange(event.target.value)} rows={9} placeholder="Add a Markdown note…" className="mt-4 w-full rounded-xl border border-border bg-background p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-primary/25"/><button onClick={onSave} className={`${button} mt-3 w-full bg-primary text-primary-foreground`}><Save size={16}/> Save Note</button></aside>
}

function Rating({ label, text, onClick }: { label: string; text: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-xl border border-border p-4 text-left transition hover:border-primary/45 hover:bg-primary/5"><b>{label}</b><span className="mt-1 block text-xs text-muted-foreground">{text}</span></button>
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
  return <div className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">{view}</h1><p className="mt-1 text-sm text-muted-foreground">{items.length} items</p></div><ExportButton source={apiView}/></div>
    {error && <div className="text-sm text-destructive">{error}</div>}<div className="grid gap-3 sm:grid-cols-[1fr_180px]"><label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3"><Search size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${view.toLowerCase()}`} className="w-full bg-transparent text-sm outline-none"/></label><select value={sort} onChange={event => setSort(event.target.value)} className="rounded-xl border border-border bg-card px-3 text-sm"><option value="recent">Recently added</option><option value="module">Module / discipline</option>{view === "Revision Queue" && <option value="priority">Priority</option>}</select></div>
    {view === "Revision Queue" && items.length > 0 && <button onClick={async () => { const session = await mutate({ action: "session", kind: "revision" }) as { questionIds?: string[] }; if (session.questionIds?.[0]) onSession(session.questionIds) }} className={`${button} bg-primary text-primary-foreground`}><Timer size={16}/> Start Revision</button>}
    {items.length ? <div className="space-y-3">{items.map(item => <article key={item.id} className={card}><p className="text-xs font-semibold text-primary">{item.collection} · {item.module ?? item.discipline} · {item.setTitle}</p><h2 className="mt-2 font-bold">{item.title || item.prompt}</h2>{item.note && <p className="mt-3 line-clamp-3 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{item.note}</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{dateLabel(item.updatedAt)}{item.confidence ? ` · ${item.confidence} confidence` : ""}</span><button onClick={() => onOpen(item.id)} className={`${button} border border-border px-3`}>Open Question<ChevronRight size={16}/></button></div></article>)}</div> : <Empty icon={view === "Bookmarks" ? Bookmark : view === "My Notes" ? NotebookPen : RefreshCw} title="Nothing here yet" text={emptyText}/>}
  </div>
}

function SearchView({ initialQuery, onOpen }: { initialQuery: string; onOpen: (id: string) => void }) {
  const [query, setQuery] = useState(initialQuery)
  const [items, setItems] = useState<Array<{ id: string; title: string; prompt: string; collection: string; module: string | null; discipline: string | null; setTitle: string | null }>>([])
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
    {items.length ? <div className="space-y-3">{items.map(item => <button key={item.id} onClick={() => onOpen(item.id)} className={`${card} w-full text-left hover:border-primary/45`}><p className="text-xs font-semibold text-primary">{item.collection} · {item.module ?? item.discipline} · {item.setTitle}</p><h2 className="mt-2 font-bold"><Highlight text={item.title || item.prompt} query={query}/></h2><p className="mt-2 line-clamp-2 text-sm text-muted-foreground"><Highlight text={item.prompt} query={query}/></p></button>)}</div> : query.length >= 2 ? <Empty icon={Search} title="No matching theory content" text="Try a broader clinical term, module, discipline, or tag."/> : null}
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
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Theory Vault Progress</h1><p className="mt-1 text-sm text-muted-foreground">Real activity from Review and Practice modes.</p></div><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{stats.map(([label, value]) => <div key={label} className={card}><p className="text-2xl font-bold text-primary">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></div>)}</section>
    <section className={`${card} grid gap-5 md:grid-cols-2`}><div><h2 className="font-bold">Confidence distribution</h2><div className="mt-4 space-y-3">{[["High", data.totals.high], ["Medium", data.totals.medium], ["Low", data.totals.low]].map(([label, value]) => <div key={label as string} className="flex items-center justify-between rounded-xl bg-muted px-4 py-3 text-sm"><span>{label}</span><b>{value}</b></div>)}</div></div><div><h2 className="font-bold">Study records</h2><div className="mt-4 grid grid-cols-2 gap-3">{[["Practice attempts",data.totals.attempts],["Drafts",data.totals.drafts],["Bookmarks",data.totals.bookmarks],["Notes",data.totals.notes]].map(([label,value]) => <div key={label as string} className="rounded-xl bg-muted p-3"><b className="text-xl">{value}</b><span className="block text-xs text-muted-foreground">{label}</span></div>)}</div></div></section>
    <section className="space-y-3"><h2 className="text-xl font-bold">Module and year progress</h2>{data.groups.map(group => { const value = group.total ? Math.round(group.completed / group.total * 100) : 0; return <article key={`${group.collectionId}-${group.groupId}`} className={card}><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs font-semibold text-primary">{group.collection}</p><h3 className="mt-1 font-bold">{group.name}</h3><p className="mt-1 text-xs text-muted-foreground">{group.completed}/{group.total} questions · {group.completedSets}/{group.totalSets} sets completed</p></div><b className="text-primary">{value}%</b></div><div className="mt-4"><ProgressBar value={value}/></div></article>})}</section>
    <section className={card}><h2 className="font-bold">Recent study activity</h2>{data.recent.length ? <div className="mt-3 divide-y divide-border">{data.recent.map((item, index) => <div key={`${item.occurredAt}-${index}`} className="py-3 text-sm"><b>{item.prompt || item.type}</b><p className="mt-1 text-xs text-muted-foreground">{item.groupName} · {item.setTitle} · {dateLabel(item.occurredAt)}</p></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Your recent Theory activity will appear here.</p>}</section>
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
  return <div className="relative"><button onClick={() => setOpen(value => !value)} className={`${button} border border-border`}><Download size={16}/> Export PDF</button>{open && <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-border bg-card p-4 shadow-xl"><h3 className="font-bold">PDF options</h3><label className="mt-3 flex items-center justify-between text-sm">Questions and model answers<input type="checkbox" checked={answers} onChange={event => setAnswers(event.target.checked)} className="h-4 w-4 accent-primary"/></label><label className="mt-3 flex items-center justify-between text-sm">Include personal notes<input type="checkbox" checked={notes} onChange={event => setNotes(event.target.checked)} className="h-4 w-4 accent-primary"/></label><button onClick={download} disabled={busy} className={`${button} mt-4 w-full bg-primary text-primary-foreground disabled:opacity-50`}>{busy ? "Generating…" : "Download PDF"}</button></div>}</div>
}
