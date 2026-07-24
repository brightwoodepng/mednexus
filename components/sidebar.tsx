"use client"

import { useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/contexts/theme-context"
import { ChevronRightIcon, LogOutIcon, PaletteIcon, UserIcon } from "@/components/icons"
import type { Screen } from "@/lib/view"
import { SidebarFrame, SidebarHeader, SidebarIconButton as IconButton, SidebarNavButton as NavButton } from "@/components/navigation/sidebar-primitives"
import { StudyHubDropdown, StudyHubDropdownIcon } from "@/components/navigation/study-hub-dropdown"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { getHubNavigation, PROFILE_NAVIGATION_ITEM } from "@/components/navigation/study-hub-navigation"

interface SidebarProps { screen: Screen; onNavigate: (screen: Screen) => void; onOpenThemes: () => void; onOpenImporter?: () => void; mobileOpen: boolean; onCloseMobile: () => void; onReadyForQuiz: (config: { module: string; discipline: string | null }) => void; onSelectModule: (module: string) => void; collapsed: boolean; onCollapse: () => void; onExpand: () => void }

/** Desktop projection of the learner shell navigation. It has no admin controls. */
export function Sidebar({ screen, onNavigate, onOpenThemes, mobileOpen, onCloseMobile, collapsed, onCollapse, onExpand }: SidebarProps) {
  const { user, signOutUser } = useApp()
  const { isGlassEnabled } = useTheme()
  const { activeStudyHub, setActiveStudyHub } = useApplicationShell()
  const navigation = useMemo(() => getHubNavigation(activeStudyHub), [activeStudyHub])
  const nav = (next: Screen) => { onNavigate(next); onCloseMobile() }
  const account = <div className="mt-auto border-t border-sidebar-border pt-3"><button type="button" onClick={() => nav("profile")} className="flex min-h-11 w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sidebar-accent"><UserIcon size={18} /><span className="flex-1 truncate text-sm font-semibold">{user?.name ?? "Clinician"}</span></button><button type="button" onClick={() => { onOpenThemes(); onCloseMobile() }} className="flex min-h-11 w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sidebar-accent"><PaletteIcon size={17} />Appearance</button><button type="button" onClick={signOutUser} className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl p-2 text-sm hover:bg-destructive/10"><LogOutIcon size={17} />Sign out</button></div>
  const full = <div className="flex h-full flex-col gap-2 overflow-hidden p-4"><SidebarHeader onCollapse={onCollapse} onCloseMobile={onCloseMobile} /><StudyHubDropdown activeHub={activeStudyHub} onSelect={setActiveStudyHub} onAfterSelect={onCloseMobile} /><nav className="min-h-0 flex-1 overflow-y-auto">{navigation.map((item) => { const Icon = item.icon; return <NavButton key={item.id} glass={isGlassEnabled} active={screen === item.screen} onClick={() => nav(item.screen)} icon={<Icon size={18} />} label={item.label} /> })}</nav>{account}</div>
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
      <div className="mt-auto">
        <IconButton glass={isGlassEnabled} active={screen === PROFILE_NAVIGATION_ITEM.screen} onClick={() => nav("profile")} label="Profile">
          <UserIcon size={18} />
        </IconButton>
      </div>
    </div>
  )
  return <SidebarFrame collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={onCloseMobile} collapsedChildren={compact} glass={isGlassEnabled}>{full}</SidebarFrame>
}
