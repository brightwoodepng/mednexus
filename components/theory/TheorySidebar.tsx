"use client"

/**
 * TheorySidebar — the persistent left-hand navigation panel rendered exclusively
 * when currentStudyMode === "THEORY".
 *
 * Architectural rules:
 *  - This file must NEVER import from components/sidebar.tsx or any MCQ component.
 *  - It mirrors the visual language of the MCQ sidebar but owns its own
 *    NavButton / IconButton helpers so the two sidebars are fully independent.
 */

import { useRef, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/contexts/theme-context"
import { useCurrentStudyMode } from "@/contexts/current-study-mode-context"
import {
  LayoutDashboardIcon,
  SearchIcon,
  StarIcon,
  PencilIcon,
  RotateCcwIcon,
  ActivityIcon,
  LayersIcon,
  ChevronLeftIcon,
  LogOutIcon,
  UserIcon,
  XIcon,
  BookOpenIcon,
  FlaskIcon,
  CheckIcon,
} from "@/components/icons"

// ── Screen type ───────────────────────────────────────────────────────────────

export type TheoryScreen =
  | "dashboard"
  | "browse"
  | "bookmarks"
  | "notes"
  | "revision"
  | "progress"
  | "search"

// ── Props ─────────────────────────────────────────────────────────────────────

interface TheorySidebarProps {
  activeSection: TheoryScreen
  onNavigate: (section: TheoryScreen) => void
  mobileOpen: boolean
  onCloseMobile: () => void
  collapsed: boolean
  onCollapse: () => void
  onExpand: () => void
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500" />
    </span>
  )
}

function NavButton({
  glass,
  active,
  onClick,
  icon,
  label,
  badge,
  dot,
}: {
  glass: boolean
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: string
  dot?: boolean
}) {
  const activeCls = glass
    ? "glass-pill-active text-sidebar-accent-foreground"
    : "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border"
  const inactiveCls = glass
    ? "text-sidebar-foreground/80 glass-pill-hover"
    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? activeCls : inactiveCls}`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {dot && <LiveDot />}
      {badge && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-foreground/70 tabular-nums ${glass ? "glass-card" : "bg-muted"}`}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

