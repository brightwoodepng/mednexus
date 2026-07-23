"use client"

import { useEffect, useState } from "react"
import { useApp } from "@/contexts/app-context"
import { ArrowLeft, ArrowRight, Bookmark, CheckCircle2, ChevronRight, FileText, NotebookPen, RotateCcw, Search, Sparkles } from "lucide-react"

type View = "Dashboard" | "Browse Questions" | "Bookmarks" | "My Notes" | "Revision Queue" | "Progress" | "Search"
type Collection = { id: string; title: string }
type Discipline = { id: string; collectionId: string; name: string }
type Set = { id: string; collectionId: string; disciplineId: string; name: string }
type Question = { id: string; collectionId: string; disciplineId: string; setId: string | null; prompt: string; modelAnswer: string; keyMarkingPoints: string[] }
type Data = { collections: Collection[]; disciplines: Discipline[]; sets: Set[]; questions: Question[] }
const empty: Data = { collections: [], disciplines: [], sets: [], questions: [] }

const THEORY_MOTIVATIONS = [
  "Read deliberately. Recall with confidence.",
  "Deep understanding builds clinical mastery.",
  "Every model answer sharpens your reasoning.",
  "Long-form learning — the foundation of expertise.",
  "Read deeply. Think critically. Retain permanently.",
]

function useGreeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return "Good morning"
  if (h >= 12 && h < 17) return "Good afternoon"
  if (h >= 17 && h < 21) return "Good evening"
  return "Good night"
}

