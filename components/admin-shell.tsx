"use client"

import Link from "next/link"
import {
  ArrowLeft, BarChart3, Bell, BookOpen, ClipboardCheck, Database, FileOutput,
  LayoutDashboard, Menu, Moon, Search, Settings, ShieldCheck, Sun, Users, Waypoints,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { StethoscopeIcon } from "@/components/icons"
import { SidebarCollapsedRail, SidebarFrame, SidebarGroup, SidebarNavLink } from "@/components/navigation/sidebar-primitives"

type Capability = "mcq" | "assessments" | "users" | "system" | "broadcasts"
type AdminShellProps = { capabilities: Record<Capability, boolean>; children: React.ReactNode }
type NavigationItem = { href?: string; label: string; icon: React.ComponentType<{ size?: number }>; capability?: Capability; soon?: boolean }

const groups: Array<{ label?: string; items: NavigationItem[] }> = [
  { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Content Management", items: [
    { href: "/admin/mcq", label: "MCQ Bank", icon: BookOpen, capability: "mcq" },
    { label: "Theory Vault", icon: BookOpen, soon: true },
    { label: "OSCE Simulator", icon: ClipboardCheck, soon: true },
  ] },
  { label: "Assessments", items: [
    { href: "/admin/assessments", label: "Live Assessments", icon: ClipboardCheck, capability: "assessments" },
    { href: "/admin/results", label: "Assessment Results", icon: BarChart3, capability: "assessments" },
  ] },
  { label: "User Management", items: [
    { href: "/admin/users", label: "Users", icon: Users, capability: "users" },
    { href: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, capability: "system" },
  ] },
  { label: "System", items: [
    { href: "/admin/modules", label: "Modules & Disciplines", icon: Waypoints, capability: "mcq" },
    { href: "/admin/imports-exports", label: "Imports & Exports", icon: FileOutput, capability: "mcq" },
    { href: "/admin/notifications", label: "Notifications", icon: Bell, capability: "broadcasts" },
    { href: "/admin/settings", label: "System Settings", icon: Settings, capability: "system" },
    { href: "/admin/system/question-bank", label: "Question Bank Source", icon: Database, capability: "system" },
  ] },
]

// ─── Dark-mode toggle (persists to localStorage, applies data-theme on <html>) ─

function useDarkMode() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("admin-dark")
    const isDark = stored === "true"
    setDark(isDark)
    if (isDark) document.documentElement.setAttribute("data-theme", "classic-dark")
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    localStorage.setItem("admin-dark", String(next))
    if (next) {
      document.documentElement.setAttribute("data-theme", "classic-dark")
    } else {
      // Restore whatever the learner-side theme was, or remove attribute for default
      const learnerTheme = localStorage.getItem("mednexus-theme")
      if (learnerTheme) {
        document.documentElement.setAttribute("data-theme", learnerTheme)
      } else {
        document.documentElement.removeAttribute("data-theme")
      }
    }
  }

  return { dark, toggle }
}

// ─── Header ────────────────────────────────────────────────────────────────────

function AdminHeader({
  onOpenMobile,
  pendingCount,
}: {
  onOpenMobile: () => void
  pendingCount?: number
}) {
  const { dark, toggle } = useDarkMode()
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  return (
    <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-5">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={onOpenMobile}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:hidden"
        aria-label="Open admin navigation"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="relative flex flex-1 max-w-sm items-center">
        <Search size={14} className="absolute left-3 text-muted-foreground pointer-events-none" aria-hidden />
        <input
          type="search"
          placeholder="Search questions, users, modules…"
          className="h-9 w-full rounded-lg border border-border bg-muted/50 pl-8 pr-16 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
          aria-label="Admin search"
        />
        <kbd className="pointer-events-none absolute right-3 hidden select-none rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:block">
          Ctrl K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Notification bell */}
        <Link
          href="/admin/users"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={pendingCount ? `${pendingCount} pending approvals` : "Notifications"}
        >
          <Bell size={18} />
          {!!pendingCount && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </Link>

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Date */}
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground sm:flex whitespace-nowrap">
          <span className="font-medium text-foreground">{today}</span>
        </div>
      </div>
    </header>
  )
}

// ─── Shell ─────────────────────────────────────────────────────────────────────

export function AdminShell({ capabilities, children }: AdminShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  const navigation = (
    <nav aria-label="Admin navigation" className="flex flex-col gap-5">
      {groups.map((group) => (
        <SidebarGroup key={group.label ?? "dashboard"} label={group.label}>
          {group.items.map((item) => {
            if (item.soon) {
              return (
                <span
                  key={item.label}
                  aria-disabled="true"
                  className="flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/40"
                >
                  <item.icon size={17} />
                  <span>{item.label}</span>
                  <span className="ml-auto rounded-full border border-sidebar-border/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                    Soon
                  </span>
                </span>
              )
            }
            if (item.capability && !capabilities[item.capability]) return null
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href!)
            return (
              <SidebarNavLink
                key={item.href}
                href={item.href!}
                onClick={closeMobile}
                active={active}
                icon={<item.icon size={17} />}
                label={item.label}
              />
            )
          })}
        </SidebarGroup>
      ))}
    </nav>
  )

  const fullSidebar = (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-6 flex shrink-0 items-center justify-between border-b border-sidebar-border px-4 py-3.5">
        <Link
          href="/admin"
          className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <StethoscopeIcon size={17} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight tracking-tight text-sidebar-foreground">MedNexus</span>
            <span className="block text-[10px] leading-tight tracking-wide text-sidebar-foreground/45">Admin Console</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-label="Collapse sidebar"
          className="hidden rounded-lg p-1.5 text-sidebar-foreground/40 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:flex"
        >
          <ArrowLeft size={16} />
        </button>
      </div>

      <div
        data-testid="admin-navigation-scroll-region"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
      >
        {navigation}
      </div>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-2">
        <Link
          href="/"
          className="flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          ← Return to Learner Workspace
        </Link>
      </div>
    </div>
  )

  const collapsedSidebar = (
    <SidebarCollapsedRail
      onExpand={() => setCollapsed(false)}
      footer={
        <Link
          href="/"
          aria-label="Return to Learner Workspace"
          title="Return to Learner Workspace"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <ArrowLeft size={17} />
        </Link>
      }
    >
      {groups
        .flatMap((group) => group.items)
        .filter((item) => !item.soon && (!item.capability || capabilities[item.capability]))
        .map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href!)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href!}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon size={18} />
            </Link>
          )
        })}
    </SidebarCollapsedRail>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <SidebarFrame
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        collapsedChildren={collapsedSidebar}
      >
        {fullSidebar}
      </SidebarFrame>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 pb-8 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
