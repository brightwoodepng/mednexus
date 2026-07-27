"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, Download, Loader2 } from "lucide-react"

type Detail = {
  assessment: { id: string; title: string; moduleName: string; passMark: number; questionCount: number }
  view: "best" | "all"
  metrics: { participants: number; average: number; median: number; highest: number; lowest: number; passed: number; failed: number }
  attempts: Array<{ id: string; participantName: string; isGuest: boolean; score: number; total: number; percentage: number; passed: boolean; submittedAt: string }>
  questionPerformance: Array<{ id: string; title: string; topic: string; responses: number; accuracy: number }>
  topicPerformance: Array<{ topic: string; responses: number; accuracy: number }>
}

export function AssessmentResultDetail({ id }: { id: string }) {
  const [view, setView] = useState<"best" | "all">("best")
  const [data, setData] = useState<Detail | null>(null)
  useEffect(() => { setData(null); fetch(`/api/admin/results/${encodeURIComponent(id)}?view=${view}`).then((response) => response.json()).then(setData) }, [id, view])
  if (!data) return <div className="flex min-h-60 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  return <div className="space-y-5">
    <div><Link href="/admin/results" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} />All results</Link><div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">{data.assessment.title}</h1><p className="mt-1 text-sm text-muted-foreground">{data.assessment.moduleName} · {data.assessment.questionCount} questions · {data.assessment.passMark}% pass mark</p></div><div className="flex gap-2"><a className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold" href={`/api/admin/results/export?assessmentId=${encodeURIComponent(id)}&format=csv&view=${view}`}><Download size={15} />CSV</a><a className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground" href={`/api/admin/results/export?assessmentId=${encodeURIComponent(id)}&format=pdf&view=${view}`}><Download size={15} />PDF</a></div></div></div>
    <div className="inline-flex rounded-lg bg-muted p-1"><button className={`rounded-md px-3 py-2 text-sm font-semibold ${view === "best" ? "bg-card shadow" : ""}`} onClick={() => setView("best")}>Best Attempts</button><button className={`rounded-md px-3 py-2 text-sm font-semibold ${view === "all" ? "bg-card shadow" : ""}`} onClick={() => setView("all")}>All Attempts</button></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{Object.entries({ Participants: data.metrics.participants, Average: `${data.metrics.average}%`, Median: `${data.metrics.median}%`, Highest: `${data.metrics.highest}%`, Passed: data.metrics.passed, Failed: data.metrics.failed }).map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>)}</div>
    <div className="grid gap-4 xl:grid-cols-2"><section className="rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Participants</h2><div className="mt-3 divide-y divide-border">{data.attempts.length ? data.attempts.map((attempt, index) => <div key={attempt.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-2 py-3 text-sm"><span className="text-muted-foreground">{index + 1}</span><span><span className="block font-medium">{attempt.participantName}</span><span className="text-xs text-muted-foreground">{attempt.isGuest ? "Guest" : "Registered"} · {new Date(attempt.submittedAt).toLocaleString()}</span></span><span className={`font-bold ${attempt.passed ? "text-emerald-600" : "text-destructive"}`}>{attempt.score}/{attempt.total} · {attempt.percentage}%</span></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No submitted attempts.</p>}</div></section>
    <section className="rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Topic Performance</h2><div className="mt-3 space-y-3">{data.topicPerformance.length ? data.topicPerformance.map((topic) => <div key={topic.topic}><div className="flex justify-between text-sm"><span>{topic.topic}</span><span className="font-semibold">{topic.accuracy}%</span></div><div className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${topic.accuracy}%` }} /></div><p className="mt-1 text-[11px] text-muted-foreground">{topic.responses} responses</p></div>) : <p className="py-8 text-center text-sm text-muted-foreground">Question-level data is unavailable for older guest-only submissions.</p>}</div></section></div>
    <section className="rounded-xl border border-border bg-card p-4"><h2 className="font-semibold">Question Performance</h2><div className="mt-3 divide-y divide-border">{data.questionPerformance.map((question, index) => <div key={question.id} className="grid gap-2 py-3 sm:grid-cols-[2rem_1fr_6rem] sm:items-center"><span className="text-sm text-muted-foreground">{index + 1}</span><span><span className="line-clamp-2 text-sm font-medium">{question.title}</span><span className="text-xs text-muted-foreground">{question.topic} · {question.responses} responses</span></span><span className="text-sm font-bold">{question.accuracy}% correct</span></div>)}</div></section>
  </div>
}
