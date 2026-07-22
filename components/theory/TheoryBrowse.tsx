"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock3, Bookmark, RotateCcw } from "lucide-react"

type Counts = { total: number; completed: number; bookmarked: number; revisionDue: number }
type Collection = { id: string; title: string; description?: string; counts: Counts }
type Discipline = { id: string; title: string; description?: string; counts: Counts }
type TheorySet = { id: string; title: string; description?: string; counts: Counts }

const headers = (): Record<string, string> => typeof window === "undefined" ? {} : (localStorage.getItem("mednexus-guest-token") ? { "x-guest-token": localStorage.getItem("mednexus-guest-token")! } : localStorage.getItem("mednexus-user-token") ? { "x-session-token": localStorage.getItem("mednexus-user-token")! } : {})
const pct = (c: Counts) => c.total ? Math.round(c.completed / c.total * 100) : 0

function BrowseInner() {
  const router = useRouter(); const params = useSearchParams()
  const collectionId = params.get("collectionId"), disciplineId = params.get("disciplineId")
  const [items, setItems] = useState<(Collection | Discipline | TheorySet)[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState("")
  const endpoint = !collectionId ? "/api/theory/collections" : !disciplineId ? `/api/theory/disciplines?collectionId=${encodeURIComponent(collectionId)}` : `/api/theory/sets?disciplineId=${encodeURIComponent(disciplineId)}`
  useEffect(() => { let live = true; setLoading(true); setError(""); fetch(endpoint, { headers: headers(), cache: "no-store" }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "Unable to load Theory content"); return body }).then(body => { if (live) setItems(body.collections ?? body.disciplines ?? body.sets ?? []) }).catch(e => live && setError(e.message)).finally(() => live && setLoading(false)); return () => { live = false } }, [endpoint])
  const level = !collectionId ? "collection" : !disciplineId ? "discipline" : "set"
  const title = level === "collection" ? "Choose a Theory collection" : level === "discipline" ? "Choose a discipline" : "Choose a set"
  const crumb = [collectionId && "Theory collection", disciplineId && "Discipline", level === "set" && "Sets"].filter(Boolean).join(" → ")
  const choose = async (item: Collection | Discipline | TheorySet) => {
    if (level === "collection") return router.push(`/theory/browse?collectionId=${item.id}`)
    if (level === "discipline") {
      const res = await fetch(`/api/theory/sets?disciplineId=${item.id}`, { headers: headers() }); const data = res.ok ? await res.json() : { sets: [] }
      if (data.sets?.length) return router.push(`/theory/browse?collectionId=${collectionId}&disciplineId=${item.id}`)
      return router.push(`/theory/read?collectionId=${collectionId}&disciplineId=${item.id}`)
    }
    router.push(`/theory/read?collectionId=${collectionId}&disciplineId=${disciplineId}&setId=${item.id}`)
  }
  const back = () => level === "collection" ? router.push("/theory") : level === "discipline" ? router.push("/theory/browse") : router.push(`/theory/browse?collectionId=${collectionId}`)
  return <section className="mx-auto max-w-5xl space-y-7"><div className="flex items-start gap-3"><button onClick={back} aria-label="Go back" className="mt-1 rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted"><ArrowLeft size={18}/></button><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-600">Theory library</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>{crumb && <p className="mt-1 text-sm text-muted-foreground">{crumb}</p>}</div></div>{loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-44 animate-pulse rounded-2xl bg-muted"/>)}</div> : error ? <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{error}</div> : items.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">No available {level === "set" ? "sets" : `${level}s`} yet.</div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => <button key={item.id} onClick={() => choose(item)} className="group min-h-48 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-500/50 hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="rounded-xl bg-teal-500/10 p-2.5 text-teal-700 dark:text-teal-300"><BookOpen size={21}/></span><ArrowRight size={18} className="text-muted-foreground group-hover:text-teal-600"/></div><h2 className="mt-5 font-semibold">{item.title}</h2><p className="mt-1 min-h-10 text-sm text-muted-foreground">{item.description || `${item.counts.total} questions ready to read`}</p>{level === "set" ? <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><span><CheckCircle2 className="mr-1 inline text-teal-600" size={13}/>{pct(item.counts)}% complete</span><span><Bookmark className="mr-1 inline" size={13}/>{item.counts.bookmarked} saved</span><span className="col-span-2"><RotateCcw className="mr-1 inline text-amber-600" size={13}/>{item.counts.revisionDue} revisions due</span></div> : <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Clock3 size={13}/>{item.counts.total} questions</div>}</button>)}</div>}</section>
}
export function TheoryBrowse() { return <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-muted"/>}><BrowseInner/></Suspense> }
