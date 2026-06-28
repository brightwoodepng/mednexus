"use client"

import { useEffect, useState, useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { getLiveModules, getWeakAreaQuestions } from "@/lib/modules"
import {
  StethoscopeIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  LogOutIcon,
  XIcon,
  DatabaseIcon,
  MegaphoneIcon,
  UserIcon,
  LayersIcon,
  ActivityIcon,
  ChevronLeftIcon,
  ClipboardListIcon,
  RadioIcon,
} from "@/components/icons"
import type { Screen } from "@/lib/view"

function UsersIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

interface SidebarProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
  onOpenThemes: () => void
  onOpenAdminLogin: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  onReadyForQuiz: (config: { module: string; discipline: string | null }) => void
  onSelectModule: (module: string) => void
  collapsed: boolean
  onCollapse: () => void
  onExpand: () => void
}

export function Sidebar({
  screen,
  onNavigate,
  onOpenThemes,
  onOpenAdminLogin,
  mobileOpen,
  onCloseMobile,
  onReadyForQuiz,
  onSelectModule,
  collapsed,
  onCollapse,
  onExpand,
}: SidebarProps) {
  const { user, cloudEnabled, signOutUser, progress } = useApp()
  const { isAdmin, logoutAdmin } = useAdmin()

  const nav = (id: Screen) => { onNavigate(id); onCloseMobile() }

  const weakCount = useMemo(
    () => getWeakAreaQuestions(progress.history).length,
    [progress.history],
  )

  const [hasLiveAssessment, setHasLiveAssessment] = useState(false)
  useEffect(() => {
    async function checkLive() {
      try {
        const res = await fetch("/api/assessments")
        if (res.ok) {
          const data = await res.json()
          setHasLiveAssessment((data.assessments ?? []).some((a: { status: string }) => a.status === "live"))
        }
      } catch {}
    }
    checkLive()
    const id = setInterval(checkLive, 30_000)
    return () => clearInterval(id)
  }, [])

  const fullContent = (
    <div className="flex h-full flex-col gap-2 p-4 overflow-hidden">
      {/* Top bar */}
      <div className="mb-1 flex items-center justify-end px-1 pt-1 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCollapse}
            className="hidden rounded-xl p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground glass-pill-hover lg:flex"
            aria-label="Collapse sidebar"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-xl p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground glass-pill-hover lg:hidden"
            aria-label="Close menu"
          >
            <XIcon size={20} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <nav className="flex flex-col gap-0.5">
          <NavButton active={screen === "dashboard"} onClick={() => nav("dashboard")} icon={<LayoutDashboardIcon size={18} />} label="Dashboard" />
          <NavButton active={screen === "profile"} onClick={() => nav("profile")} icon={<UserIcon size={18} />} label="Profile" />

          <GlassDivider />

          <NavButton active={screen === "modules"} onClick={() => nav("modules")} icon={<LayersIcon size={18} />} label="Study Modules" badge={String(getLiveModules().length)} />
          <NavButton active={screen === "weak-areas"} onClick={() => nav("weak-areas")} icon={<ActivityIcon size={18} />} label="Weak Areas" badge={weakCount > 0 ? String(weakCount) : undefined} />
          <NavButton active={screen === "live-assessments"} onClick={() => nav("live-assessments")} icon={<RadioIcon size={18} />} label="Live Assessments" liveDot={hasLiveAssessment} />

          {isAdmin && (
            <>
              <GlassDivider />
              <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">Admin</p>
              <NavButton active={screen === "user-management"} onClick={() => nav("user-management")} icon={<UsersIcon size={18} />} label="Users" adminBadge="Admin" />
              <NavButton active={screen === "question-editor"} onClick={() => nav("question-editor")} icon={<DatabaseIcon size={18} />} label="Question Editor" adminBadge="Admin" />
              <NavButton active={screen === "broadcast"} onClick={() => nav("broadcast")} icon={<MegaphoneIcon size={18} />} label="Broadcast" adminBadge="Admin" />
              <NavButton active={screen === "live-assessments-admin"} onClick={() => nav("live-assessments-admin")} icon={<ClipboardListIcon size={18} />} label="Assessments" adminBadge="Admin" />
            </>
          )}

          <GlassDivider />

          <button
            type="button"
            onClick={() => { onOpenThemes(); onCloseMobile() }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 glass-pill-hover"
          >
            <PaletteIcon size={18} />
            Themes
          </button>
        </nav>
      </div>

      {/* Bottom section */}
      <div className="shrink-0 flex flex-col gap-2 pt-2">
        {isAdmin ? (
          <div className="flex items-center justify-between rounded-xl glass-card px-3 py-2">
            <div className="flex items-center gap-2">
              <DatabaseIcon size={13} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Admin Mode</span>
            </div>
            <button
              type="button"
              onClick={logoutAdmin}
              className="rounded-lg px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 glass-pill-hover"
            >
              Exit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="flex items-center gap-2 rounded-xl glass-card px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
          >
            <DatabaseIcon size={13} />
            Admin Login
          </button>
        )}

        {/* User card */}
        <div className="flex items-center gap-3 rounded-xl glass-card px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/90 text-sidebar-primary-foreground shadow-sm">
            <UserIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              {isAdmin && !user ? "Admin" : user?.name ?? "Clinician"}
            </p>
            <p className="text-[11px] text-sidebar-foreground/55">
              {isAdmin && !user
                ? "Administrator"
                : user?.role === "guest"
                  ? `Guest · ${cloudEnabled ? "☁ Synced" : "Local only"}`
                  : cloudEnabled ? "☁ Synced" : "Saving locally…"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => { signOutUser(); if (isAdmin) logoutAdmin() }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 glass-pill-hover hover:text-destructive"
        >
          <LogOutIcon size={18} />
          Sign Out
        </button>
      </div>
    </div>
  )

  const collapsedContent = (
    <div className="flex h-full flex-col items-center gap-0.5 py-4 px-2">
      <button
        type="button"
        onClick={onExpand}
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/60 hover:text-sidebar-foreground glass-pill-hover"
        aria-label="Expand sidebar"
      >
        <ChevronLeftIcon size={18} className="rotate-180" />
      </button>

      <IconButton active={screen === "dashboard"} onClick={() => nav("dashboard")} label="Dashboard"><LayoutDashboardIcon size={18} /></IconButton>
      <IconButton active={screen === "profile"} onClick={() => nav("profile")} label="Profile"><UserIcon size={18} /></IconButton>

      <div className="my-2 w-6 h-px glass-divider" />

      <IconButton active={screen === "modules"} onClick={() => nav("modules")} label="Study Modules"><LayersIcon size={18} /></IconButton>
      <IconButton active={screen === "weak-areas"} onClick={() => nav("weak-areas")} label="Weak Areas"><ActivityIcon size={18} /></IconButton>
      <IconButton active={screen === "live-assessments"} onClick={() => nav("live-assessments")} label="Live Assessments" liveDot={hasLiveAssessment}><RadioIcon size={18} /></IconButton>

      {isAdmin && (
        <>
          <div className="my-2 w-6 h-px glass-divider" />
          <IconButton active={screen === "user-management"} onClick={() => nav("user-management")} label="Users"><UsersIcon size={18} /></IconButton>
          <IconButton active={screen === "question-editor"} onClick={() => nav("question-editor")} label="Question Editor"><DatabaseIcon size={18} /></IconButton>
          <IconButton active={screen === "broadcast"} onClick={() => nav("broadcast")} label="Broadcast"><MegaphoneIcon size={18} /></IconButton>
          <IconButton active={screen === "live-assessments-admin"} onClick={() => nav("live-assessments-admin")} label="Assessments (Admin)"><ClipboardListIcon size={18} /></IconButton>
        </>
      )}

      <div className="my-2 w-6 h-px glass-divider" />
      <IconButton active={false} onClick={onOpenThemes} label="Themes"><PaletteIcon size={18} /></IconButton>

      <div className="mt-auto">
        <IconButton active={false} onClick={() => { signOutUser(); if (isAdmin) logoutAdmin() }} label="Sign Out"><LogOutIcon size={18} /></IconButton>
      </div>
    </div>
  )

  return (
    <>
      <aside className={`hidden shrink-0 glass-sidebar lg:block transition-all duration-200 ${collapsed ? "w-14" : "w-64"}`}>
        {collapsed ? collapsedContent : fullContent}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] glass-sidebar shadow-2xl animate-in slide-in-from-left duration-200">
            {fullContent}
          </div>
        </div>
      )}
    </>
  )
}

function GlassDivider() {
  return <div className="my-1.5 h-px glass-divider mx-1" />
}

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  )
}

function NavButton({ active, onClick, icon, label, badge, adminBadge, liveDot }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: string; adminBadge?: string; liveDot?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "glass-pill-active text-sidebar-accent-foreground"
          : "text-sidebar-foreground/80 glass-pill-hover"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {liveDot && <LiveDot />}
      {badge && (
        <span className="rounded-full glass-card px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-foreground/70 tabular-nums">
          {badge}
        </span>
      )}
      {adminBadge && (
        <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"
          style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.22)" }}
        >
          {adminBadge}
        </span>
      )}
    </button>
  )
}

function IconButton({ active, onClick, label, children, liveDot }: {
  active: boolean; onClick: () => void; label: string; children: React.ReactNode; liveDot?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
        active
          ? "glass-pill-active text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 glass-pill-hover"
      }`}
    >
      {children}
      {liveDot && (
        <span className="absolute top-1 right-1 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      )}
    </button>
  )
}
