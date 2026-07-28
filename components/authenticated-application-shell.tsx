"use client"

/**
 * Cross-hub shell state. Providers are mounted once above this component in
 * `WorkspaceProviders`, so changing routes never recreates theme, account,
 * admin, notification, or workspace state.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { studyHubFromUrl, withHubContext } from "@/lib/admin-hub-routing"
import type { StudyHubId } from "@/components/study-hub-switcher"

type ShellState = {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (value: boolean) => void
  mobileNavigationOpen: boolean
  setMobileNavigationOpen: (value: boolean) => void
  workspaceSwitcherOpen: boolean
  setWorkspaceSwitcherOpen: (value: boolean) => void
  accountMenuOpen: boolean
  setAccountMenuOpen: (value: boolean) => void
  appearanceOpen: boolean
  setAppearanceOpen: (value: boolean) => void
  notificationOpen: boolean
  setNotificationOpen: (value: boolean) => void
  notificationUnreadCount: number
  setNotificationUnreadCount: (value: number) => void
  activeStudyHub: StudyHubId
  setActiveStudyHub: (hub: StudyHubId) => void
}

const ShellContext = createContext<ShellState | undefined>(undefined)

export function AuthenticatedApplicationShell({ children }: { children: ReactNode }) {
  // A desktop learner workspace should begin with its full navigation visible.
  // The compact rail is an intentional desktop choice, not the default mobile
  // presentation leaking into wider layouts.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  // This state is product navigation, not MCQ quiz mode.
  const [activeStudyHub, setActiveStudyHubState] = useState<StudyHubId>(() => studyHubFromUrl())
  const setActiveStudyHub = useCallback((hub: StudyHubId) => {
    setActiveStudyHubState(hub)
    // Hub context is URL-backed so shared tools survive refreshes, deep links and new tabs.
    window.history.replaceState(window.history.state, "", withHubContext(window.location.pathname, hub))
  }, [])
  return <ShellContext.Provider value={{ sidebarCollapsed, setSidebarCollapsed, mobileNavigationOpen, setMobileNavigationOpen, workspaceSwitcherOpen, setWorkspaceSwitcherOpen, accountMenuOpen, setAccountMenuOpen, appearanceOpen, setAppearanceOpen, notificationOpen, setNotificationOpen, notificationUnreadCount, setNotificationUnreadCount, activeStudyHub, setActiveStudyHub }}>{children}</ShellContext.Provider>
}

/** Shared responsive navigation state, intentionally retained across hub routes. */
export function useApplicationShell() {
  const context = useContext(ShellContext)
  if (!context) throw new Error("useApplicationShell must be used within AuthenticatedApplicationShell")
  return context
}
