"use client"

import { useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/contexts/theme-context"
import { ChevronLeftIcon, ChevronRightIcon, LogOutIcon, StethoscopeIcon } from "@/components/icons"
import type { Screen } from "@/lib/view"
import { SidebarFrame, SidebarIconButton as IconButton, SidebarNavButton as NavButton } from "@/components/navigation/sidebar-primitives"
import { StudyHubDropdown, StudyHubDropdownIcon } from "@/components/navigation/study-hub-dropdown"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { getHubNavigation } from "@/components/navigation/study-hub-navigation"

interface SidebarProps { screen: Screen; onNavigate: (screen: Screen) => void; onOpenThemes: () => void; onOpenImporter?: () => void; mobileOpen: boolean; onCloseMobile: () => void; onReadyForQuiz: (config: { module: string; discipline: string | null }) => void; onSelectModule: (module: string) => void; collapsed: boolean; onCollapse: () => void; onExpand: () => void }

/** Desktop projection of the learner shell navigation. */
export function Sidebar({ screen, onNavigate, mobileOpen, onCloseMobile, collapsed, onCollapse, onExpand }: SidebarProps) {
  const { signOutUser } = useApp()
  const { isGlassEnabled } = useTheme()
  const { activeStudyHub, setActiveStudyHub } = useApplicationShell()
  const navigation = useMemo(() => getHubNavigation(activeStudyHub), [activeStudyHub])
  const nav = (next: Screen) => { onNavigate(next); onCloseMobile() }

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
            const Icon = item.icon
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

      {/* ── Footer ── */}
      <div className="shrink-0 border-t border-sidebar-border px-3 py-2">
        <button
          type="button"
          onClick={signOutUser}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOutIcon size={16} />
          Sign out
        </button>
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
        const Icon = item.icon
        return (
          <IconButton key={item.id} glass={isGlassEnabled} active={screen === item.screen} onClick={() => nav(item.screen)} label={item.label}>
            <Icon size={18} />
          </IconButton>
        )
      })}
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
