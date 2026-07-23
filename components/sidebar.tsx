"use client"
import { useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/contexts/theme-context"
import { LogOutIcon, UserIcon, ChevronLeftIcon } from "@/components/icons"
import type { Screen } from "@/lib/view"
import { SidebarFrame, SidebarIconButton as IconButton, SidebarNavButton as NavButton } from "@/components/navigation/sidebar-primitives"
import { StudyHubDropdown } from "@/components/navigation/study-hub-dropdown"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { getHubNavigation, PROFILE_NAVIGATION_ITEM } from "@/components/navigation/study-hub-navigation"
interface SidebarProps { screen: Screen; onNavigate: (screen: Screen) => void; onOpenThemes: () => void; onOpenImporter?: () => void; mobileOpen: boolean; onCloseMobile: () => void; onReadyForQuiz: (config: { module: string; discipline: string | null }) => void; onSelectModule: (module: string) => void; collapsed: boolean; onCollapse: () => void; onExpand: () => void }
export function Sidebar({screen,onNavigate,mobileOpen,onCloseMobile,collapsed,onCollapse,onExpand}: SidebarProps) {
 const {user,cloudEnabled,signOutUser}=useApp(); const {isGlassEnabled}=useTheme(); const {activeStudyHub,setActiveStudyHub}=useApplicationShell(); const nav=(s:Screen)=>{onNavigate(s);onCloseMobile()}; const navigation=useMemo(()=>getHubNavigation(activeStudyHub),[activeStudyHub]); const canAdmin=Boolean(user?.canAccessAdmin)
 const account=<div className="mt-auto border-t border-sidebar-border pt-3"><button onClick={()=>nav("profile")} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sidebar-accent"><UserIcon size={18}/><span className="flex-1 text-sm font-semibold">{user?.name ?? "Clinician"}</span></button>{canAdmin && <a href="/admin" className="mt-1 flex rounded-xl bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">Open Admin Console</a>}<button onClick={signOutUser} className="mt-1 flex w-full items-center gap-2 rounded-xl p-2 text-sm hover:bg-destructive/10"><LogOutIcon size={17}/>Sign Out</button></div>
 const full=<div className="flex h-full flex-col gap-2 p-4"><StudyHubDropdown activeHub={activeStudyHub} onSelect={setActiveStudyHub} onAfterSelect={onCloseMobile}/><nav className="flex-1">{navigation.map(i=>{const I=i.icon;return <NavButton key={i.id} glass={isGlassEnabled} active={screen===i.screen} onClick={()=>nav(i.screen)} icon={<I size={18}/>} label={i.label}/>})}</nav>{account}</div>
 const compact=<div className="flex h-full flex-col items-center gap-2 py-3"><button onClick={onExpand}><ChevronLeftIcon size={18} className="rotate-180"/></button>{navigation.map(i=>{const I=i.icon;return <IconButton key={i.id} glass={isGlassEnabled} active={screen===i.screen} onClick={()=>nav(i.screen)} label={i.label}><I size={18}/></IconButton>})}<div className="mt-auto"><IconButton glass={isGlassEnabled} active={screen===PROFILE_NAVIGATION_ITEM.screen} onClick={()=>nav("profile")} label="Profile"><UserIcon size={18}/></IconButton></div></div>
 return <SidebarFrame collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={onCloseMobile} collapsedChildren={compact} glass={isGlassEnabled}>{full}</SidebarFrame>
}
