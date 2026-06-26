"use client"

import { useEffect, useState, useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { getModules, getWeakAreaQuestions } from "@/lib/modules"
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
} from "@/components/icons"
import type { Screen } from "@/lib/view"

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

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!now) return null

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })

  return (
    <div className="flex flex-col items-center rounded-xl border border-sidebar-border bg-sidebar-accent/30 px-3 py-2.5 text-center">
      <span className="text-lg font-bold tabular-nums tracking-tight text-sidebar-foreground leading-none">
        {time}
      </span>
      <span className="mt-0.5 text-[11px] text-muted-foreground">{date}</span>
    </div>
  )
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

  const fullContent = (
    <div className="flex h-full flex-col gap-2 p-4 overflow-hidden">
      {/* Top row — collapse and close buttons */}
      <div className="mb-2 flex items-center justify-end px-2 pt-2 shrink-0">
        <div className="flex items-center gap-1">
          {/* Desktop collapse button */}
          <button
            type="button"
            onClick={onCollapse}
            className="hidden rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:flex"
            aria-label="Collapse sidebar"
          >
            <ChevronLeftIcon size={18} />
          </button>
          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            aria-label="Close menu"
          >
            <XIcon size={20} />
          </button>
        </div>
      </div>

      {/* Live clock */}
      <div className="shrink-0">
        <LiveClock />
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <nav className="flex flex-col gap-1">
          <NavButton active={screen === "dashboard"} onClick={() => nav("dashboard")} icon={<LayoutDashboardIcon size={18} />} label="Dashboard" />
          <NavButton active={screen === "profile"} onClick={() => nav("profile")} icon={<UserIcon size={18} />} label="Profile" />

          <div className="my-1 h-px bg-sidebar-border/60" />

          <NavButton active={screen === "modules"} onClick={() => nav("modules")} icon={<LayersIcon size={18} />} label="Study Modules" badge={String(getModules().length)} />
          <NavButton active={screen === "weak-areas"} onClick={() => nav("weak-areas")} icon={<ActivityIcon size={18} />} label="Weak Areas" badge={weakCount > 0 ? String(weakCount) : undefined} />

          {isAdmin && (
            <>
              <div className="my-1 h-px bg-sidebar-border/60" />
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">Admin</p>
              <NavButton active={screen === "question-editor"} onClick={() => nav("question-editor")} icon={<DatabaseIcon size={18} />} label="Question Editor" adminBadge="Admin" />
              <NavButton active={screen === "broadcast"} onClick={() => nav("broadcast")} icon={<MegaphoneIcon size={18} />} label="Broadcast" adminBadge="Admin" />
            </>
          )}

          <div className="my-1 h-px bg-sidebar-border/60" />

          <button
            type="button"
            onClick={() => { onOpenThemes(); onCloseMobile() }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <PaletteIcon size={18} />
            Themes
          </button>
        </nav>
      </div>

      {/* Bottom section */}
      <div className="shrink-0 flex flex-col gap-3 pt-2">
        {isAdmin ? (
          <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <DatabaseIcon size={14} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Admin Mode</span>
            </div>
            <button type="button" onClick={logoutAdmin} className="rounded-lg px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-500/20 transition-colors">Exit</button>
          </div>
        ) : (
          <button type="button" onClick={onOpenAdminLogin} className="flex items-center gap-2 rounded-xl border border-sidebar-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors">
            <DatabaseIcon size={13} />
            Admin Login
          </button>
        )}

        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            <UserIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.name ?? "Clinician"}</p>
            <p className="text-xs text-muted-foreground">{cloudEnabled ? "☁ Synced" : "Saving locally…"}</p>
          </div>
        </div>

        <button type="button" onClick={signOutUser} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
          <LogOutIcon size={18} />
          Sign Out
        </button>
      </div>
    </div>
  )

  const collapsedContent = (
    <div className="flex h-full flex-col items-center gap-1 py-4 px-2">
      {/* Expand button */}
      <button
        type="button"
        onClick={onExpand}
        className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        aria-label="Expand sidebar"
      >
        <ChevronLeftIcon size={18} className="rotate-180" />
      </button>

      <IconButton active={screen === "dashboard"} onClick={() => nav("dashboard")} label="Dashboard"><LayoutDashboardIcon size={18} /></IconButton>
      <IconButton active={screen === "profile"} onClick={() => nav("profile")} label="Profile"><UserIcon size={18} /></IconButton>

      <div className="my-1 w-6 h-px bg-sidebar-border/60" />

      <IconButton active={screen === "modules"} onClick={() => nav("modules")} label="Study Modules"><LayersIcon size={18} /></IconButton>
      <IconButton active={screen === "weak-areas"} onClick={() => nav("weak-areas")} label="Weak Areas"><ActivityIcon size={18} /></IconButton>

      {isAdmin && (
        <>
          <div className="my-1 w-6 h-px bg-sidebar-border/60" />
          <IconButton active={screen === "question-editor"} onClick={() => nav("question-editor")} label="Question Editor"><DatabaseIcon size={18} /></IconButton>
          <IconButton active={screen === "broadcast"} onClick={() => nav("broadcast")} label="Broadcast"><MegaphoneIcon size={18} /></IconButton>
        </>
      )}

      <div className="my-1 w-6 h-px bg-sidebar-border/60" />
      <IconButton active={false} onClick={onOpenThemes} label="Themes"><PaletteIcon size={18} /></IconButton>

      <div className="mt-auto">
        <IconButton active={false} onClick={signOutUser} label="Sign Out"><LogOutIcon size={18} /></IconButton>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 border-r border-sidebar-border bg-sidebar lg:block transition-all duration-200 ${collapsed ? "w-14" : "w-64"}`}
      >
        {collapsed ? collapsedContent : fullContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={onCloseMobile} className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] border-r border-sidebar-border bg-sidebar shadow-2xl animate-in slide-in-from-left duration-200">
            {fullContent}
          </div>
        </div>
      )}
    </>
  )
}

function NavButton({ active, onClick, icon, label, badge, adminBadge }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: string; adminBadge?: string
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {badge && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">{badge}</span>}
      {adminBadge && <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-700 dark:text-amber-400">{adminBadge}</span>}
    </button>
  )
}

function IconButton({ active, onClick, label, children }: {
  active: boolean; onClick: () => void; label: string; children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}
    >
      {children}
    </button>
  )
}
