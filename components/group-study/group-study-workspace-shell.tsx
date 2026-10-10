"use client"

import { type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Users } from "lucide-react"
import { AppearanceModal } from "@/components/appearance-modal"
import { LearnerHeaderActions } from "@/components/learner-header-actions"
import { Sidebar } from "@/components/sidebar"
import { MenuIcon } from "@/components/icons"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { learnerHomeScreen, learnerScreenUrl } from "@/lib/admin-hub-routing"
import type { Screen } from "@/lib/view"
import type { StudyHubId } from "@/components/study-hub-switcher"

/** Keeps Group Study inside the learner workspace on wider screens while
 * preserving its focused, standalone phone layout. */
export function GroupStudyWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const {
    activeStudyHub,
    setActiveStudyHub,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavigationOpen,
    setMobileNavigationOpen,
    appearanceOpen,
    setAppearanceOpen,
  } = useApplicationShell()

  const navigate = (screen: Screen) => router.push(learnerScreenUrl(screen, activeStudyHub))
  const selectHub = (hub: StudyHubId) => {
    setActiveStudyHub(hub)
    router.push(learnerScreenUrl(learnerHomeScreen(hub), hub))
  }

  return <div className="md:flex md:h-screen md:overflow-hidden">
    <Sidebar
      screen="dashboard"
      onNavigate={navigate}
      onSelectStudyHub={selectHub}
      onOpenThemes={() => setAppearanceOpen(true)}
      mobileOpen={mobileNavigationOpen}
      onCloseMobile={() => setMobileNavigationOpen(false)}
      onReadyForQuiz={() => undefined}
      onSelectModule={() => undefined}
      collapsed={sidebarCollapsed}
      onCollapse={() => setSidebarCollapsed(true)}
      onExpand={() => setSidebarCollapsed(false)}
    />
    <div className="min-w-0 flex-1 md:overflow-y-auto">
      <header className="sticky top-0 z-50 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card/95 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <button type="button" onClick={() => setMobileNavigationOpen(true)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted md:hidden" aria-label="Open navigation menu"><MenuIcon size={20}/></button>
          <span className="flex min-w-0 items-center gap-2 md:hidden"><Users size={20} className="shrink-0 text-primary"/><span className="truncate text-lg font-black tracking-tight">Group Study</span></span>
        </div>
        <LearnerHeaderActions onNavigate={navigate} onOpenAppearance={() => setAppearanceOpen(true)} />
      </header>
      {children}
    </div>
    <AppearanceModal open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
  </div>
}
