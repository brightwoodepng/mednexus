"use client"

/**
 * Cross-hub shell state. Providers are mounted once above this component in
 * `WorkspaceProviders`, so changing routes never recreates theme, account,
 * admin, notification, or workspace state.
 */
import { createContext, useContext, useState, type ReactNode } from "react"

type ShellState = {
  sidebarCollapsed: boolean
  setSidebarCollapsed: (value: boolean) => void
  mobileNavigationOpen: boolean
  setMobileNavigationOpen: (value: boolean) => void
  notificationOpen: boolean
  setNotificationOpen: (value: boolean) => void
  notificationUnreadCount: number
  setNotificationUnreadCount: (value: number) => void
}

const ShellContext = createContext<ShellState | undefined>(undefined)

export function AuthenticatedApplicationShell({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0)
  return <ShellContext.Provider value={{ sidebarCollapsed, setSidebarCollapsed, mobileNavigationOpen, setMobileNavigationOpen, notificationOpen, setNotificationOpen, notificationUnreadCount, setNotificationUnreadCount }}>{children}</ShellContext.Provider>
}

/** Shared responsive navigation state, intentionally retained across hub routes. */
export function useApplicationShell() {
  const context = useContext(ShellContext)
  if (!context) throw new Error("useApplicationShell must be used within AuthenticatedApplicationShell")
  return context
}
