"use client"

import Link from "next/link"
import {
  AlertCircleIcon, BookOpenIcon, CheckCircle2Icon, ClipboardCheckIcon,
  FileInputIcon, LayoutGridIcon, ServerIcon, UsersIcon,
  EyeIcon, MoreHorizontalIcon, MessageSquareTextIcon, ShieldCheckIcon,
} from "lucide-react"

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 1 : 2).replace(/\.?0+$/, "") + "K"
  return n.toLocaleString()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export type DashboardData = {
  students: number
  mcqQuestions: number
  theoryQuestions: number
  liveAssessments: number
  pendingApprovals: number
  recentAssessments: Array<{ id: string; title: string; module_name: string; question_count: number; status: string; share_token: string; created_at: string }>
  activity: Array<{ label: string; assessment_submissions: number; theory_activity: number; registrations: number }>
  workQueue: { mcqReview: number; theoryDrafts: number; theoryReview: number; pendingUsers: number; liveAssessments: number }
  contentStatus: { mcq: Record<string, number>; theory: Record<string, number> }
  recentActivities: Array<{ id: number; actor_id: string; action: string; resource_type: string; resource_id: string | null; details: Record<string, unknown>; created_at: string }>
  topTopics: Array<{ topic: string; attempts: number; accuracy: number }>
  health: { database: boolean; questionBankSource: string; questionBankCount: number; gemini: boolean; firestoreConfigured: boolean; firestoreAvailable: boolean }
  dbReady: boolean
}

function DonutChart({ segments }: { segments: Array<{ value: number; color: string }> }) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  const r = 65, cx = 90, cy = 90, circ = 2 * Math.PI * r, gap = 3
  let cumulative = 0
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="26" />
      {total > 0 && segments.map((segment, index) => {
        const dash = Math.max(0, (segment.value / total) * circ - gap)
        const offset = -(cumulative / total) * circ + circ / 4
        cumulative += segment.value
        return <circle key={index} cx={cx} cy={cy} r={r} fill="none" stroke={segment.color} strokeWidth="26" strokeDasharray={`${dash} ${circ}`} strokeDashoffset={offset} />
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--foreground)">{fmt(total)}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9.5" fill="var(--muted-foreground)">Content items</text>
    </svg>
  )
}

