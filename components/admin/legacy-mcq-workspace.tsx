"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, RefreshCw, Search } from "lucide-react"
import type { Question } from "@/lib/types"
import { useQuestions } from "@/contexts/questions-context"

type StatusCounts = Record<string, number>
type Category = { module: string; count: number; statusCounts: StatusCounts; disciplines: Array<{ subject: string; count: number; statusCounts: StatusCounts }> }
type ManagedQuestion = Question & { status?: string; validationIssues?: string[] }
type Response = {
  questions: ManagedQuestion[]
  pagination: { page: number; pageSize: number; total: number; pages: number }
  filters: { categories: Category[] }
  counts: StatusCounts
}

const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition"

async function readResponse(response: globalThis.Response) {
  const body = await response.json().catch(() => ({})) as Partial<Response> & { error?: string }
  if (!response.ok) throw new Error(body.error ?? "Unable to load the Legacy MCQ editor.")
  return body as Response
}

export function LegacyMcqWorkspace({ pendingImport, onPendingImportConsumed, onOpenImporter }: {
  pendingImport?: Question[] | null
  onPendingImportConsumed?: () => void
  onOpenImporter?: () => void
}) {
  const router = useRouter()
  const { appendQuestionsInChunks } = useQuestions()
  const requestRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const importingRef = useRef(false)
  const [summary, setSummary] = useState<Response | null>(null)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [expandedDiscipline, setExpandedDiscipline] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ManagedQuestion[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [savingImport, setSavingImport] = useState(false)
  const [error, setError] = useState("")

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true); setError("")
    try {
      const response = await fetch("/api/admin/mcq/questions?page=1&pageSize=1&status=all", { cache: "no-store" })
      setSummary(await readResponse(response))
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load the Legacy MCQ editor.") }
    finally { setLoadingSummary(false) }
  }, [])

  useEffect(() => { void loadSummary() }, [loadSummary])

  const loadQuestions = useCallback(async (nextPage = 1) => {
    if (!expandedModule || !expandedDiscipline) { setQuestions([]); return }
    requestRef.current?.abort()
    const controller = new AbortController(); requestRef.current = controller
    const requestId = ++requestIdRef.current
    const params = new URLSearchParams({ module: expandedModule, subject: expandedDiscipline, page: String(nextPage), pageSize: "50", status, sort: "module" })
    if (query.trim()) params.set("search", query.trim())
    setLoadingQuestions(true); setError("")
    try {
      const response = await fetch(`/api/admin/mcq/questions?${params}`, { cache: "no-store", signal: controller.signal })
      const body = await readResponse(response)
      if (controller.signal.aborted || requestId !== requestIdRef.current) return
      setQuestions(body.questions); setPage(body.pagination.page); setPages(body.pagination.pages)
    } catch (reason) {
      if (!controller.signal.aborted && requestId === requestIdRef.current) setError(reason instanceof Error ? reason.message : "Unable to load questions.")
    } finally { if (!controller.signal.aborted && requestId === requestIdRef.current) setLoadingQuestions(false) }
  }, [expandedDiscipline, expandedModule, query, status])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQuestions(1), 180)
    return () => { window.clearTimeout(timer); requestRef.current?.abort() }
  }, [expandedDiscipline, expandedModule, query, status, loadQuestions])

  useEffect(() => {
    if (!pendingImport?.length || importingRef.current) return
    importingRef.current = true
    onPendingImportConsumed?.()
    setSavingImport(true); setError("")
    void appendQuestionsInChunks(pendingImport).then(result => {
      if (!result.ok) setError(result.error ?? `${result.failedQuestions.length} imported questions could not be saved.`)
      return loadSummary()
    }).finally(() => { importingRef.current = false; setSavingImport(false) })
  }, [appendQuestionsInChunks, loadSummary, onPendingImportConsumed, pendingImport])

  const activeCount = useMemo(() => ["live", "draft", "review", "offline"].reduce((total, key) => total + Number(summary?.counts[key] ?? 0), 0), [summary])

  async function createQuestion(module: string, subject: string) {
    setError("")
    try {
      const response = await fetch("/api/admin/mcq/questions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ module, subject }) })
      const body = await response.json().catch(() => ({})) as { question?: Question; error?: string }
      if (!response.ok || !body.question) throw new Error(body.error ?? "Unable to create a question.")
      router.push(`/admin/mcq/${body.question.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create a question.") }
  }

  if (loadingSummary && !summary) return <div className="grid min-h-64 place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground"><Loader2 className="animate-spin"/>Loading the question-bank summary…</div>

  return <div className="space-y-4">
    {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    {savingImport ? <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">Saving imported questions in safe batches…</div> : null}
    <section className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-border px-3"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search the selected discipline" className="w-full bg-transparent text-sm outline-none"/></label>
        <select value={status} onChange={event=>setStatus(event.target.value)} className="h-11 rounded-xl border border-border bg-background px-3 text-sm"><option value="all">All ({activeCount})</option><option value="live">Live</option><option value="draft">Draft</option><option value="review">In review</option><option value="offline">Offline</option><option value="archived">Archived</option></select>
        <button onClick={()=>void loadSummary()} className={`${button} border border-border`}><RefreshCw size={15}/>Refresh</button>
        <button onClick={onOpenImporter} className={`${button} bg-primary text-primary-foreground`}>Import questions</button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Legacy now loads only the discipline and page you open. {activeCount} active questions across {summary?.filters.categories.length ?? 0} modules.</p>
    </section>

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {(summary?.filters.categories ?? []).map(category => {
        const moduleOpen = expandedModule === category.module
        return <div key={category.module} className="border-b border-border last:border-0">
          <button type="button" onClick={()=>{setExpandedModule(moduleOpen?null:category.module);setExpandedDiscipline(null);setQuestions([])}} className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-muted/50">{moduleOpen?<ChevronDown size={17}/>:<ChevronRight size={17}/>}<span className="min-w-0 flex-1"><b className="block truncate">{category.module || "Unassigned module"}</b><span className="text-xs text-muted-foreground">{category.disciplines.length} disciplines · {category.count} questions</span></span></button>
          {moduleOpen ? <div className="border-t border-border bg-muted/20 p-2">{category.disciplines.map(discipline => {
            const disciplineOpen = expandedDiscipline === discipline.subject
            return <div key={discipline.subject} className="mb-1 overflow-hidden rounded-xl border border-border bg-background last:mb-0">
              <div className="flex items-center"><button type="button" onClick={()=>{setExpandedDiscipline(disciplineOpen?null:discipline.subject);setPage(1);setQuestions([])}} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-3 text-left">{disciplineOpen?<ChevronDown size={15}/>:<ChevronRight size={15}/>}<span className="min-w-0 flex-1 truncate text-sm font-semibold">{discipline.subject || "Unassigned discipline"}</span><span className="text-xs text-muted-foreground">{discipline.count}Q</span></button><button type="button" onClick={()=>void createQuestion(category.module,discipline.subject)} aria-label={`Add question to ${discipline.subject}`} className="mr-2 rounded-lg p-2 text-primary hover:bg-primary/10"><Plus size={15}/></button></div>
              {disciplineOpen ? <div className="border-t border-border p-2">
                {loadingQuestions ? <div role="status" className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="animate-spin" size={17}/>Loading this page…</div> : questions.map(question=><button type="button" key={question.id} onClick={()=>router.push(`/admin/mcq/${question.id}`)} className="mb-2 flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left hover:border-primary/40 hover:bg-primary/5 last:mb-0"><span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary"><Pencil size={13}/></span><span className="min-w-0 flex-1"><b className="line-clamp-2 text-sm">{question.vignette || "Untitled question"}</b><span className="mt-1 block text-[11px] capitalize text-muted-foreground">{question.status ?? "live"}{question.validationIssues?.length ? ` · ${question.validationIssues.length} issues` : ""}</span></span></button>)}
                {!loadingQuestions && questions.length===0?<p className="p-8 text-center text-sm text-muted-foreground">No questions match this filter.</p>:null}
                {pages>1?<div className="mt-3 flex items-center justify-between border-t border-border pt-3"><button disabled={page<=1} onClick={()=>void loadQuestions(page-1)} className={`${button} border border-border disabled:opacity-40`}>Previous</button><span className="text-xs text-muted-foreground">Page {page} of {pages}</span><button disabled={page>=pages} onClick={()=>void loadQuestions(page+1)} className={`${button} border border-border disabled:opacity-40`}>Next</button></div>:null}
              </div>:null}
            </div>
          })}</div>:null}
        </div>
      })}
    </section>
  </div>
}
