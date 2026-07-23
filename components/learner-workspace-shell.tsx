"use client"

import { type ReactNode, useEffect, useRef, useState } from "react"
import { LogOutIcon, MenuIcon, PaletteIcon, StethoscopeIcon, UserIcon, XIcon } from "@/components/icons"
import { NotificationBell } from "@/components/notification-bell"
import { Sidebar } from "@/components/sidebar"
import { BottomNav } from "@/components/bottom-nav"
import { StudyHubDropdown } from "@/components/navigation/study-hub-dropdown"
import { getHubNavigation, PROFILE_NAVIGATION_ITEM } from "@/components/navigation/study-hub-navigation"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { useApp } from "@/contexts/app-context"
import type { Screen } from "@/lib/view"

/**
 * The reusable learner chrome for every study workspace. It intentionally owns
 * only learner affordances; editorial and platform controls live in AdminShell.
 */
export function LearnerWorkspaceShell({
  screen,
  onNavigate,
  onOpenAppearance,
  modeControl,
  hideBottomNavigation = false,
  children,
}: {
  screen: Screen
  onNavigate: (screen: Screen) => void
  onOpenAppearance: () => void
  modeControl?: ReactNode
  hideBottomNavigation?: boolean
  children: ReactNode
}) {
  const { user, signOutUser } = useApp()
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavigationOpen,
    setMobileNavigationOpen,
    activeStudyHub,
    setActiveStudyHub,
  } = useApplicationShell()
  const [accountOpen, setAccountOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!accountOpen) return
    const close = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [accountOpen])

  const navigate = (next: Screen) => {
    onNavigate(next)
    setMobileNavigationOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        screen={screen}
        onNavigate={navigate}
        onOpenThemes={onOpenAppearance}
        mobileOpen={false}
        onCloseMobile={() => setMobileNavigationOpen(false)}
        onReadyForQuiz={() => undefined}
        onSelectModule={() => undefined}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(true)}
        onExpand={() => setSidebarCollapsed(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 items-center justify-between border-b border-border bg-card px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <button type="button" onClick={() => setMobileNavigationOpen(true)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted md:hidden" aria-label="Open navigation menu"><MenuIcon size={20} /></button>
            <button type="button" onClick={() => navigate("dashboard")} className="hidden items-center gap-2 text-left md:flex" aria-label="MedNexus dashboard">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><StethoscopeIcon size={17} /></span>
              <span className="text-sm font-bold tracking-tight text-foreground">MedNexus</span>
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {modeControl}
            <button type="button" onClick={onOpenAppearance} className="hidden items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted md:flex" aria-label="Appearance"><PaletteIcon size={19} /></button>
            <NotificationBell />
            <div ref={accountRef} className="relative">
              <button type="button" onClick={() => setAccountOpen((open) => !open)} aria-expanded={accountOpen} aria-haspopup="menu" aria-label="Open account menu" className="flex h-9 min-w-9 items-center justify-center rounded-full bg-primary/10 px-2 text-primary transition-colors hover:bg-primary/15">
                <UserIcon size={18} />
                <span className="ml-1 hidden max-w-28 truncate text-xs font-semibold sm:inline">{user?.name ?? "Account"}</span>
              </button>
              {accountOpen && <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                <button type="button" role="menuitem" onClick={() => { navigate("profile"); setAccountOpen(false) }} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold hover:bg-muted"><UserIcon size={16} />Profile & account</button>
                <button type="button" role="menuitem" onClick={signOutUser} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10"><LogOutIcon size={16} />Sign out</button>
              </div>}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-3 pb-24 md:p-5 lg:p-8" onClick={() => { if (!sidebarCollapsed) setSidebarCollapsed(true) }}>{children}</main>
      </div>

      <BottomNav screen={screen} activeHub={activeStudyHub} onNavigate={navigate} hidden={hideBottomNavigation} />

      {mobileNavigationOpen && <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Learner navigation">
        <button type="button" aria-label="Close navigation menu" onClick={() => setMobileNavigationOpen(false)} className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
        <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5"><div className="flex items-center gap-2"><StethoscopeIcon size={16} className="text-primary" /><span className="text-sm font-bold tracking-tight">MedNexus</span></div><button type="button" onClick={() => setMobileNavigationOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close navigation menu"><XIcon size={18} /></button></div>
          <div className="flex-1 overflow-y-auto p-3"><StudyHubDropdown activeHub={activeStudyHub} onSelect={setActiveStudyHub} onAfterSelect={() => setMobileNavigationOpen(false)} /><p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workspace</p>{getHubNavigation(activeStudyHub).map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => navigate(item.screen)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-muted"><Icon size={17} className="text-primary" />{item.label}</button> })}<button type="button" onClick={() => navigate(PROFILE_NAVIGATION_ITEM.screen)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-muted"><UserIcon size={17} className="text-primary" />Profile</button></div>
          <div className="border-t border-border p-3"><button type="button" onClick={() => { onOpenAppearance(); setMobileNavigationOpen(false) }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-muted"><PaletteIcon size={17} />Appearance</button><button type="button" onClick={signOutUser} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-destructive hover:bg-destructive/10"><LogOutIcon size={17} />Sign out</button></div>
        </aside>
      </div>}
    </div>
  )
}
