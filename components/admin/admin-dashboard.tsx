"use client"

import Link from "next/link"
import {
  BookOpenIcon, ClipboardCheckIcon, FileInputIcon, LayoutGridIcon,
  PlusIcon, StethoscopeIcon, UsersIcon, WaypointsIcon, AlertCircleIcon,
  ServerIcon, HardDriveIcon, GlobeIcon, MailIcon, CheckCircle2Icon, ArrowUpRightIcon,
  EyeIcon, MoreHorizontalIcon,
} from "lucide-react"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 1 : 2).replace(/\.?0+$/, "") + "K"
  return n.toLocaleString()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 130, h = 38
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pad = 4
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - pad * 2) + pad
    const y = h - pad - ((v - min) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(" ")
  const areaPoints = `${pad},${h} ${points} ${w - pad},${h}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" aria-hidden>
      <defs>
        <linearGradient id={`sg-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.18} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sg-${color.replace("#", "")})`} />
      <polyline points={points} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Donut Chart ───────────────────────────────────────────────────────────────

function DonutChart({ segments }: { segments: Array<{ value: number; color: string }> }) {
  const total = segments.reduce((a, b) => a + b.value, 0) || 1
  const r = 65, cx = 90, cy = 90
  const circ = 2 * Math.PI * r
  const gap = 3
  let cumulative = 0
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="26" />
      {segments.map((seg, i) => {
        const dash = Math.max(0, (seg.value / total) * circ - gap)
        const offset = -(cumulative / total) * circ + (circ / 4)
        cumulative += seg.value
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth="26"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={offset}
          />
        )
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--foreground)">{fmt(total)}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9.5" fill="var(--muted-foreground)">Total Items</text>
    </svg>
  )
}

// ─── Activity Line Chart ────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const ACTIVITY_DATA = {
  mcq:    [820, 1100, 950, 1480, 1250, 1680, 1420],
  theory: [310, 420, 380, 510, 470, 590, 540],
  osce:   [120, 190, 160, 240, 210, 280, 250],
}

function ActivityChart() {
  const w = 520, h = 180, py = 16, px = 36
  const allVals = [...ACTIVITY_DATA.mcq, ...ACTIVITY_DATA.theory, ...ACTIVITY_DATA.osce]
  const maxVal = Math.max(...allVals)
  const yTicks = [0, 500, 1000, 1500, 2000].filter(t => t <= maxVal + 300)

  const toX = (i: number) => px + (i / 6) * (w - px * 2)
  const toY = (v: number) => py + h - py - (v / (maxVal * 1.15)) * (h - py * 2)

  const series = [
    { key: "mcq" as const, color: "#14b8a6", label: "MCQ Attempts" },
    { key: "theory" as const, color: "#6366f1", label: "Theory Sessions" },
    { key: "osce" as const, color: "#f59e0b", label: "OSCE Attempts" },
  ]

  return (
    <svg viewBox={`0 0 ${w} ${h + py * 2}`} className="w-full" aria-hidden>
      {/* Grid lines */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={px} x2={w - px} y1={toY(t)} y2={toY(t)} stroke="var(--border)" strokeWidth="1" />
          <text x={px - 6} y={toY(t) + 4} textAnchor="end" fontSize="9" fill="var(--muted-foreground)">{t >= 1000 ? `${t/1000}K` : t}</text>
        </g>
      ))}
      {/* X axis labels */}
      {DAYS.map((d, i) => (
        <text key={d} x={toX(i)} y={h + py * 2 - 4} textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">{d}</text>
      ))}
      {/* Lines */}
      {series.map(({ key, color }) => {
        const pts = ACTIVITY_DATA[key].map((v, i) => `${toX(i)},${toY(v)}`).join(" ")
        return (
          <g key={key}>
            <defs>
              <linearGradient id={`ag-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.15} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <polygon
              points={`${toX(0)},${toY(0)} ${pts} ${toX(6)},${toY(0)}`}
              fill={`url(#ag-${key})`}
            />
            <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {ACTIVITY_DATA[key].map((v, i) => (
              <circle key={i} cx={toX(i)} cy={toY(v)} r="3" fill={color} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DashboardData = {
  students: number
  mcqQuestions: number
  theoryQuestions: number
  osceStations: number
  liveAssessments: number
  pendingApprovals: number
  recentAssessments: Array<{
    id: string
    title: string
    module_name: string
    question_count: number
    status: string
    created_at: string
  }>
  dbReady: boolean
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

const SPARKLINE_TRENDS = {
  students:         [2180, 2240, 2290, 2340, 2380, 2420, 2456],
  mcqQuestions:     [18100, 18220, 18310, 18400, 18510, 18580, 18642],
  theoryQuestions:  [7100, 7180, 7230, 7280, 7330, 7360, 7389],
  osceStations:     [230, 238, 242, 247, 250, 253, 256],
  liveAssessments:  [18, 21, 19, 24, 22, 20, 24],
  pendingApprovals: [12, 15, 11, 14, 16, 13, 18],
}

type CardKey = keyof typeof SPARKLINE_TRENDS

interface StatCardProps {
  label: string
  value: number | null
  delta: string
  deltaPositive: boolean
  icon: React.ReactNode
  iconBg: string
  sparkColor: string
  sparkKey: CardKey
  note?: string
}

function StatCard({ label, value, delta, deltaPositive, icon, iconBg, sparkColor, sparkKey, note }: StatCardProps) {
  const trend = SPARKLINE_TRENDS[sparkKey]
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 min-w-[170px]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {value === null ? "—" : fmt(value)}
          </p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
      </div>
      {note ? (
        <p className="mt-1 text-[11px] font-medium text-destructive">{note}</p>
      ) : (
        <p className={`mt-1 text-[11px] font-medium ${deltaPositive ? "text-emerald-500" : "text-destructive"}`}>
          {delta} ↑ this week
        </p>
      )}
      <div className="mt-2">
        <Sparkline data={trend} color={sparkColor} />
      </div>
    </div>
  )
}

// ─── Quick Action Button ────────────────────────────────────────────────────────

function QuickAction({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:bg-muted group">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight text-foreground">{title}</span>
        <span className="block text-[11px] leading-tight text-muted-foreground mt-0.5">{subtitle}</span>
      </span>
      <ArrowUpRightIcon size={14} className="shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
    </Link>
  )
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────

const RECENT_ACTIVITIES = [
  { icon: BookOpenIcon, color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950", title: "New theory question added", sub: "Dermatology · Set 3", time: "2 minutes ago" },
  { icon: ClipboardCheckIcon, color: "text-teal-500 bg-teal-50 dark:bg-teal-950", title: "Assessment created", sub: "End of Module · Medicine", time: "1 hour ago" },
  { icon: UsersIcon, color: "text-blue-500 bg-blue-50 dark:bg-blue-950", title: "User account approved", sub: "john.doe@student.edu", time: "2 hours ago" },
  { icon: FileInputIcon, color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950", title: "Content imported successfully", sub: "1,245 questions imported", time: "3 hours ago" },
  { icon: StethoscopeIcon, color: "text-amber-500 bg-amber-50 dark:bg-amber-950", title: "OSCE station updated", sub: "Cardiovascular Exam", time: "5 hours ago" },
]

const TOP_TOPICS = [
  { name: "Cardiovascular System", type: "MCQ", typeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300", pct: 92 },
  { name: "Endocrine Disorders", type: "Theory", typeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300", pct: 87 },
  { name: "Respiratory Medicine", type: "MCQ", typeColor: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300", pct: 85 },
  { name: "Neurological Exam", type: "OSCE", typeColor: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", pct: 78 },
]

const STATUS_STYLES: Record<string, string> = {
  live:    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  draft:   "bg-muted text-muted-foreground",
  ended:   "bg-border text-muted-foreground",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
}

export function AdminDashboard({ data }: { data: DashboardData }) {
  const mcqPct = data.mcqQuestions
  const theoryPct = data.theoryQuestions || Math.round(data.mcqQuestions * 0.4)
  const oscePct = data.osceStations || Math.round(data.mcqQuestions * 0.014)
  const totalItems = mcqPct + theoryPct + oscePct

  const statCards: StatCardProps[] = [
    {
      label: "Total Students", value: data.students, delta: "+154", deltaPositive: true,
      icon: <UsersIcon size={16} />, iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400",
      sparkColor: "#3b82f6", sparkKey: "students",
    },
    {
      label: "MCQ Questions", value: data.mcqQuestions, delta: "+312", deltaPositive: true,
      icon: <BookOpenIcon size={16} />, iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400",
      sparkColor: "#14b8a6", sparkKey: "mcqQuestions",
    },
    {
      label: "Theory Questions", value: data.theoryQuestions, delta: "+128", deltaPositive: true,
      icon: <LayoutGridIcon size={16} />, iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400",
      sparkColor: "#6366f1", sparkKey: "theoryQuestions",
    },
    {
      label: "OSCE Stations", value: data.osceStations, delta: "+12", deltaPositive: true,
      icon: <StethoscopeIcon size={16} />, iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400",
      sparkColor: "#a855f7", sparkKey: "osceStations",
    },
    {
      label: "Live Assessments", value: data.liveAssessments, delta: "", deltaPositive: true,
      icon: <ClipboardCheckIcon size={16} />, iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400",
      sparkColor: "#f59e0b", sparkKey: "liveAssessments",
      note: data.liveAssessments > 0 ? `${data.liveAssessments} ongoing` : undefined,
    },
    {
      label: "Pending Approvals", value: data.pendingApprovals, delta: "", deltaPositive: false,
      icon: <AlertCircleIcon size={16} />, iconBg: "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400",
      sparkColor: "#ef4444", sparkKey: "pendingApprovals",
      note: data.pendingApprovals > 0 ? "Needs review" : undefined,
    },
  ]

  return (
    <div className="space-y-5 pb-8">

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, Admin 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening on your MedNexus platform today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {statCards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>

      {/* Platform Overview + Platform Activity */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Donut */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold">Platform Overview</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Content distribution across all study modes</p>
          <div className="mt-4 flex items-center gap-5">
            <div className="shrink-0">
              <DonutChart segments={[
                { value: mcqPct, color: "#14b8a6" },
                { value: theoryPct, color: "#6366f1" },
                { value: oscePct, color: "#a855f7" },
              ]} />
            </div>
            <div className="space-y-3 text-sm">
              {[
                { label: "MCQ Questions", value: mcqPct, color: "#14b8a6" },
                { label: "Theory Questions", value: theoryPct, color: "#6366f1" },
                { label: "OSCE Stations", value: oscePct, color: "#a855f7" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span>
                    <span className="block font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {fmt(value)} ({totalItems ? Math.round((value / totalItems) * 100) : 0}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Line chart */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Platform Activity</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Last 7 Days</p>
            </div>
          </div>
          <div className="mt-3">
            <ActivityChart />
          </div>
          <div className="mt-2 flex items-center gap-5 text-[11px] text-muted-foreground">
            {[
              { color: "#14b8a6", label: "MCQ Attempts" },
              { color: "#6366f1", label: "Theory Sessions" },
              { color: "#f59e0b", label: "OSCE Attempts" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className="h-2 w-5 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions + Recent Activities + System Health */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Quick Actions</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <QuickAction href="/admin/mcq" icon={<PlusIcon size={15} />} title="Add MCQ" subtitle="Create new multiple choice question" />
            <QuickAction href="/admin/theory" icon={<BookOpenIcon size={15} />} title="Add Theory Question" subtitle="Create new theory question" />
            <QuickAction href="/admin/mcq" icon={<StethoscopeIcon size={15} />} title="Add OSCE Station" subtitle="Create new OSCE station" />
            <QuickAction href="/admin/assessments" icon={<ClipboardCheckIcon size={15} />} title="Create Assessment" subtitle="Build new assessment" />
            <QuickAction href="/admin/imports-exports" icon={<FileInputIcon size={15} />} title="Import Content" subtitle="Import questions from files" />
            <QuickAction href="/admin/modules" icon={<WaypointsIcon size={15} />} title="Manage Modules" subtitle="Organise modules & sets" />
          </div>
        </div>

        {/* Recent Activities */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Recent Activities</h2>
          <div className="space-y-3">
            {RECENT_ACTIVITIES.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${a.color}`}>
                  <a.icon size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-tight text-foreground">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground">{a.sub}</p>
                </div>
                <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Health */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">System Health</h2>
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2">
            <CheckCircle2Icon size={14} className="text-emerald-500 shrink-0" />
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {data.dbReady ? "All Systems Operational" : "Degraded — DB offline"}
            </span>
          </div>
          <div className="space-y-3">
            {[
              { icon: ServerIcon, label: "Database", ok: data.dbReady },
              { icon: HardDriveIcon, label: "File Storage", ok: true },
              { icon: GlobeIcon, label: "API Services", ok: true },
              { icon: MailIcon, label: "Email Services", ok: true },
            ].map(({ icon: Icon, label, ok }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon size={13} />
                  {label}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-destructive"}`} />
                  <span className={`text-[11px] font-medium ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {ok ? "Operational" : "Offline"}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-muted-foreground">Uptime <span className="font-semibold text-emerald-600 dark:text-emerald-400">99.9%</span></p>
        </div>
      </div>

      {/* Recent Assessments + Top Performing Topics */}
      <div className="grid gap-4 lg:grid-cols-5">
        {/* Recent Assessments table */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Assessments</h2>
            <Link href="/admin/assessments" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {data.recentAssessments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No assessments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {["Assessment Name", "Module", "Questions", "Status", "Created", ""].map(h => (
                      <th key={h} className="pb-2 text-left font-medium text-muted-foreground pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recentAssessments.map((a) => (
                    <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 pr-3 font-medium text-foreground max-w-[160px] truncate">{a.title}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground max-w-[100px] truncate">{a.module_name || "—"}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{a.question_count}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[a.status] ?? STATUS_STYLES.draft}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground whitespace-nowrap">{fmtDate(a.created_at)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <Link href={`/admin/assessments`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <EyeIcon size={12} />
                          </Link>
                          <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                            <MoreHorizontalIcon size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Performing Topics */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Top Performing Topics</h2>
            <button type="button" className="text-xs text-primary hover:underline">View all →</button>
          </div>
          <div className="space-y-3.5">
            {TOP_TOPICS.map((t) => (
              <div key={t.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">{t.name}</span>
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${t.typeColor}`}>{t.type}</span>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-foreground ml-2">{t.pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${t.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
