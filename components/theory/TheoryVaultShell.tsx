"use client"

/**
 * TheoryVaultShell — the top-level client shell for Theory Vault routes.
 *
 * Owns:
 *  - The persistent TheorySidebar (left)
 *  - A header (no Trial/Exam buttons — Theory mode)
 *  - The main content area — renders real components for dashboard and browse;
 *    falls back to PlaceholderScreen for sections not yet implemented
 *  - Sidebar collapsed / mobile-open state
 *  - Active theory section state (synced with initialSection prop)
 *
 * Navigation:
 *  - "dashboard" → router.push("/theory")
 *  - "browse"    → router.push("/theory/browse")
 *  - others      → in-shell state only (placeholder rendered)
 */

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { TheorySidebar, type TheoryScreen } from "./TheorySidebar"
import { TheoryDashboard } from "./TheoryDashboard"
import { TheoryBrowse } from "./TheoryBrowse"
import { BookmarksView } from "./BookmarksView"
import { NotesView } from "./NotesView"
import { RevisionQueueView } from "./RevisionQueueView"
import { ProgressView } from "./ProgressView"
import { NotificationBell } from "@/components/notification-bell"
import { StethoscopeIcon, MenuIcon, PaletteIcon } from "@/components/icons"

// ── Placeholder (non-implemented sections) ─────────────────────────────────────

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

const PLACEHOLDER_META: Partial<Record<TheoryScreen, { title: string; description: string }>> = {
  bookmarks: { title: "Bookmarks",      description: "All the theory questions you've saved for later." },
  notes:     { title: "My Notes",       description: "Personal notes you've written on individual theory questions." },
  revision:  { title: "Revision Queue", description: "Questions queued for your next revision session." },
  progress:  { title: "Progress",       description: "Track your theory study history and performance over time." },
  search:    { title: "Search",         description: "Full-text search across all theory questions, tags, and notes." },
}

// ── Shell ─────────────────────────────────────────────────────────────────────

interface TheoryVaultShellProps {
  /** Which section to show on first render. Defaults to "dashboard". */
  initialSection?: TheoryScreen
}

export function TheoryVaultShell({ initialSection = "dashboard" }: TheoryVaultShellProps) {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState<TheoryScreen>(initialSection)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Sidebar navigation — pushes Next.js routes for all implemented sections
  function handleNavigate(section: TheoryScreen) {
    setActiveSection(section)
    if (section === "dashboard")  router.push("/theory")
    else if (section === "browse")    router.push("/theory/browse")
    else if (section === "revision")  router.push("/theory/revision-queue")
    else if (section === "bookmarks") router.push("/theory/bookmarks")
    else if (section === "notes")     router.push("/theory/notes")
    else if (section === "progress")  router.push("/theory/progress")
    // "search" stays in-shell (placeholder)
  }

  // ── Main content ────────────────────────────────────────────────────────────
  let mainContent: React.ReactNode

  if (activeSection === "dashboard") {
    mainContent = <TheoryDashboard />
  } else if (activeSection === "browse") {
    mainContent = (
      <Suspense
        fallback={
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="h-12 w-64 animate-pulse rounded-xl bg-muted/50" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted/50" />
              ))}
            </div>
          </div>
        }
      >
        <TheoryBrowse />
      </Suspense>
    )
  } else if (activeSection === "bookmarks") {
    mainContent = <BookmarksView />
  } else if (activeSection === "notes") {
    mainContent = <NotesView />
  } else if (activeSection === "revision") {
    mainContent = <RevisionQueueView />
  } else if (activeSection === "progress") {
    mainContent = <ProgressView />
  } else {
    const meta = PLACEHOLDER_META[activeSection]
    mainContent = meta
      ? <PlaceholderScreen title={meta.title} description={meta.description} />
      : null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <TheorySidebar
        activeSection={activeSection}
        onNavigate={handleNavigate}
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
          {mainContent}
        </main>
      </div>
    </div>
  )
}