export function TheoryVault({ initialView = "Dashboard" }: { initialView?: View }) {
  const { user } = useApp()
  const [view, setView] = useState<View>(initialView), [data, setData] = useState<Data>(empty), [loading, setLoading] = useState(true)
  const [trail, setTrail] = useState<{ collectionId?: string; disciplineId?: string; setId?: string }>({})
  const [currentId, setCurrentId] = useState<string | null>(null), [bookmarks, setBookmarks] = useState<string[]>([]), [revisions, setRevisions] = useState<string[]>([])
  const [completed, setCompleted] = useState<string[]>([]), [notes, setNotes] = useState<Record<string, string>>({}), [query, setQuery] = useState(""), [revealed, setRevealed] = useState(false)
  useEffect(() => { setView(initialView); setTrail({}); setCurrentId(null) }, [initialView])
  useEffect(() => { fetch("/api/theory").then(r => r.ok ? r.json() : empty).then(setData).catch(() => setData(empty)).finally(() => setLoading(false)) }, [])

  const greeting = useGreeting()
  const firstName = user?.name?.split(" ").pop() ?? "Clinician"
  const motivation = THEORY_MOTIVATIONS[new Date().getDate() % THEORY_MOTIVATIONS.length]

  const collection = (id?: string) => data.collections.find(x => x.id === id)
  const discipline = (id?: string) => data.disciplines.find(x => x.id === id)
  const current = data.questions.find(q => q.id === currentId)
  const qForTrail = data.questions.filter(q => (!trail.collectionId || q.collectionId === trail.collectionId) && (!trail.disciplineId || q.disciplineId === trail.disciplineId) && (!trail.setId || q.setId === trail.setId))
  const open = (q: Question) => { setCurrentId(q.id); setTrail({ collectionId: q.collectionId, disciplineId: q.disciplineId, setId: q.setId ?? undefined }); setRevealed(false) }

  const card = "rounded-2xl border border-border bg-card p-5 shadow-sm"

  if (loading) return <div className={`${card} py-14 text-center text-sm text-muted-foreground`}>Opening Theory Vault…</div>
  if (current) return <Reader />

  const questionRow = (q: Question) => <button key={q.id} type="button" onClick={() => open(q)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left hover:border-primary/45 hover:bg-primary/5"><div><p className="text-xs font-semibold text-primary">{collection(q.collectionId)?.title} · {discipline(q.disciplineId)?.name}</p><p className="mt-1 font-semibold">{q.prompt}</p></div><ChevronRight className="shrink-0 text-muted-foreground" /></button>
  const browse = () => {
    if (!trail.collectionId) return <Hierarchy title="Browse Questions" subtitle="Choose a collection to begin your reading path." items={data.collections.map(c => ({ id: c.id, title: c.title, meta: `${data.questions.filter(q => q.collectionId === c.id).length} questions` }))} onPick={id => setTrail({ collectionId: id })} />
    if (!trail.disciplineId) { const ds = data.disciplines.filter(d => d.collectionId === trail.collectionId); return <Hierarchy title={collection(trail.collectionId)?.title ?? "Collections"} back={() => setTrail({})} items={ds.map(d => ({ id: d.id, title: d.name, meta: `${data.questions.filter(q => q.disciplineId === d.id).length} questions` }))} onPick={id => setTrail({ collectionId: trail.collectionId, disciplineId: id })} /> }
    const sets = data.sets.filter(s => s.disciplineId === trail.disciplineId)
    if (sets.length && !trail.setId) return <Hierarchy title={discipline(trail.disciplineId)?.name ?? "Discipline"} subtitle={collection(trail.collectionId)?.title} back={() => setTrail({ collectionId: trail.collectionId })} items={sets.map(s => ({ id: s.id, title: s.name, meta: `${data.questions.filter(q => q.setId === s.id).length} questions` }))} onPick={id => setTrail({ ...trail, setId: id })} />
    return <div className="space-y-4"><Crumbs /><button type="button" onClick={() => setTrail({ collectionId: trail.collectionId, disciplineId: sets.length ? trail.disciplineId : undefined })} className="flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft size={16} /> Back</button><h2 className="text-2xl font-bold">{sets.length ? data.sets.find(s => s.id === trail.setId)?.name : discipline(trail.disciplineId)?.name}</h2><div className="space-y-2">{qForTrail.map(questionRow)}</div></div>
  }

  function Hierarchy({ title, subtitle, items, onPick, back }: { title: string; subtitle?: string; items: { id: string; title: string; meta: string }[]; onPick: (id: string) => void; back?: () => void }) {
    return <div className="space-y-4">{back && <button type="button" onClick={back} className="flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft size={16} /> Back</button>}<div><h2 className="text-2xl font-bold">{title}</h2>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div><div className="grid gap-4 md:grid-cols-2">{items.map(item => <button key={item.id} type="button" onClick={() => onPick(item.id)} className={`${card} text-left hover:border-primary/45`}><FileText className="text-primary" /><b className="mt-5 block text-lg">{item.title}</b><span className="mt-1 block text-sm text-muted-foreground">{item.meta} · explore at your own pace</span></button>)}</div></div>
  }
  function Crumbs() { return <p className="text-sm text-muted-foreground">{[collection(trail.collectionId)?.title, discipline(trail.disciplineId)?.name, data.sets.find(s => s.id === trail.setId)?.name].filter(Boolean).join(" · ")}</p> }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (view === "Dashboard") {
    const quickActions = [
      { icon: <FileText size={20} />, label: "Browse Questions", sub: `${data.questions.length} total`, onClick: () => setView("Browse Questions") },
      { icon: <Bookmark size={20} />, label: "Bookmarks", sub: `${bookmarks.length} saved`, onClick: () => setView("Bookmarks") },
      { icon: <RotateCcw size={20} />, label: "Revision Queue", sub: `${revisions.length} due`, onClick: () => setView("Revision Queue") },
      { icon: <NotebookPen size={20} />, label: "My Notes", sub: `${Object.values(notes).filter(Boolean).length} notes`, onClick: () => setView("My Notes") },
    ]

    return (
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Greeting banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-600 to-emerald-700 px-6 py-6 text-white shadow-lg sm:rounded-3xl sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.07]" />
          <div className="pointer-events-none absolute -bottom-10 right-20 h-28 w-28 rounded-full bg-white/[0.04]" />
          <div className="pointer-events-none absolute bottom-4 left-1/2 h-16 w-16 rounded-full bg-white/[0.03]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[.18em] text-teal-100 mb-2"><Sparkles size={13} /> Theory Vault</p>
              <p className="text-sm font-medium opacity-80">{greeting},</p>
              <h1 className="mt-0.5 text-3xl font-bold tracking-tight sm:text-4xl">{firstName} 👋</h1>
              <p className="mt-2 max-w-sm text-sm opacity-75 text-pretty">{motivation}</p>
            </div>
            <div className="flex w-fit items-center gap-3 rounded-2xl bg-white/15 px-5 py-3 backdrop-blur-sm">
              <FileText size={22} className="opacity-80" />
              <div>
                <p className="text-xl font-bold leading-tight">{data.questions.length}</p>
                <p className="text-xs opacity-80">questions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {quickActions.map(a => (
            <button key={a.label} type="button" onClick={a.onClick}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">{a.icon}</div>
              <div>
                <p className="font-bold text-sm leading-snug text-foreground">{a.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Collections */}
        {data.collections.length > 0 ? (
          <section>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-white">
                <FileText size={16} />
              </div>
              <h2 className="text-lg font-bold tracking-tight">Collections</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {data.collections.map(c => {
                const count = data.questions.filter(q => q.collectionId === c.id).length
                const disciplines = [...new Set(data.disciplines.filter(d => d.collectionId === c.id).map(d => d.name))]
                return (
                  <button key={c.id} type="button"
                    onClick={() => { setView("Browse Questions"); setTrail({ collectionId: c.id }) }}
                    className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-teal-400/50 hover:shadow-md hover:ring-2 hover:ring-teal-300/30 active:scale-[0.99]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                        <FileText size={20} />
                      </div>
                      <ChevronRight size={18} className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <div>
                      <p className="font-bold text-base">{c.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{count} question{count !== 1 ? "s" : ""}</p>
                      {disciplines.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-1">{disciplines.slice(0, 3).join(" · ")}{disciplines.length > 3 ? ` +${disciplines.length - 3} more` : ""}</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ) : (
          <div className={`${card} py-12 text-center`}>
            <FileText className="mx-auto text-primary" size={30} />
            <h2 className="mt-4 text-xl font-bold">Theory content is being prepared</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Your long-form clinical collections will appear here as soon as they are published.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Other views ───────────────────────────────────────────────────────────
  if (view === "Browse Questions") return <div className="mx-auto max-w-5xl">{browse()}</div>
  if (view === "Search") {
    const hits = data.questions.filter(q => q.prompt.toLowerCase().includes(query.toLowerCase()))
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <h2 className="text-2xl font-bold">Search Theory</h2>
        <label className="flex items-center gap-2 rounded-xl border border-border bg-card px-3"><Search size={18} /><input className="h-12 w-full bg-transparent outline-none" placeholder="Search prompts and disciplines" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <div className="space-y-2">{hits.map(questionRow)}</div>
      </div>
    )
  }
  const selected = view === "Bookmarks" ? data.questions.filter(q => bookmarks.includes(q.id)) : view === "My Notes" ? data.questions.filter(q => notes[q.id]) : view === "Revision Queue" ? data.questions.filter(q => revisions.includes(q.id)) : data.questions
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h2 className="text-2xl font-bold">{view === "Progress" ? "Theory progress" : view}</h2>
      {selected.length ? <div className="space-y-2">{selected.map(questionRow)}</div> : <div className={card}><b>Nothing here yet</b><p className="mt-1 text-sm text-muted-foreground">Build this space from the reader when you are ready.</p></div>}
    </div>
  )

  function Reader() {
    if (!current) return null
    const index = qForTrail.findIndex(q => q.id === current.id)
    const move = (offset: number) => qForTrail[index + offset] && open(qForTrail[index + offset])
    return (
      <div className="mx-auto max-w-4xl space-y-5">
        <button type="button" onClick={() => setCurrentId(null)} className="flex items-center gap-1 text-sm font-bold text-primary"><ArrowLeft size={16} /> Back to questions</button>
        <Crumbs />
        <article className={card}>
          <div className="flex justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Question {index + 1} of {qForTrail.length}</p>
              <h1 className="mt-3 text-2xl font-bold leading-snug">{current.prompt}</h1>
            </div>
            <button type="button" aria-label="Bookmark" onClick={() => setBookmarks(x => x.includes(current.id) ? x.filter(id => id !== current.id) : [...x, current.id])} className="h-11 rounded-xl bg-muted p-3 text-primary"><Bookmark size={18} /></button>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            <button type="button" onClick={() => setRevealed(x => !x)} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">{revealed ? "Hide model answer" : "Review model answer"}</button>
            <button type="button" onClick={() => setRevisions(x => x.includes(current.id) ? x.filter(id => id !== current.id) : [...x, current.id])} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold">Revision</button>
            <button type="button" onClick={() => setCompleted(x => x.includes(current.id) ? x : [...x, current.id])} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold">Complete</button>
          </div>
          {revealed && (
            <div className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Model answer</p>
              <p className="mt-3 leading-7">{current.modelAnswer}</p>
              <h2 className="mt-5 font-bold">Marking points</h2>
              <ul className="mt-2 space-y-2">{current.keyMarkingPoints.map(point => <li key={point} className="flex gap-2 text-sm"><CheckCircle2 className="shrink-0 text-emerald-600" size={17} />{point}</li>)}</ul>
            </div>
          )}
          <label className="mt-6 block text-sm font-bold">Your note
            <textarea value={notes[current.id] ?? ""} onChange={e => setNotes({ ...notes, [current.id]: e.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-border bg-background p-3 font-normal outline-none" placeholder="Capture a recall cue or clinical connection…" />
          </label>
        </article>
        <div className="flex justify-between">
          {index > 0 ? <button onClick={() => move(-1)} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 font-bold"><ArrowLeft size={17} /> Previous</button> : <span />}
          {index < qForTrail.length - 1 && <button onClick={() => move(1)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-bold text-primary-foreground">Next <ArrowRight size={17} /></button>}
        </div>
      </div>
    )
  }
}
