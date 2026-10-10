"use client"

import { type ReactNode } from "react"
import { MenuIcon } from "@/components/icons"
import { LearnerHeaderActions } from "@/components/learner-header-actions"
import { Sidebar } from "@/components/sidebar"
import { BottomNav } from "@/components/bottom-nav"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import type { Screen } from "@/lib/view"
import type { StudyHubId } from "@/components/study-hub-switcher"

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
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavigationOpen,
    setMobileNavigationOpen,
    activeStudyHub,
    setNotificationOpen,
  } = useApplicationShell()
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
          <LearnerHeaderActions onNavigate={navigate} onOpenAppearance={onOpenAppearance} />
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:p-5 md:pb-5 lg:p-8 lg:pb-8">{children}</main>
      </div>

      <BottomNav screen={screen} activeHub={activeStudyHub} onNavigate={navigate} hidden={hideBottomNavigation || mobileNavigationOpen} />

    </div>
  )
}
