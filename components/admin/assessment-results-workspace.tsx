"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { BarChart3, Download, Loader2, Search, Users } from "lucide-react"

type Summary = { id: string; title: string; moduleName: string; questionCount: number; passMark: number; status: string; createdAt: string; participants: number; average: number; median: number; highest: number; lowest: number; passed: number; failed: number }
type Payload = { summaries: Summary[]; total: number; page: number; pageSize: number; modules: string[]; metrics: { assessments: number; participants: number; average: number; passRate: number } }

export function AssessmentResultsWorkspace() {
  const [data, setData] = useState<Payload | null>(null)
  const [search, setSearch] = useState("")
  const [moduleName, setModuleName] = useState("")
  const [status, setStatus] = useState("")
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ search, module: moduleName, status, page: String(page), pageSize: "20" })
    const response = await fetch(`/api/admin/results?${params}`)
    const body = await response.json()
    if (response.ok) setData(body)
    setLoading(false)
  }, [search, moduleName, status, page])
  useEffect(() => { const timer = window.setTimeout(load, 200); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => { setPage(1) }, [search, moduleName, status])

  const inputClass = "h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
  return <div className="space-y-5">
    <div><p className="text-sm font-semibold tracking-wide text-primary">ASSESSMENTS</p><h1 className="mt-2 text-3xl font-bold">Assessment Results</h1><p className="mt-2 text-sm text-muted-foreground">Best attempts are used for summaries and rankings. Open an assessment to inspect every attempt and question performance.</p></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ["Assessments", data?.metrics.assessments ?? 0], ["Participants", data?.metrics.participants ?? 0],
      ["Average", `${data?.metrics.average ?? 0}%`], ["Pass rate", `${data?.metrics.passRate ?? 0}%`],
    ].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div>
    <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-3">
      <label className="relative"><Search size={15} className="absolute left-3 top-3 text-muted-foreground" /><input className={`${inputClass} w-full pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assessments" /></label>
      <select className={inputClass} value={moduleName} onChange={(event) => setModuleName(event.target.value)}><option value="">All modules</option>{data?.modules.map((module) => <option key={module}>{module}</option>)}</select>
      <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="live">Live</option><option value="offline">Offline</option><option value="ended">Ended</option></select>
    </div>
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div> : !data?.summaries.length ? <p className="p-12 text-center text-sm text-muted-foreground">No assessment results match these filters.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">{["Assessment", "Participants", "Average", "Median", "Pass / Fail", "Range", ""].map((header) => <th key={header} className="px-4 py-3 font-medium">{header}</th>)}</tr></thead><tbody>{data.summaries.map((summary) => <tr key={summary.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><p className="font-semibold">{summary.title}</p><p className="text-xs text-muted-foreground">{summary.moduleName} · {summary.questionCount} questions</p></td><td className="px-4 py-3"><span className="inline-flex items-center gap-1"><Users size={14} />{summary.participants}</span></td><td className="px-4 py-3 font-semibold">{summary.average}%</td><td className="px-4 py-3">{summary.median}%</td><td className="px-4 py-3"><span className="text-emerald-600">{summary.passed}</span> / <span className="text-destructive">{summary.failed}</span></td><td className="px-4 py-3">{summary.lowest}%–{summary.highest}%</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Link href={`/admin/results/${summary.id}`} className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground"><BarChart3 size={14} />Open</Link><a href={`/api/admin/results/export?assessmentId=${encodeURIComponent(summary.id)}&format=csv`} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border" aria-label={`Export ${summary.title}`}><Download size={14} /></a></div></td></tr>)}</tbody></table></div>}
    </div>
    {(data?.total ?? 0) > (data?.pageSize ?? 20) && <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>Page {data?.page ?? page} of {Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20))}</span>
      <div className="flex gap-2"><button type="button" disabled={page===1} onClick={() => setPage(value => Math.max(1,value-1))} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40">Previous</button><button type="button" disabled={page*(data?.pageSize ?? 20)>=(data?.total ?? 0)} onClick={() => setPage(value => value+1)} className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40">Next</button></div>
    </div>}
  </div>
}
