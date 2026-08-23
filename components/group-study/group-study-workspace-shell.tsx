"use client"

import { type ReactNode, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Users } from "lucide-react"
import { AppearanceModal } from "@/components/appearance-modal"
import { NotificationBell } from "@/components/notification-bell"
import { Sidebar } from "@/components/sidebar"
import { LayoutDashboardIcon, LogOutIcon, MenuIcon, PaletteIcon, UserIcon } from "@/components/icons"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { useApp } from "@/contexts/app-context"
import { learnerHomeScreen, learnerScreenUrl } from "@/lib/admin-hub-routing"
import { canShowAdminConsoleLink } from "@/lib/admin-console-link"
import type { Screen } from "@/lib/view"
import type { StudyHubId } from "@/components/study-hub-switcher"

/** Keeps Group Study inside the learner workspace on wider screens while
 * preserving its focused, standalone phone layout. */
export function GroupStudyWorkspaceShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { user, signOutUser } = useApp()
  const accountRef = useRef<HTMLDivElement>(null)
  const {
    activeStudyHub,
    setActiveStudyHub,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavigationOpen,
    setMobileNavigationOpen,
    appearanceOpen,
    setAppearanceOpen,
    accountMenuOpen,
    setAccountMenuOpen,
  } = useApplicationShell()

  useEffect(() => {
    if (!accountMenuOpen) return
    const close = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountMenuOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [accountMenuOpen, setAccountMenuOpen])

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
        <div className="flex min-w-0 items-center gap-2.5">
          <button type="button" onClick={() => setMobileNavigationOpen(true)} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted md:hidden" aria-label="Open navigation menu"><MenuIcon size={20}/></button>
          <Users size={18} className="shrink-0 text-primary"/><span className="truncate text-sm font-bold sm:text-base">Group Study</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={() => setAppearanceOpen(true)} className="hidden items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted md:flex" aria-label="Appearance"><PaletteIcon size={19}/></button>
          <NotificationBell />
          <div ref={accountRef} className="relative">
            <button type="button" onClick={() => setAccountMenuOpen(!accountMenuOpen)} aria-expanded={accountMenuOpen} aria-haspopup="menu" aria-label="Open account menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"><UserIcon size={18}/></button>
            {accountMenuOpen && <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">
              <button type="button" role="menuitem" onClick={() => { router.push(learnerScreenUrl("profile", activeStudyHub)); setAccountMenuOpen(false) }} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold hover:bg-muted"><UserIcon size={16}/>Profile & account</button>
              {canShowAdminConsoleLink(user) && <div className="my-1 border-t border-border pt-1"><Link role="menuitem" href="/admin" onClick={() => setAccountMenuOpen(false)} className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10"><LayoutDashboardIcon size={16}/>Open Admin Console</Link></div>}
              <button type="button" role="menuitem" onClick={signOutUser} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10"><LogOutIcon size={16}/>Sign out</button>
            </div>}
          </div>
        </div>
      </header>
      {children}
    </div>
    <AppearanceModal open={appearanceOpen} onClose={() => setAppearanceOpen(false)} />
  </div>
}
