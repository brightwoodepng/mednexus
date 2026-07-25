"use client"

import { useMemo } from "react"
import { User } from "lucide-react"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/contexts/theme-context"
import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon, StethoscopeIcon, LayoutDashboardIcon } from "@/components/icons"
import type { Screen } from "@/lib/view"
import { SidebarFrame, SidebarIconButton as IconButton, SidebarNavButton as NavButton } from "@/components/navigation/sidebar-primitives"
import { StudyHubDropdown, StudyHubDropdownIcon } from "@/components/navigation/study-hub-dropdown"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { getHubNavigation } from "@/components/navigation/study-hub-navigation"
import Link from "next/link"
import { canShowAdminConsoleLink } from "@/lib/admin-console-link"

interface SidebarProps { screen: Screen; onNavigate: (screen: Screen) => void; onOpenThemes: () => void; onOpenImporter?: () => void; mobileOpen: boolean; onCloseMobile: () => void; onReadyForQuiz: (config: { module: string; discipline: string | null }) => void; onSelectModule: (module: string) => void; collapsed: boolean; onCollapse: () => void; onExpand: () => void }

function roleLabel(role: string | undefined) {
  if (role === "admin") return "Admin"
  if (role === "user") return "Student"
  return "Guest"
}

function roleBadgeClass(role: string | undefined) {
  if (role === "admin") return "bg-amber-500/15 text-amber-600 border-amber-500/25"
  if (role === "user") return "bg-primary/10 text-primary border-primary/20"
  return "bg-muted text-muted-foreground border-border"
}

function UserAvatar({ name, size = "md" }: { name?: string; size?: "sm" | "md" }) {
  const initials = name
    ? name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase()
    : "G"
  const dim = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs"
  return (
    <span className={`${dim} flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground`}>
      {initials}
    </span>
  )
}

/** Desktop projection of the learner shell navigation. */
export function Sidebar({ screen, onNavigate, mobileOpen, onCloseMobile, collapsed, onCollapse, onExpand }: SidebarProps) {
  const { user, signOutUser } = useApp()
  const { isGlassEnabled } = useTheme()
  const { activeStudyHub, setActiveStudyHub } = useApplicationShell()
  const navigation = useMemo(() => getHubNavigation(activeStudyHub), [activeStudyHub])
  const nav = (next: Screen) => { onNavigate(next); onCloseMobile() }

  const firstName = user?.name?.split(" ")[0] ?? "Guest"

  const full = (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Brand header ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-sidebar-border px-4 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <StethoscopeIcon size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight tracking-tight text-sidebar-foreground">MedNexus</p>
            <p className="text-[10px] leading-tight tracking-wide text-sidebar-foreground/45">Clinical Q-Bank</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          className="hidden shrink-0 rounded-lg p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:flex"
        >
          <ChevronLeftIcon size={16} />
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-4">

        {/* Workspace switcher */}
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
          Workspace
        </p>
        <StudyHubDropdown
          activeHub={activeStudyHub}
          onSelect={setActiveStudyHub}
          onAfterSelect={onCloseMobile}
        />

        {/* Navigation items */}
        <p className="mb-1.5 mt-5 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
          Navigation
        </p>
        <div className="flex flex-col gap-0.5">
          {navigation.map((item) => {
            const Icon = item.id === "profile" ? User : item.icon
            return (
              <NavButton
                key={item.id}
                glass={isGlassEnabled}
                active={screen === item.screen}
                onClick={() => nav(item.screen)}
                icon={<Icon size={17} />}
                label={item.label}
              />
            )
          })}
        </div>

      </div>

      {/* ── User profile footer ── */}
      <div className="shrink-0 border-t border-sidebar-border p-3 space-y-1">
        {/* Profile card */}
        <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 bg-sidebar-accent/50">
          <UserAvatar name={user?.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-sidebar-foreground">{firstName}</p>
            <span className={`mt-0.5 inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-semibold leading-none ${roleBadgeClass(user?.role)}`}>
              {roleLabel(user?.role)}
            </span>
          </div>
          <button
            type="button"
            onClick={signOutUser}
            aria-label="Sign out"
            className="shrink-0 rounded-lg p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOutIcon size={15} />
          </button>
        </div>

        {/* Admin console link */}
        {canShowAdminConsoleLink(user) && (
          <Link
            href="/admin"
            onClick={onCloseMobile}
            className="flex min-h-9 items-center gap-2.5 rounded-xl px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <LayoutDashboardIcon size={14} />
            Admin Console
          </Link>
        )}
      </div>

    </div>
  )

  const compact = (
    <div className="flex h-full w-full flex-col items-center gap-1 py-3">
      <button
        type="button"
        onClick={onExpand}
        aria-label="Expand sidebar"
        className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <ChevronRightIcon size={16} />
      </button>
      <StudyHubDropdownIcon activeHub={activeStudyHub} onSelect={setActiveStudyHub} />
      <div className="my-1 h-px w-6 bg-sidebar-border/60" />
      {navigation.map((item) => {
        const Icon = item.id === "profile" ? User : item.icon
        return (
          <IconButton key={item.id} glass={isGlassEnabled} active={screen === item.screen} onClick={() => nav(item.screen)} label={item.label}>
            <Icon size={18} />
          </IconButton>
        )
      })}
      {/* User avatar at bottom of compact rail */}
      <div className="mt-auto flex flex-col items-center gap-2 pb-1">
        <div className="h-px w-6 bg-sidebar-border/60" />
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand sidebar to see profile"
          className="transition-opacity hover:opacity-80"
        >
          <UserAvatar name={user?.name} size="sm" />
        </button>
      </div>
    </div>
  )

  return (
    <SidebarFrame
      collapsed={collapsed}
      mobileOpen={mobileOpen}
      onCloseMobile={onCloseMobile}
      collapsedChildren={compact}
      glass={isGlassEnabled}
    >
      {full}
    </SidebarFrame>
  )
}
