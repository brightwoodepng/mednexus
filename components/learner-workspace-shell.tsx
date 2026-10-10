"use client"

import { type ReactNode, useEffect, useRef } from "react"
import { LayoutDashboardIcon, LogOutIcon, MenuIcon, StethoscopeIcon, UserIcon } from "@/components/icons"
import Link from "next/link"
import { NotificationBell } from "@/components/notification-bell"
import { Sidebar } from "@/components/sidebar"
import { BottomNav } from "@/components/bottom-nav"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { useApp } from "@/contexts/app-context"
import type { Screen } from "@/lib/view"
import type { StudyHubId } from "@/components/study-hub-switcher"
import { canShowAdminConsoleLink } from "@/lib/admin-console-link"

/**
 * The reusable learner chrome for every study workspace. It intentionally owns
 * only learner affordances; editorial and platform controls live in AdminShell.
 */
export function LearnerWorkspaceShell({
  screen,
  onNavigate,
  onSelectStudyHub,
  onOpenAppearance,
  modeControl,
  headerSlot,
  hideBottomNavigation = false,
  children,
}: {
  screen: Screen
  onNavigate: (screen: Screen) => void
  onSelectStudyHub: (hub: StudyHubId) => void
  onOpenAppearance: () => void
  modeControl?: ReactNode
  headerSlot?: ReactNode
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
    accountMenuOpen: accountOpen,
    setAccountMenuOpen: setAccountOpen,
    setNotificationOpen,
  } = useApplicationShell()
  const accountRef = useRef<HTMLDivElement>(null)
  const accountName = user?.name || "Guest"
  const accountRole = user?.serverRole === "SUPER_ADMIN" ? "Super admin" : user?.serverRole === "ADMIN" ? "Admin" : user?.role === "user" ? "Student" : "Guest"
  const initials = accountName.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase()

  useEffect(() => {
    if (!accountOpen) return
    const close = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [accountOpen, setAccountOpen])

  const navigate = (next: Screen) => {
    setNotificationOpen(false)
    onNavigate(next)
    setMobileNavigationOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        screen={screen}
        onNavigate={navigate}
        onSelectStudyHub={onSelectStudyHub}
        onOpenThemes={onOpenAppearance}
        mobileOpen={mobileNavigationOpen}
        onCloseMobile={() => setMobileNavigationOpen(false)}
        onReadyForQuiz={() => undefined}
        onSelectModule={() => undefined}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(true)}
        onExpand={() => setSidebarCollapsed(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex min-h-14 flex-wrap items-center justify-between gap-y-2 border-b border-border bg-card px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button data-tutorial-anchor="mobile-menu-button" type="button" onClick={() => setMobileNavigationOpen(true)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted md:hidden" aria-label="Open navigation menu"><MenuIcon size={20} /></button>
            <div className="min-w-0 flex-1" data-tutorial-anchor="header-workspace-identity">{headerSlot}</div>
          </div>
          {modeControl && <div className="order-last flex w-full justify-end md:order-none md:w-auto">{modeControl}</div>}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div ref={accountRef} className="relative" data-tutorial-anchor="header-account-menu">
              <button type="button" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen} aria-haspopup="menu" aria-label="Open account menu" title={accountName + " · " + accountRole} className="flex h-10 min-w-0 items-center gap-2 rounded-full bg-muted/60 p-1.5 pr-3 text-left transition-colors hover:bg-muted">
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{initials}</span>
                <span className="min-w-0 max-w-[5.5rem] sm:max-w-36"><span className="block truncate text-xs font-semibold leading-tight">{accountName}</span><span className="block truncate text-[9px] leading-tight text-muted-foreground">{accountRole}</span></span>
              </button>
              {accountOpen && <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                <button type="button" role="menuitem" onClick={() => { navigate("profile"); setAccountOpen(false) }} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold hover:bg-muted"><UserIcon size={16} />Profile & account</button>
                {canShowAdminConsoleLink(user) && <div className="my-1 border-t border-border pt-1" aria-label="Account management">
                  <Link role="menuitem" href="/admin" onClick={() => setAccountOpen(false)} className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10"><LayoutDashboardIcon size={16} />Open Admin Console</Link>
                </div>}
                <button type="button" role="menuitem" onClick={signOutUser} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10"><LogOutIcon size={16} />Sign out</button>
              </div>}
            </div>
            <button data-tutorial-anchor="header-appearance" type="button" onClick={onOpenAppearance} className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-muted" aria-label="Appearance"><span aria-hidden="true">🎨</span></button>
            <div data-tutorial-anchor="header-notifications"><NotificationBell borderless /></div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:p-5 md:pb-5 lg:p-8 lg:pb-8">{children}</main>
      </div>

      <BottomNav screen={screen} activeHub={activeStudyHub} onNavigate={navigate} hidden={hideBottomNavigation || mobileNavigationOpen} />

    </div>
  )
}
