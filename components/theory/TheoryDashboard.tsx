"use client"

/**
 * TheoryDashboard — landing view inside the Theory Vault shell.
 * Warm amber/rose accent aesthetic.
 * Category cards navigate to /theory/browse?category=module|year.
 */

import { useRouter } from "next/navigation"

// ── Icons ──────────────────────────────────────────────────────────────────────

function FolderIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function BookIcon({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}

function PenLineIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

function StarIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function BarChartIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  )
}

function ClipboardListIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  )
}

function ChevronRightIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
}

function StatCard({ label, value, icon, iconBg }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-amber-200/60 bg-white/70 px-5 py-4 shadow-sm dark:border-amber-800/30 dark:bg-amber-950/20">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

// ── Category Card ──────────────────────────────────────────────────────────────

interface CategoryCardProps {
  emoji: string
  title: string
  subtitle: string
  description: string
  gradient: string
  borderColor: string
  accentColor: string
  badgeText: string
  onClick: () => void
}

function CategoryCard({ emoji, title, subtitle, description, gradient, borderColor, accentColor, badgeText, onClick }: CategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-3xl border ${borderColor} ${gradient} p-6 text-left shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
    >
      {/* Decorative circle */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-white/25 text-2xl shadow-sm backdrop-blur-sm`}>
            {emoji}
          </div>
          <span className={`rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-semibold ${accentColor} backdrop-blur-sm`}>
            {badgeText}
          </span>
        </div>

        <div>
          <p className={`text-xs font-bold uppercase tracking-widest ${accentColor} opacity-80`}>{subtitle}</p>
          <h3 className="mt-0.5 text-xl font-bold text-white">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/75">{description}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white">Browse Sets</span>
          <ChevronRightIcon size={16} className="text-white transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </button>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export function TheoryDashboard() {
  const router = useRouter()

  const stats: StatCardProps[] = [
    {
      label: "Attempted Prompts",
      value: 0,
      icon: <ClipboardListIcon size={20} className="text-amber-600 dark:text-amber-400" />,
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
    },
    {
      label: "Rubric Avg",
      value: "—",
      icon: <BarChartIcon size={20} className="text-rose-600 dark:text-rose-400" />,
      iconBg: "bg-rose-100 dark:bg-rose-900/40",
    },
    {
      label: "Active Drafts",
      value: 0,
      icon: <PenLineIcon size={20} className="text-orange-600 dark:text-orange-400" />,
      iconBg: "bg-orange-100 dark:bg-orange-900/40",
    },
    {
      label: "Starred Answers",
      value: 0,
      icon: <StarIcon size={20} className="text-yellow-600 dark:text-yellow-400" />,
      iconBg: "bg-yellow-100 dark:bg-yellow-900/40",
    },
  ]

  return (
    <div className="mx-auto max-w-4xl space-y-8">

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 p-8 shadow-sm dark:border-amber-800/30 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-rose-950/30">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-700/20" />
        <div className="pointer-events-none absolute -bottom-8 left-20 h-40 w-40 rounded-full bg-rose-200/40 blur-2xl dark:bg-rose-700/20" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-100/80 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/40 dark:text-amber-400">
            ⚗️ Theory Vault
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl">
            Structure your thoughts.
            <br />
            <span className="bg-gradient-to-r from-amber-600 to-rose-600 bg-clip-text text-transparent dark:from-amber-400 dark:to-rose-400">
              Master the clinical reasoning.
            </span>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Practice long-form clinical prompts using structured rubrics. Build the depth of knowledge that MCQs alone can&apos;t teach.
          </p>
        </div>
      </div>

      {/* Stats Row */}
      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Your Progress</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </div>

      {/* Category Cards */}
      <div>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Choose a Category</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <CategoryCard
            emoji="📁"
            title="End of Module"
            subtitle="Rotation-focused"
            description="Discipline-specific long cases tested at the end of each clinical rotation — Surgery, Medicine, O&G, and more."
            gradient="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600"
            borderColor="border-amber-400/40"
            accentColor="text-amber-100"
            badgeText="Module Exams"
            onClick={() => router.push("/theory/browse?category=module")}
          />
          <CategoryCard
            emoji="📚"
            title="End of Year"
            subtitle="Comprehensive"
            description="High-yield milestone questions spanning all disciplines — designed for final and comprehensive year-end examinations."
            gradient="bg-gradient-to-br from-rose-500 via-pink-500 to-rose-600"
            borderColor="border-rose-400/40"
            accentColor="text-rose-100"
            badgeText="Year Exams"
            onClick={() => router.push("/theory/browse?category=year")}
          />
        </div>
      </div>
    </div>
  )
}