function ActivityChart({ activity }: { activity: DashboardData["activity"] }) {
  const w = 520, h = 180, py = 16, px = 36
  const series = [
    { key: "assessment_submissions" as const, color: "#14b8a6", label: "Assessment submissions" },
    { key: "theory_activity" as const, color: "#6366f1", label: "Theory activity" },
    { key: "registrations" as const, color: "#f59e0b", label: "Registrations" },
  ]
  const values = activity.flatMap(day => series.map(({ key }) => day[key]))
  const max = Math.max(...values, 1)
  const yTicks = [0, Math.ceil(max / 2), max]
  const toX = (index: number) => px + (index / Math.max(activity.length - 1, 1)) * (w - px * 2)
  const toY = (value: number) => py + h - py - (value / (max * 1.15)) * (h - py * 2)

  return (
    <svg viewBox={`0 0 ${w} ${h + py * 2}`} className="w-full" aria-hidden>
      {yTicks.map(tick => <g key={tick}><line x1={px} x2={w - px} y1={toY(tick)} y2={toY(tick)} stroke="var(--border)" strokeWidth="1" /><text x={px - 6} y={toY(tick) + 4} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">{tick}</text></g>)}
      {activity.map((day, index) => <text key={index} x={toX(index)} y={h + py * 2 - 4} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">{day.label}</text>)}
      {series.map(({ key, color }) => {
        const points = activity.map((day, index) => `${toX(index)},${toY(day[key])}`).join(" ")
        return <g key={key}><polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />{activity.map((day, index) => <circle key={index} cx={toX(index)} cy={toY(day[key])} r="3" fill={color} />)}</g>
      })}
    </svg>
  )
}

function StatCard({ label, value, note, icon, iconBg }: { label: string; value: number; note: string; icon: React.ReactNode; iconBg: string }) {
  return <div className="flex min-w-[170px] flex-col justify-between rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-medium leading-tight text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{fmt(value)}</p></div><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span></div><p className="mt-4 text-[11px] font-medium text-muted-foreground">{note}</p></div>
}

function QuickAction({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return <Link href={href} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-muted"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-tight text-foreground">{title}</span><span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{subtitle}</span></span></Link>
}

function EditorialStatus({ title, counts }: { title: string; counts: Record<string, number> }) {
  const rows = title === "MCQ Bank"
    ? [["Live", counts.live ?? 0, "bg-emerald-500"], ["Review", counts.review ?? 0, "bg-sky-500"], ["Draft", counts.draft ?? 0, "bg-slate-400"], ["Offline", counts.offline ?? 0, "bg-amber-500"], ["Archived", counts.archived ?? 0, "bg-rose-500"]]
    : [["Published", counts.published ?? 0, "bg-emerald-500"], ["Review", counts.review ?? 0, "bg-sky-500"], ["Draft", counts.draft ?? 0, "bg-slate-400"], ["Archived", counts.archived ?? 0, "bg-rose-500"]]
  const total = rows.reduce((sum, row) => sum + Number(row[1]), 0)
  return <div><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3><span className="text-xs text-muted-foreground">{fmt(total)} total</span></div><div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted">{rows.map(([label, value, color]) => Number(value) > 0 && <span key={String(label)} title={`${label}: ${value}`} className={String(color)} style={{ width: `${total ? Number(value) / total * 100 : 0}%` }}/>)}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{rows.map(([label, value, color]) => <span key={String(label)} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={`h-2 w-2 rounded-full ${color}`}/>{label} <b className="text-foreground">{value}</b></span>)}</div></div>
}

const STATUS_STYLES: Record<string, string> = { live: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400", draft: "bg-muted text-muted-foreground", ended: "bg-border text-muted-foreground", pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" }

type Capability = "mcq" | "theory" | "assessments" | "users" | "system" | "broadcasts"

export function AdminDashboard({ data, capabilities }: { data: DashboardData; capabilities: Record<Capability, boolean> }) {
  const content = [
    { label: "MCQ Questions", value: data.mcqQuestions, color: "#14b8a6" },
    { label: "Theory Questions", value: data.theoryQuestions, color: "#6366f1" },
  ]
  const totalItems = content.reduce((sum, item) => sum + item.value, 0)
  const activityTotal = data.activity.reduce((sum, day) => sum + day.assessment_submissions + day.theory_activity + day.registrations, 0)
  const activityTotals = { assessment_submissions: data.activity.reduce((sum, day) => sum + day.assessment_submissions, 0), theory_activity: data.activity.reduce((sum, day) => sum + day.theory_activity, 0), registrations: data.activity.reduce((sum, day) => sum + day.registrations, 0) }
  const reviewTotal = data.workQueue.mcqReview + data.workQueue.theoryReview
  const statCards = [
    { label: "Approved Students", value: data.students, note: "Current approved accounts", icon: <UsersIcon size={16} />, iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400" },
    { label: "MCQ Questions", value: data.mcqQuestions, note: "Current question bank", icon: <BookOpenIcon size={16} />, iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400" },
    { label: "Theory Questions", value: data.theoryQuestions, note: "Current theory records", icon: <LayoutGridIcon size={16} />, iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400" },
    { label: "Needs Review", value: reviewTotal, note: "Across MCQ and Theory", icon: <ShieldCheckIcon size={16} />, iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400" },
    { label: "Live Assessments", value: data.liveAssessments, note: "Currently live", icon: <ClipboardCheckIcon size={16} />, iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400" },
    { label: "Pending Approvals", value: data.pendingApprovals, note: data.pendingApprovals ? "Require review" : "None awaiting review", icon: <AlertCircleIcon size={16} />, iconBg: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400" },
  ]
  const quickActions = [
    capabilities.mcq && { href: "/admin/mcq?status=review", icon: <ShieldCheckIcon size={15}/>, title: "Review MCQs", subtitle: `${data.workQueue.mcqReview} awaiting review` },
    capabilities.theory && { href: "/admin/theory?status=review", icon: <BookOpenIcon size={15}/>, title: "Review Theory", subtitle: `${data.workQueue.theoryReview} awaiting review` },
    (capabilities.mcq || capabilities.theory) && { href: "/admin/imports-exports", icon: <FileInputIcon size={15}/>, title: "Import Content", subtitle: "Stage MCQ or Theory files" },
    capabilities.assessments && { href: "/admin/assessments", icon: <ClipboardCheckIcon size={15}/>, title: "Create Assessment", subtitle: "Build a live assessment" },
    capabilities.users && { href: "/admin/users", icon: <UsersIcon size={15}/>, title: "Manage Students", subtitle: `${data.pendingApprovals} pending approval` },
    capabilities.broadcasts && { href: "/admin/notifications", icon: <MessageSquareTextIcon size={15}/>, title: "Send Broadcast", subtitle: "Notify learners" },
  ].filter(Boolean) as Array<{ href: string; icon: React.ReactNode; title: string; subtitle: string }>
  const workItems = [
    capabilities.mcq && { label: "MCQs awaiting review", value: data.workQueue.mcqReview, href: "/admin/mcq?status=review", color: "text-teal-600" },
    capabilities.theory && { label: "Theory drafts", value: data.workQueue.theoryDrafts, href: "/admin/theory?status=draft", color: "text-indigo-600" },
    capabilities.theory && { label: "Theory awaiting review", value: data.workQueue.theoryReview, href: "/admin/theory?status=review", color: "text-violet-600" },
    capabilities.users && { label: "Pending students", value: data.workQueue.pendingUsers, href: "/admin/users?status=pending", color: "text-amber-600" },
    capabilities.assessments && { label: "Live assessments", value: data.workQueue.liveAssessments, href: "/admin/assessments", color: "text-emerald-600" },
  ].filter(Boolean) as Array<{ label: string; value: number; href: string; color: string }>

  return <div className="space-y-5 pb-8">
    <div><h1 className="text-2xl font-bold tracking-tight">Welcome back, Admin 👋</h1><p className="mt-1 text-sm text-muted-foreground">A current view of persisted MedNexus records.</p></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{statCards.map(card => <StatCard key={card.label} {...card} />)}</div>
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2"><h2 className="text-sm font-semibold">Platform Overview</h2><p className="mt-0.5 text-xs text-muted-foreground">Current content records by study mode</p><div className="mt-4 flex items-center gap-5"><div className="shrink-0"><DonutChart segments={content.map(({ value, color }) => ({ value, color }))} /></div><div className="space-y-3 text-sm">{content.map(item => <div key={item.label} className="flex items-start gap-2"><span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} /><span><span className="block font-medium text-foreground">{item.label}</span><span className="block text-xs text-muted-foreground">{fmt(item.value)} ({totalItems ? Math.round(item.value / totalItems * 100) : 0}%)</span></span></div>)}</div></div></div>
      <div className="rounded-xl border border-border bg-card p-5 lg:col-span-3"><h2 className="text-sm font-semibold">Platform Activity</h2><p className="mt-0.5 text-xs text-muted-foreground">Registrations and learning activity in the last 14 days</p>{activityTotal > 0 ? <><div className="mt-3"><ActivityChart activity={data.activity} /></div><div className="mt-2 flex flex-wrap items-center gap-5 text-[11px] text-muted-foreground">{[{ color: "#14b8a6", label: "Assessment submissions", total: activityTotals.assessment_submissions }, { color: "#6366f1", label: "Theory activity", total: activityTotals.theory_activity }, { color: "#f59e0b", label: "Registrations", total: activityTotals.registrations }].map(item => <span key={item.label} className="flex items-center gap-1.5"><span className="h-2 w-5 rounded-full" style={{ background: item.color }} />{item.label}: {fmt(item.total)}</span>)}</div></> : <p className="py-16 text-center text-xs text-muted-foreground">No activity recorded yet.</p>}</div>
    </div>
    <section className="rounded-xl border border-border bg-card p-5"><div><h2 className="text-sm font-semibold">Editorial Readiness</h2><p className="mt-0.5 text-xs text-muted-foreground">Current publication status across both study banks</p></div><div className="mt-5 grid gap-6 lg:grid-cols-2"><EditorialStatus title="MCQ Bank" counts={data.contentStatus.mcq}/><EditorialStatus title="Theory Vault" counts={data.contentStatus.theory}/></div></section>
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2"><h2 className="mb-3 text-sm font-semibold">Quick Actions</h2><div className="grid gap-2 sm:grid-cols-2">{quickActions.map(action => <QuickAction key={action.title} {...action}/>)}</div></div>
      <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2"><h2 className="mb-3 text-sm font-semibold">Work Queue</h2><div className="space-y-2">{workItems.map(item => <Link key={item.label} href={item.href} className="flex min-h-10 items-center justify-between rounded-lg border border-border px-3 text-xs transition-colors hover:bg-muted"><span>{item.label}</span><b className={item.color}>{fmt(item.value)}</b></Link>)}</div></div>
      <div className="rounded-xl border border-border bg-card p-5"><h2 className="mb-3 text-sm font-semibold">System Health</h2><div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${data.health.database ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-red-50 dark:bg-red-950/40"}`}><CheckCircle2Icon size={14} className={data.health.database ? "shrink-0 text-emerald-500" : "shrink-0 text-destructive"} /><span className={`text-xs font-semibold ${data.health.database ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>{data.health.database ? "Core services available" : "Database unavailable"}</span></div><div className="mt-4 space-y-2">{[["Database", data.health.database ? "Available" : "Unavailable"],["Question bank", `${data.health.questionBankSource} · ${data.health.questionBankCount}`],["Gemini", data.health.gemini ? "Configured" : "Unavailable"],["Firestore fallback", data.health.firestoreConfigured ? (data.health.firestoreAvailable ? "Available" : "Optional") : "Not configured"]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ServerIcon size={13} />{label}</span><span className="text-right text-[11px] font-medium">{value}</span></div>)}</div><p className="mt-4 text-[10px] text-muted-foreground">Optional fallbacks do not affect health while PostgreSQL serves the live bank.</p></div>
    </div>
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="rounded-xl border border-border bg-card p-5 lg:col-span-3"><div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Recent Assessments</h2><Link href="/admin/assessments" className="text-xs text-primary hover:underline">View all →</Link></div>{data.recentAssessments.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">No assessments yet.</p> : <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-border">{["Assessment Name", "Module", "Questions", "Status", "Created", ""].map(header => <th key={header} className="whitespace-nowrap pb-2 pr-3 text-left font-medium text-muted-foreground">{header}</th>)}</tr></thead><tbody>{data.recentAssessments.map(assessment => <tr key={assessment.id} className="border-b border-border/50 last:border-0 hover:bg-muted/40"><td className="max-w-[160px] truncate py-2.5 pr-3 font-medium text-foreground">{assessment.title}</td><td className="max-w-[100px] truncate py-2.5 pr-3 text-muted-foreground">{assessment.module_name || "—"}</td><td className="py-2.5 pr-3 text-muted-foreground">{assessment.question_count}</td><td className="py-2.5 pr-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[assessment.status] ?? STATUS_STYLES.draft}`}>{assessment.status}</span></td><td className="whitespace-nowrap py-2.5 pr-3 text-muted-foreground">{fmtDate(assessment.created_at)}</td><td className="py-2.5"><div className="flex items-center gap-1"><Link href="/admin/assessments" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><EyeIcon size={12} /></Link><button type="button" aria-label={`More options for ${assessment.title}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontalIcon size={12} /></button></div></td></tr>)}</tbody></table></div>}</div>
      <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2"><h2 className="mb-3 text-sm font-semibold">Top Performing Topics</h2>{data.topTopics.length ? <div className="space-y-3">{data.topTopics.map((topic) => <div key={topic.topic}><div className="flex items-center justify-between gap-2 text-xs"><span className="truncate font-medium">{topic.topic}</span><span className="font-bold">{topic.accuracy}%</span></div><div className="mt-1.5 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${topic.accuracy}%` }} /></div><p className="mt-1 text-[10px] text-muted-foreground">{topic.attempts} answered questions</p></div>)}</div> : <p className="py-12 text-center text-xs text-muted-foreground">No submitted question data yet.</p>}</div>
    </div>
  </div>
}