function IconButton({
  glass,
  active,
  onClick,
  label,
  children,
}: {
  glass: boolean
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  const activeCls = glass
    ? "glass-pill-active text-sidebar-accent-foreground"
    : "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border"
  const inactiveCls = glass
    ? "text-sidebar-foreground/70 glass-pill-hover"
    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${active ? activeCls : inactiveCls}`}
    >
      {children}
    </button>
  )
}

// ── Study Environment popover ─────────────────────────────────────────────────

function StudyEnvPopover({
  onClose,
  glass,
}: {
  onClose: () => void
  glass: boolean
}) {
  const { currentStudyMode, setCurrentStudyMode } = useCurrentStudyMode()
  const { user, signOutUser } = useApp()
  const router = useRouter()

  function handleSelect(mode: "MCQ" | "THEORY") {
    setCurrentStudyMode(mode)
    onClose()
    if (mode === "MCQ") router.push("/")
    // THEORY: already here, no navigation needed
  }

  const cardBase =
    "flex flex-1 flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all cursor-pointer"

  return (
    <div
      className={`absolute bottom-full left-0 right-0 mb-2 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden z-50 ${glass ? "glass-card" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Study Environment
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <XIcon size={13} />
        </button>
      </div>

      {/* Mode cards */}
      <div className="flex gap-2 p-3">
        {/* MCQ Q-Bank */}
        <button
          type="button"
          onClick={() => handleSelect("MCQ")}
          className={`${cardBase} ${
            currentStudyMode === "MCQ"
              ? "border-primary/60 bg-primary/8 text-primary"
              : "border-border bg-muted/40 text-muted-foreground hover:border-primary/30 hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <BookOpenIcon size={20} />
          <span className="text-[11px] font-semibold leading-tight">
            MCQ Q-Bank
          </span>
          {currentStudyMode === "MCQ" && (
            <span className="flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
              <CheckIcon size={8} /> Active
            </span>
          )}
        </button>

        {/* Theory Vault */}
        <button
          type="button"
          onClick={() => handleSelect("THEORY")}
          className={`${cardBase} ${
            currentStudyMode === "THEORY"
              ? "border-teal-500/60 bg-teal-500/8 text-teal-600 dark:text-teal-400"
              : "border-border bg-muted/40 text-muted-foreground hover:border-teal-500/30 hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          <FlaskIcon size={20} />
          <span className="text-[11px] font-semibold leading-tight">
            Theory Vault
          </span>
          {currentStudyMode === "THEORY" && (
            <span className="flex items-center gap-0.5 rounded-full bg-teal-500/15 px-1.5 py-0.5 text-[9px] font-bold text-teal-600 dark:text-teal-400">
              <CheckIcon size={8} /> Active
            </span>
          )}
        </button>
      </div>

      {/* Footer: sign out */}
      <div className="border-t border-border px-3 pb-3 pt-2">
        <button
          type="button"
          onClick={() => { signOutUser(); onClose() }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOutIcon size={13} />
          Sign Out
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function TheorySidebar({
  activeSection,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  collapsed,
  onCollapse,
  onExpand,
}: TheorySidebarProps) {
  const { user } = useApp()
  const { isGlassEnabled } = useTheme()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const nav = (s: TheoryScreen) => {
    onNavigate(s)
    onCloseMobile()
  }

  // Close popover on outside click
  useEffect(() => {
    if (!popoverOpen) return
    function handleOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [popoverOpen])

  // ── Style helpers ──────────────────────────────────────────────────────────
  const panelCls = isGlassEnabled
    ? "glass-sidebar"
    : "bg-sidebar border-r border-sidebar-border"

  const cardCls = isGlassEnabled
    ? "glass-card"
    : "border border-sidebar-border bg-sidebar-accent/50"

  const dividerCls = isGlassEnabled
    ? "glass-divider"
    : "bg-sidebar-border/60"

  // ── Nav items ──────────────────────────────────────────────────────────────
  const navItems: {
    id: TheoryScreen
    label: string
    icon: React.ReactNode
  }[] = [
    { id: "dashboard",  label: "Dashboard",        icon: <LayoutDashboardIcon size={18} /> },
    { id: "browse",     label: "Browse Questions",  icon: <LayersIcon size={18} /> },
    { id: "bookmarks",  label: "Bookmarks",         icon: <StarIcon size={18} /> },
    { id: "notes",      label: "My Notes",          icon: <PencilIcon size={18} /> },
    { id: "revision",   label: "Revision Queue",    icon: <RotateCcwIcon size={18} /> },
    { id: "progress",   label: "Progress",          icon: <ActivityIcon size={18} /> },
    { id: "search",     label: "Search",            icon: <SearchIcon size={18} /> },
  ]

  // ── Full sidebar ───────────────────────────────────────────────────────────
  const fullContent = (
    <div className="flex h-full flex-col gap-2 p-4 overflow-hidden">
      {/* Collapse / close controls */}
      <div className="mb-1 flex items-center justify-between px-1 pt-1 shrink-0">
        {/* Theory Vault label */}
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
          <FlaskIcon size={12} />
          Theory Vault
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCollapse}
            className={`hidden rounded-xl p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors lg:flex ${isGlassEnabled ? "glass-pill-hover" : "hover:bg-sidebar-accent"}`}
            aria-label="Collapse sidebar"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <button
            type="button"
            onClick={onCloseMobile}
            className={`rounded-xl p-1.5 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors lg:hidden ${isGlassEnabled ? "glass-pill-hover" : "hover:bg-sidebar-accent"}`}
            aria-label="Close menu"
          >
            <XIcon size={20} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item, i) => (
            <>
              {/* Divider after Dashboard */}
              {i === 1 && (
                <div key="div" className={`my-1.5 h-px mx-1 ${dividerCls}`} />
              )}
              <NavButton
                key={item.id}
                glass={isGlassEnabled}
                active={activeSection === item.id}
                onClick={() => nav(item.id)}
                icon={item.icon}
                label={item.label}
              />
            </>
          ))}
        </nav>
      </div>

      {/* Bottom: profile card + popover */}
      <div className="shrink-0 pt-2">
        <div ref={popoverRef} className="relative">
          {popoverOpen && (
            <StudyEnvPopover
              glass={isGlassEnabled}
              onClose={() => setPopoverOpen(false)}
            />
          )}
          <button
            type="button"
            onClick={() => setPopoverOpen((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${cardCls} ${isGlassEnabled ? "hover:glass-pill-active" : "hover:bg-sidebar-accent"}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600/90 text-white shadow-sm">
              <UserIcon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">
                {user?.name ?? "Clinician"}
              </p>
              <p className="text-[11px] text-sidebar-foreground/55">
                Theory Vault
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )

  // ── Collapsed sidebar ──────────────────────────────────────────────────────
  const collapsedContent = (
    <div className="flex h-full flex-col items-center gap-0.5 py-4 px-2">
      <button
        type="button"
        onClick={onExpand}
        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors ${isGlassEnabled ? "glass-pill-hover" : "border border-sidebar-border hover:bg-sidebar-accent"}`}
        aria-label="Expand sidebar"
      >
        <ChevronLeftIcon size={18} className="rotate-180" />
      </button>

      {navItems.map((item) => (
        <IconButton
          key={item.id}
          glass={isGlassEnabled}
          active={activeSection === item.id}
          onClick={() => nav(item.id)}
          label={item.label}
        >
          {item.icon}
        </IconButton>
      ))}

      <div className="mt-auto">
        <IconButton
          glass={isGlassEnabled}
          active={false}
          onClick={() => setPopoverOpen((v) => !v)}
          label="Study Environment"
        >
          <UserIcon size={18} />
        </IconButton>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <aside
        className={`hidden shrink-0 md:block transition-all duration-200 ${panelCls} ${collapsed ? "w-14" : "w-64"}`}
      >
        {collapsed ? collapsedContent : fullContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
          />
          <div
            className={`absolute left-0 top-0 h-full w-72 max-w-[80%] shadow-2xl animate-in slide-in-from-left duration-200 ${panelCls}`}
          >
            {fullContent}
          </div>
        </div>
      )}
    </>
  )
}
