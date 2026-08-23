"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { AppearanceModal } from "@/components/appearance-modal"
import { Sidebar } from "@/components/sidebar"
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
      mobileOpen={false}
      onCloseMobile={() => undefined}
      onReadyForQuiz={() => undefined}
      onSelectModule={() => undefined}
      collapsed={sidebarCollapsed}
      onCollapse={() => setSidebarCollapsed(true)}
      onExpand={() => setSidebarCollapsed(false)}
    />
    <div className="min-w-0 flex-1 md:overflow-y-auto">{children}</div>
    <AppearanceModal open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
  </div>
}
