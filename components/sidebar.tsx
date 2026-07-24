"use client"

import { useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/contexts/theme-context"
import { ChevronRightIcon, LogOutIcon } from "@/components/icons"
import type { Screen } from "@/lib/view"
import { SidebarFrame, SidebarHeader, SidebarIconButton as IconButton, SidebarNavButton as NavButton } from "@/components/navigation/sidebar-primitives"
import { StudyHubDropdown, StudyHubDropdownIcon } from "@/components/navigation/study-hub-dropdown"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { getHubNavigation } from "@/components/navigation/study-hub-navigation"

interface SidebarProps { screen: Screen; onNavigate: (screen: Screen) => void; onOpenThemes: () => void; onOpenImporter?: () => void; mobileOpen: boolean; onCloseMobile: () => void; onReadyForQuiz: (config: { module: string; discipline: string | null }) => void; onSelectModule: (module: string) => void; collapsed: boolean; onCollapse: () => void; onExpand: () => void }

/** Desktop projection of the learner shell navigation. It has no admin controls. */
export function Sidebar({ screen, onNavigate, mobileOpen, onCloseMobile, collapsed, onCollapse, onExpand }: SidebarProps) {
  const { signOutUser } = useApp()
  const { isGlassEnabled } = useTheme()
  const { activeStudyHub, setActiveStudyHub } = useApplicationShell()
  const navigation = useMemo(() => getHubNavigation(activeStudyHub), [activeStudyHub])
  const nav = (next: Screen) => { onNavigate(next); onCloseMobile() }

  const account = (
    <div className="border-t border-sidebar-border pt-2">
      <button
        type="button"
        onClick={signOutUser}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <LogOutIcon size={17} />
        Sign out
      </button>
    </div>
  )

  const full = (
    <div className="flex h-full flex-col overflow-hidden p-4">
      <SidebarHeader onCollapse={onCollapse} onCloseMobile={onCloseMobile} />
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <StudyHubDropdown activeHub={activeStudyHub} onSelect={setActiveStudyHub} onAfterSelect={onCloseMobile} />
        <nav className="mt-1 min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-0.5 pt-1">
            {navigation.map((item) => {
              const Icon = item.icon
              return (
                <NavButton
                  key={item.id}
                  glass={isGlassEnabled}
                  active={screen === item.screen}
                  onClick={() => nav(item.screen)}
                  icon={<Icon size={18} />}
                  label={item.label}
                />
              )
            })}
          </div>
        </nav>
      </div>
      {account}
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

  return <SidebarFrame collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={onCloseMobile} collapsedChildren={compact} glass={isGlassEnabled}>{full}</SidebarFrame>
}
