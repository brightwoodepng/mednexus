"use client"

import Link from "next/link"
import {
  ArrowLeft, BarChart3, Bell, BookOpen, ClipboardCheck, Database, FileOutput, Coins,
  LayoutDashboard, ListChecks, Menu, MessageSquareText, Palette, Search, Settings, ShieldCheck, Users, Waypoints,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { StethoscopeIcon } from "@/components/icons"
import { SidebarCollapsedRail, SidebarFrame, SidebarGroup, SidebarNavLink, SidebarProfileFooter } from "@/components/navigation/sidebar-primitives"
import { ThemeModal } from "@/components/theme-modal"
import { useTheme } from "@/contexts/theme-context"

type Capability = "mcq" | "theory" | "assessments" | "users" | "system" | "broadcasts"
type AdminShellProps = { capabilities: Record<Capability, boolean>; identity: { uid: string; name: string; role: string }; children: React.ReactNode }
type NavigationItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }>; capability?: Capability }

const groups: Array<{ label?: string; items: NavigationItem[] }> = [
  { label: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Content", items: [
    { href: "/admin/mcq", label: "MCQ Bank", icon: ListChecks, capability: "mcq" },
    { href: "/admin/theory", label: "Theory Vault", icon: BookOpen, capability: "theory" },
    { href: "/admin/modules", label: "Modules & Disciplines", icon: Waypoints, capability: "mcq" },
    { href: "/admin/imports-exports", label: "Imports & Exports", icon: FileOutput, capability: "mcq" },
  ] },
  { label: "Assessments", items: [
    { href: "/admin/assessments", label: "Live Assessments", icon: ClipboardCheck, capability: "assessments" },
    { href: "/admin/results", label: "Assessment Results", icon: BarChart3, capability: "assessments" },
  ] },
  { label: "People & Communications", items: [
    { href: "/admin/users", label: "Users", icon: Users, capability: "users" },
    { href: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, capability: "system" },
    { href: "/admin/notifications", label: "Notifications", icon: MessageSquareText, capability: "broadcasts" },
  ] },
  { label: "Platform", items: [
    { href: "/admin/economy-seasons", label: "Economy Seasons", icon: Coins, capability: "system" },
    { href: "/admin/settings", label: "System Settings", icon: Settings, capability: "system" },
    { href: "/admin/system/question-bank", label: "Question Bank Source", icon: Database, capability: "system" },
  ] },
]

// ─── Header ────────────────────────────────────────────────────────────────────

function AdminHeader({
  onOpenMobile,
}: {
  onOpenMobile: () => void
}) {
  const { activeTheme, isGlassEnabled } = useTheme()
  const router = useRouter()
  const [themeModalOpen, setThemeModalOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<{ type: string; id: string; title: string; subtitle: string; href: string }>>([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setPaletteOpen(true)
      } else if (event.key === "Escape") setPaletteOpen(false)
    }
    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [])
  useEffect(() => {
    if (paletteOpen) window.setTimeout(() => searchRef.current?.focus(), 0)
  }, [paletteOpen])
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        const body = await response.json()
        if (response.ok) setResults(body.results ?? [])
      } finally { if (!controller.signal.aborted) setSearching(false) }
    }, 220)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query])

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
          className="h-9 w-full cursor-pointer rounded-lg border border-border bg-muted/50 pl-8 pr-16 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
          aria-label="Admin search"
          onFocus={() => setPaletteOpen(true)}
          readOnly
        />
        <kbd className="pointer-events-none absolute right-3 hidden select-none rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:block">
          Ctrl K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Notification bell */}
        <Link
          href="/admin/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </Link>

        {/* Appearance settings share the learner workspace's theme context. */}
        <button
          type="button"
          onClick={() => setThemeModalOpen(true)}
          aria-label="Appearance"
          title={`Appearance: ${activeTheme}${isGlassEnabled ? " with Liquid Glass" : ""}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Palette size={18} />
        </button>

        {/* Date */}
        <div className="hidden items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground sm:flex whitespace-nowrap">
          <span className="font-medium text-foreground">{today}</span>
        </div>
      </div>
      <ThemeModal open={themeModalOpen} onClose={() => setThemeModalOpen(false)} />
      {paletteOpen && <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/45 px-3 pt-[12vh]" onMouseDown={(event) => { if (event.currentTarget === event.target) setPaletteOpen(false) }}>
        <div role="dialog" aria-modal="true" aria-label="Admin command palette" className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="relative border-b border-border p-3">
            <Search size={18} className="absolute left-6 top-6 text-muted-foreground" />
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search permitted content and records…" className="h-12 w-full rounded-xl bg-muted/50 pl-11 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-2">
            {searching && <p className="p-5 text-center text-sm text-muted-foreground">Searching…</p>}
            {!searching && query.trim().length < 2 && <p className="p-5 text-center text-sm text-muted-foreground">Type at least two characters. Results are filtered by your permissions.</p>}
            {!searching && query.trim().length >= 2 && results.length === 0 && <p className="p-5 text-center text-sm text-muted-foreground">No matching records.</p>}
            {results.map((result) => <button key={`${result.type}-${result.id}`} type="button" onClick={() => { setPaletteOpen(false); setQuery(""); router.push(result.href) }} className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              <span className="mt-0.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">{result.type}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{result.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.subtitle}</span></span>
            </button>)}
          </div>
          <div className="flex justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground"><span>Server-filtered results</span><span>Esc to close</span></div>
        </div>
      </div>}
    </header>
  )
}

// ─── Shell ─────────────────────────────────────────────────────────────────────

export function AdminShell({ capabilities, identity, children }: AdminShellProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const closeMobile = () => setMobileOpen(false)
  const initials = identity.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A"

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("mednexus.admin.sidebar-collapsed") === "true")
  }, [])
  const setSidebarCollapsed = (value: boolean) => {
    setCollapsed(value)
    window.localStorage.setItem("mednexus.admin.sidebar-collapsed", String(value))
  }

  const navigation = (
    <nav aria-label="Admin navigation" className="flex flex-col gap-5">
      {groups.map((group) => (
        <SidebarGroup key={group.label ?? "dashboard"} label={group.label}>
          {group.items.map((item) => {
            if (item.capability && !capabilities[item.capability]) return null
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
            return (
              <SidebarNavLink
                key={item.href}
                href={item.href}
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
          onClick={() => setSidebarCollapsed(true)}
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

      <div className="shrink-0 space-y-2 border-t border-sidebar-border px-3 py-3">
        <SidebarProfileFooter><div className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{initials}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-sidebar-foreground">{identity.name}</span><span className="block truncate text-[10px] uppercase tracking-wide text-sidebar-foreground/50">{identity.role.replaceAll("_", " ")}</span></span></div></SidebarProfileFooter>
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
      onExpand={() => setSidebarCollapsed(false)}
      footer={<>
        <span title={`${identity.name} · ${identity.role.replaceAll("_", " ")}`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">{initials}</span>
        <Link
          href="/"
          aria-label="Return to Learner Workspace"
          title="Return to Learner Workspace"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <ArrowLeft size={17} />
        </Link>
      </>}
    >
      {groups
        .flatMap((group) => group.items)
        .filter((item) => !item.capability || capabilities[item.capability])
        .map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
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
