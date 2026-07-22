"use client"

/**
 * TheoryVaultShell — the top-level client shell rendered on /theory.
 *
 * Owns:
 *  - The persistent TheorySidebar (left)
 *  - A header (no Trial/Exam buttons — Theory mode)
 *  - The main content area (placeholder until theory screens are built)
 *  - Sidebar collapsed / mobile-open state
 *  - Active theory section state
 */

import { useState } from "react"
import { TheorySidebar, type TheoryScreen } from "./TheorySidebar"
import { NotificationBell } from "@/components/notification-bell"
import { StethoscopeIcon, MenuIcon, PaletteIcon } from "@/components/icons"

// Placeholder screens — replaced by real components in a later task
function PlaceholderScreen({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          width={32}
          height={32}
          className="text-teal-600 dark:text-teal-400"
        >
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z" />
          <path d="M12 8v4l3 3" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="rounded-full border border-teal-300/50 bg-teal-50/60 px-3 py-1 text-xs font-semibold text-teal-700 dark:border-teal-700/40 dark:bg-teal-900/20 dark:text-teal-400">
        Coming Soon
      </span>
    </div>
  )
}

const SECTION_META: Record<
  TheoryScreen,
  { title: string; description: string }
> = {
  dashboard:  { title: "Theory Dashboard",   description: "Your revision overview, recent activity, and recommended questions." },
  browse:     { title: "Browse Questions",    description: "Explore the full theory question bank by module, category, and set." },
  bookmarks:  { title: "Bookmarks",           description: "All the theory questions you've saved for later." },
  notes:      { title: "My Notes",            description: "Personal notes you've written on individual theory questions." },
  revision:   { title: "Revision Queue",      description: "Questions queued for your next revision session." },
  progress:   { title: "Progress",            description: "Track your theory study history and performance over time." },
  search:     { title: "Search",              description: "Full-text search across all theory questions, tags, and notes." },
}

export function TheoryVaultShell() {
  const [activeSection, setActiveSection] = useState<TheoryScreen>("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)

  const meta = SECTION_META[activeSection]

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <TheorySidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(true)}
        onExpand={() => setSidebarCollapsed(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header — no Trial/Exam toggle */}
        <header className="flex items-center justify-between border-b border-border bg-card px-3 py-2 sm:px-4 sm:py-2.5">
          {/* Left */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="md:hidden shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Open menu"
            >
              <MenuIcon size={20} />
            </button>
            <div className="flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1">
              <StethoscopeIcon size={16} className="shrink-0 text-primary" />
              <span className="truncate text-sm font-bold tracking-tight">MedNexus</span>
              <span className="hidden rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 sm:inline">
                Theory Vault
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setThemeOpen(true)}
              className="hidden md:flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Appearance"
            >
              <PaletteIcon size={20} />
            </button>
            <NotificationBell />
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-3 pb-24 md:p-5 lg:p-8">
          <PlaceholderScreen title={meta.title} description={meta.description} />
        </main>
      </div>
    </div>
  )
}
