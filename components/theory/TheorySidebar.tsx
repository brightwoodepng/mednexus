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

import { useRef, useEffect, useState, Fragment } from "react"
import { useRouter } from "next/navigation"
import { STUDY_HUBS } from "@/lib/study-hubs"
import type { StudyMode } from "@/lib/types"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
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
  DatabaseIcon,
  MegaphoneIcon,
} from "@/components/icons"
import { SidebarFrame } from "@/components/navigation/sidebar-primitives"

function UsersIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={size} height={size}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

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
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
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
  adminBadge,
  dot,
}: {
  glass: boolean
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: string
  adminBadge?: string
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
      {adminBadge && (
        <span
          className="ml-auto rounded-full border border-warning/30 bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning"
        >
          {adminBadge}
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

  function handleSelect(mode: StudyMode) {
    setCurrentStudyMode(mode)
    onClose()
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

      {/* Mode cards are registry-driven so availability and routes stay shared. */}
      <div className="flex gap-2 p-3">
        {STUDY_HUBS.filter(hub => hub.availability === "available").map(hub => {
          const active = currentStudyMode === hub.mode
          const Icon = hub.id === "mcq" ? BookOpenIcon : FlaskIcon
          return <button key={hub.id} type="button" onClick={() => handleSelect(hub.mode)} className={`${cardBase} ${active ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground hover:border-primary/30 hover:bg-muted/80 hover:text-foreground"}`}>
            <Icon size={20}/><span className="text-[11px] font-semibold leading-tight">{hub.title}</span>
            {active && <span className="flex items-center gap-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary"><CheckIcon size={8}/>Active</span>}
          </button>
        })}
      </div>
      {STUDY_HUBS.filter((hub) => hub.availability === "coming-soon").map(hub => (
        <div key={hub.id} className="mx-3 mb-3 flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          <span>{hub.title}</span><span className="font-semibold">Coming soon</span>
        </div>
      ))}

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
  const { user, signOutUser } = useApp()
  const { isAdmin, logoutAdmin } = useAdmin()
  const { isGlassEnabled } = useTheme()
  const { setCurrentStudyMode } = useCurrentStudyMode()
  const router = useRouter()
  const [studyEnvOpen, setStudyEnvOpen] = useState(false)
  const studyEnvRef = useRef<HTMLDivElement>(null)
  const [profile, setProfile] = useState({ revisionsDue: 0, completedQuestions: 0, bookmarks: 0 })

  // The sidebar is deliberately backed by the Theory aggregate, rather than
  // the MCQ progress object. This keeps its identity and counters mode-specific.
  useEffect(() => {
    const guestToken = typeof window === "undefined" ? null : localStorage.getItem("mednexus-guest-token")
    const userToken = typeof window === "undefined" ? null : localStorage.getItem("mednexus-user-token")
    const headers: Record<string, string> = guestToken ? { "x-guest-token": guestToken } : userToken ? { "x-session-token": userToken } : {}
    fetch("/api/theory/profile-summary", { headers })
      .then(async response => {
        if (!response.ok) throw new Error("Profile summary unavailable")
        return response.json()
      })
      .then(summary => setProfile({
        revisionsDue: Number(summary.metrics?.revisionsDue) || 0,
        completedQuestions: Number(summary.metrics?.completedQuestions) || 0,
        bookmarks: Number(summary.metrics?.bookmarks) || 0,
      }))
      .catch(() => undefined)
  }, [user?.uid])

  const nav = (s: TheoryScreen) => {
    onNavigate(s)
    onCloseMobile()
  }

  /** Navigate to a screen in the MCQ app via sessionStorage handoff. */
  function handleGoToScreen(targetScreen: string) {
    // Content management is mode-specific. Shared admin screens continue to
    // live in the MCQ shell, but Theory authoring never falls back to MCQs.
    if (targetScreen === "question-editor") {
      onCloseMobile()
      router.push("/admin/theory")
      return
    }
    sessionStorage.setItem("mednexus_initial_screen", targetScreen)
    setCurrentStudyMode("MCQ")
    router.push("/")
  }

  // Close study-env popover on outside click
  useEffect(() => {
    if (!studyEnvOpen) return
    function handleOutside(e: MouseEvent) {
      if (
        studyEnvRef.current &&
        !studyEnvRef.current.contains(e.target as Node)
      ) {
        setStudyEnvOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [studyEnvOpen])

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
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--hub-accent)]">
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
            <Fragment key={item.id}>
              {/* Divider after Dashboard */}
              {i === 1 && (
                <div className={`my-1.5 h-px mx-1 ${dividerCls}`} />
              )}
              <NavButton
                glass={isGlassEnabled}
                active={activeSection === item.id}
                onClick={() => nav(item.id)}
                icon={item.icon}
                label={item.label}
              />
            </Fragment>
          ))}

          {isAdmin && (
            <>
              <div className={`my-1.5 h-px mx-1 ${dividerCls}`} />
              <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">Admin</p>
              <NavButton glass={isGlassEnabled} active={false} onClick={() => handleGoToScreen("user-management")} icon={<UsersIcon size={18} />} label="Users" adminBadge="Admin" />
              <NavButton glass={isGlassEnabled} active={false} onClick={() => handleGoToScreen("question-editor")} icon={<DatabaseIcon size={18} />} label="Editor" adminBadge="Admin" />
              <NavButton glass={isGlassEnabled} active={false} onClick={() => handleGoToScreen("broadcast")} icon={<MegaphoneIcon size={18} />} label="Broadcast" adminBadge="Admin" />
            </>
          )}
        </nav>
      </div>

      {/* Bottom: admin mode · study env switcher · profile card · sign out */}
      <div className="shrink-0 flex flex-col gap-2 pt-2">
        {isAdmin && (
          <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${cardCls}`}>
            <div className="flex items-center gap-2">
              <DatabaseIcon size={13} className="text-amber-500" />
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Admin Mode</span>
            </div>
            <button
              type="button"
              onClick={logoutAdmin}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 transition-colors ${isGlassEnabled ? "glass-pill-hover" : "hover:bg-amber-500/20"}`}
            >
              Exit
            </button>
          </div>
        )}

        {/* Study Environment switcher */}
        <div ref={studyEnvRef} className="relative">
          {studyEnvOpen && (
            <StudyEnvPopover
              glass={isGlassEnabled}
              onClose={() => setStudyEnvOpen(false)}
            />
          )}
          <button
            type="button"
            onClick={() => setStudyEnvOpen((v) => !v)}
            className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors ${cardCls}`}
          >
            <FlaskIcon size={13} className="text-[color:var(--hub-accent)]" />
            Switch Environment
          </button>
        </div>

        {/* Theory-specific learner identity and live study counters. */}
        <div className={`w-full rounded-xl px-3 py-2.5 text-left ${cardCls}`}>
          <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--hub-accent)] text-[color:var(--hub-accent-foreground)] shadow-sm">
            <UserIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">
              {user?.name ?? "Clinician"}
            </p>
            <p className="text-[11px] text-sidebar-foreground/55">Theory Vault</p>
          </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div><p className="font-bold text-amber-600 dark:text-amber-400">{profile.revisionsDue}</p><p className="text-sidebar-foreground/55">due</p></div>
            <div><p className="font-bold text-[color:var(--hub-accent)]">{profile.completedQuestions}</p><p className="text-sidebar-foreground/55">completed</p></div>
            <div><p className="font-bold text-sidebar-foreground">{profile.bookmarks}</p><p className="text-sidebar-foreground/55">saved</p></div>
          </div>
        </div>

        {/* Sign Out */}
        <button
          type="button"
          onClick={signOutUser}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:text-destructive ${isGlassEnabled ? "glass-pill-hover" : "hover:bg-destructive/10"}`}
        >
          <LogOutIcon size={18} />
          Sign Out
        </button>
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

      {isAdmin && (
        <>
          <div className={`my-2 w-6 h-px ${dividerCls}`} />
          <IconButton glass={isGlassEnabled} active={false} onClick={() => handleGoToScreen("user-management")} label="Users"><UsersIcon size={18} /></IconButton>
          <IconButton glass={isGlassEnabled} active={false} onClick={() => handleGoToScreen("question-editor")} label="Editor"><DatabaseIcon size={18} /></IconButton>
          <IconButton glass={isGlassEnabled} active={false} onClick={() => handleGoToScreen("broadcast")} label="Broadcast"><MegaphoneIcon size={18} /></IconButton>
        </>
      )}

      <div className="mt-auto flex flex-col items-center gap-1">
        <IconButton
          glass={isGlassEnabled}
          active={false}
          onClick={() => setStudyEnvOpen((v) => !v)}
          label="Switch Environment"
        >
          <FlaskIcon size={18} />
        </IconButton>
        <IconButton
          glass={isGlassEnabled}
          active={false}
          onClick={() => handleGoToScreen("profile")}
          label="Profile"
        >
          <UserIcon size={18} />
        </IconButton>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SidebarFrame collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={onCloseMobile} collapsedChildren={collapsedContent} glass={isGlassEnabled}>
      {fullContent}
    </SidebarFrame>
  )
}
