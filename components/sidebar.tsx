"use client"

import { useEffect, useState, useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { useTheme } from "@/contexts/theme-context"
import { getLiveModules, getWeakAreaQuestions } from "@/lib/modules"
import {
  LayoutDashboardIcon,
  LogOutIcon,
  XIcon,
  DatabaseIcon,
  MegaphoneIcon,
  UserIcon,
  LayersIcon,
  ActivityIcon,
  ChevronLeftIcon,
  RadioIcon,
  GamepadIcon,
  StoreIcon,
  TrophyIcon,
  StethoscopeIcon,
} from "@/components/icons"
import type { Screen } from "@/lib/view"
import { SidebarFrame, SidebarIconButton as IconButton, SidebarNavButton as NavButton } from "@/components/navigation/sidebar-primitives"
import { StudyHubDropdown, StudyHubDropdownIcon } from "@/components/navigation/study-hub-dropdown"
import { useApplicationShell } from "@/components/authenticated-application-shell"

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
  onOpenImporter?: () => void
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
  onOpenImporter,
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
  const { isGlassEnabled } = useTheme()
  const { activeStudyHub, setActiveStudyHub } = useApplicationShell()

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

  // ── Derived class helpers ──────────────────────────────────────────────────
  const panelCls = isGlassEnabled
    ? "glass-sidebar"
    : "bg-sidebar border-r border-sidebar-border"

  const cardCls = isGlassEnabled
    ? "glass-card"
    : "border border-sidebar-border bg-sidebar-accent/50"

  const dividerCls = isGlassEnabled
    ? "glass-divider"
    : "bg-sidebar-border/60"

  // ── Shared content ─────────────────────────────────────────────────────────
  const fullContent = (
    <div className="relative flex h-full flex-col gap-2 p-4">
      {/* ── Header bar: hub switcher + collapse/close ── */}
      <div className="mb-1 flex items-center gap-1 pt-1 shrink-0">
        <StudyHubDropdown activeHub={activeStudyHub} onSelect={setActiveStudyHub} onAfterSelect={onCloseMobile} />
        <button
          type="button"
          onClick={onCollapse}
          className={`hidden shrink-0 rounded-xl p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors lg:flex ${isGlassEnabled ? "glass-pill-hover" : "hover:bg-sidebar-accent"}`}
          aria-label="Collapse sidebar"
        >
          <ChevronLeftIcon size={18} />
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className={`shrink-0 rounded-xl p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors lg:hidden ${isGlassEnabled ? "glass-pill-hover" : "hover:bg-sidebar-accent"}`}
          aria-label="Close menu"
        >
          <XIcon size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <nav className="flex flex-col gap-0.5">
          {activeStudyHub === "theory-vault" ? <>
            <NavButton glass={isGlassEnabled} active={screen === "theory-dashboard"} onClick={() => nav("theory-dashboard")} icon={<LayoutDashboardIcon size={18} />} label="Dashboard" />
            <NavButton glass={isGlassEnabled} active={screen === "theory-browse"} onClick={() => nav("theory-browse")} icon={<LayersIcon size={18} />} label="Browse Questions" />
            <NavButton glass={isGlassEnabled} active={screen === "theory-bookmarks"} onClick={() => nav("theory-bookmarks")} icon={<TrophyIcon size={18} />} label="Bookmarks" />
            <NavButton glass={isGlassEnabled} active={screen === "theory-notes"} onClick={() => nav("theory-notes")} icon={<DatabaseIcon size={18} />} label="My Notes" />
            <NavButton glass={isGlassEnabled} active={screen === "theory-revision"} onClick={() => nav("theory-revision")} icon={<ActivityIcon size={18} />} label="Revision Queue" />
            <NavButton glass={isGlassEnabled} active={screen === "theory-progress"} onClick={() => nav("theory-progress")} icon={<TrophyIcon size={18} />} label="Progress" />
            <NavButton glass={isGlassEnabled} active={screen === "theory-search"} onClick={() => nav("theory-search")} icon={<DatabaseIcon size={18} />} label="Search" />
          </> : <>
          <NavButton glass={isGlassEnabled} active={screen === "dashboard"} onClick={() => nav("dashboard")} icon={<LayoutDashboardIcon size={18} />} label="Dashboard" />

          <div className={`my-1.5 h-px mx-1 ${dividerCls}`} />

          <NavButton glass={isGlassEnabled} active={screen === "modules"} onClick={() => nav("modules")} icon={<LayersIcon size={18} />} label="Study Modules" badge={String(getLiveModules().length)} />
          <NavButton glass={isGlassEnabled} active={screen === "weak-areas"} onClick={() => nav("weak-areas")} icon={<ActivityIcon size={18} />} label="Weak Areas" badge={weakCount > 0 ? String(weakCount) : undefined} />
          <NavButton glass={isGlassEnabled} active={screen === "live-assessments"} onClick={() => nav("live-assessments")} icon={<RadioIcon size={18} />} label="Live Assessments" liveDot={hasLiveAssessment} />
          <NavButton glass={isGlassEnabled} active={screen === "game"} onClick={() => nav("game")} icon={<GamepadIcon size={18} />} label="Game Mode" />
          <NavButton glass={isGlassEnabled} active={screen === "store"} onClick={() => nav("store")} icon={<StoreIcon size={18} />} label="Nexus Store" />
          <NavButton glass={isGlassEnabled} active={screen === "leaderboard"} onClick={() => nav("leaderboard")} icon={<TrophyIcon size={18} />} label="Leaderboard" />

          </>}
          {isAdmin && (
            <>
              <div className={`my-1.5 h-px mx-1 ${dividerCls}`} />
              {activeStudyHub === "mcq-qbank" && <>
                <NavButton glass={isGlassEnabled} active={screen === "question-editor"} onClick={() => nav("question-editor")} icon={<DatabaseIcon size={18} />} label="MCQ Editor" adminBadge="Admin" />
              </>}
              {activeStudyHub === "theory-vault" && <>
                <NavButton glass={isGlassEnabled} active={screen === "theory-editor"} onClick={() => nav("theory-editor")} icon={<LayersIcon size={18} />} label="Theory Editor" adminBadge="Admin" />
              </>}
              {activeStudyHub === "osce-hub" && <div className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/35" aria-disabled="true"><StethoscopeIcon size={18} /><span>OSCE Station Editor — Coming soon</span></div>}
              <NavButton glass={isGlassEnabled} active={screen === "user-management"} onClick={() => nav("user-management")} icon={<UsersIcon size={18} />} label="Users" adminBadge="Admin" />
              <NavButton glass={isGlassEnabled} active={screen === "broadcast"} onClick={() => nav("broadcast")} icon={<MegaphoneIcon size={18} />} label="Broadcast" adminBadge="Admin" />
            </>
          )}

        </nav>
      </div>

      <div className="shrink-0 flex flex-col gap-2 pt-2">
        {isAdmin ? (
          <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${cardCls}`}>
            <div className="flex items-center gap-2">
              <DatabaseIcon size={13} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Admin Mode</span>
            </div>
            <button
              type="button"
              onClick={logoutAdmin}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 transition-colors ${isGlassEnabled ? "glass-pill-hover" : "hover:bg-amber-500/20"}`}
            >
              Exit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors ${cardCls}`}
          >
            <DatabaseIcon size={13} />
            Admin Login
          </button>
        )}

        <button
          type="button"
          onClick={() => nav("profile")}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${cardCls} ${isGlassEnabled ? "hover:glass-pill-active" : "hover:bg-sidebar-accent"}`}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/90 text-sidebar-primary-foreground shadow-sm">
            <UserIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              {isAdmin && !user ? "Britechinc" : user?.name ?? "Clinician"}
            </p>
            <p className="text-[11px] text-sidebar-foreground/55">
              {isAdmin && !user
                ? "Administrator"
                : user?.role === "guest"
                  ? `Guest · ${cloudEnabled ? "☁ Synced" : "Local only"}`
                  : cloudEnabled ? "☁ Synced" : "Saving locally…"}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => { signOutUser(); if (isAdmin) logoutAdmin() }}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:text-destructive ${isGlassEnabled ? "glass-pill-hover" : "hover:bg-destructive/10"}`}
        >
          <LogOutIcon size={18} />
          Sign Out
        </button>
      </div>
    </div>
  )

  const collapsedContent = (
    <div className="flex h-full flex-col items-center gap-1 py-3 px-1.5">
      <button
        type="button"
        onClick={onExpand}
        className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors ${isGlassEnabled ? "glass-pill-hover" : "border border-sidebar-border hover:bg-sidebar-accent"}`}
        aria-label="Expand sidebar"
      >
        <ChevronLeftIcon size={16} className="rotate-180" />
      </button>

      <IconButton glass={isGlassEnabled} active={screen === "dashboard"} onClick={() => nav("dashboard")} label="Dashboard"><LayoutDashboardIcon size={18} /></IconButton>

      <div className={`my-2 w-6 h-px ${dividerCls}`} />

      <IconButton glass={isGlassEnabled} active={screen === "modules"} onClick={() => nav("modules")} label="Study Modules"><LayersIcon size={18} /></IconButton>
      <IconButton glass={isGlassEnabled} active={screen === "weak-areas"} onClick={() => nav("weak-areas")} label="Weak Areas"><ActivityIcon size={18} /></IconButton>
      <IconButton glass={isGlassEnabled} active={screen === "live-assessments"} onClick={() => nav("live-assessments")} label="Live Assessments" liveDot={hasLiveAssessment}><RadioIcon size={18} /></IconButton>
      <IconButton glass={isGlassEnabled} active={screen === "game"} onClick={() => nav("game")} label="Game Mode"><GamepadIcon size={18} /></IconButton>
      <IconButton glass={isGlassEnabled} active={screen === "store"} onClick={() => nav("store")} label="Nexus Store"><StoreIcon size={18} /></IconButton>
      <IconButton glass={isGlassEnabled} active={screen === "leaderboard"} onClick={() => nav("leaderboard")} label="Leaderboard"><TrophyIcon size={18} /></IconButton>

      {isAdmin && (
        <>
          <div className={`my-2 w-6 h-px ${dividerCls}`} />
          {activeStudyHub === "mcq-qbank" && <><IconButton glass={isGlassEnabled} active={screen === "question-editor"} onClick={() => nav("question-editor")} label="MCQ Editor"><DatabaseIcon size={18} /></IconButton></>}
          {activeStudyHub === "theory-vault" && <><IconButton glass={isGlassEnabled} active={screen === "theory-editor"} onClick={() => nav("theory-editor")} label="Theory Editor"><LayersIcon size={18} /></IconButton></>}
          <IconButton glass={isGlassEnabled} active={screen === "user-management"} onClick={() => nav("user-management")} label="Users"><UsersIcon size={18} /></IconButton>
          <IconButton glass={isGlassEnabled} active={screen === "broadcast"} onClick={() => nav("broadcast")} label="Broadcast"><MegaphoneIcon size={18} /></IconButton>
        </>
      )}

      <div className="mt-auto">
        <IconButton glass={isGlassEnabled} active={screen === "profile"} onClick={() => nav("profile")} label="Profile"><UserIcon size={18} /></IconButton>
      </div>
    </div>
  )

  return (
    <SidebarFrame collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={onCloseMobile} collapsedChildren={collapsedContent} glass={isGlassEnabled}>
      {fullContent}
    </SidebarFrame>
  )
}
