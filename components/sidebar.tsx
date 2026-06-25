"use client"

import { useEffect, useState, useMemo } from "react"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { useQuestions } from "@/contexts/questions-context"
import { getModules, getModuleQuestionCount, getWeakAreaQuestions } from "@/lib/modules"
import {
  StethoscopeIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  LogOutIcon,
  XIcon,
  DatabaseIcon,
  MegaphoneIcon,
  UserIcon,
  LayersIcon,
  ActivityIcon,
  StarIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@/components/icons"
import type { Screen } from "@/lib/view"

interface SidebarProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
  onOpenThemes: () => void
  onOpenAdminLogin: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
  onReadyForQuiz: (config: { module: string; discipline: string | null }) => void
  onSelectModule: (module: string) => void
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!now) return null

  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  const date = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })

  return (
    <div className="flex flex-col items-center rounded-xl border border-sidebar-border bg-sidebar-accent/30 px-3 py-2.5 text-center">
      <span className="text-lg font-bold tabular-nums tracking-tight text-sidebar-foreground leading-none">
        {time}
      </span>
      <span className="mt-0.5 text-[11px] text-muted-foreground">{date}</span>
    </div>
  )
}

// ── Study Modules Panel ──────────────────────────────────────────────────────
function StudyModulesPanel({
  onSelectModule,
  onClose,
}: {
  onSelectModule: (mod: string) => void
  onClose: () => void
}) {
  const { progress, toggleFavoriteModule } = useApp()
  const { questions } = useQuestions()
  const [search, setSearch] = useState("")

  const favorites = progress.favoriteModules ?? []

  const modules = useMemo(() => getModules(), [questions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = q ? modules.filter((m) => m.toLowerCase().includes(q)) : modules
    return [
      ...all.filter((m) => favorites.includes(m)),
      ...all.filter((m) => !favorites.includes(m)),
    ]
  }, [modules, favorites, search])

  return (
    <div className="flex flex-col gap-2 pt-1 pb-1">
      {/* Search */}
      <div className="relative mx-1">
        <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Search modules…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent/40 pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Module list */}
      <ul className="max-h-52 overflow-y-auto flex flex-col gap-0.5 pr-0.5">
        {filtered.length === 0 && (
          <li className="px-3 py-2 text-xs text-muted-foreground">No modules match.</li>
        )}
        {filtered.map((mod) => {
          const isFav = favorites.includes(mod)
          const count = getModuleQuestionCount(mod)
          return (
            <li key={mod} className="flex items-center gap-1 rounded-lg hover:bg-sidebar-accent group">
              <button
                type="button"
                onClick={() => { onSelectModule(mod); onClose() }}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left min-w-0"
              >
                {isFav && (
                  <span className="text-amber-400 text-[10px] shrink-0">★</span>
                )}
                <span className="truncate text-xs font-medium text-sidebar-foreground">{mod}</span>
                <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">{count}Q</span>
              </button>
              <button
                type="button"
                onClick={() => toggleFavoriteModule(mod)}
                aria-label={isFav ? "Unstar" : "Star"}
                className={`mr-1.5 shrink-0 rounded p-0.5 transition-colors ${isFav ? "text-amber-400 hover:text-amber-500" : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-400"}`}
              >
                <StarIcon size={11} />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Sidebar({
  screen,
  onNavigate,
  onOpenThemes,
  onOpenAdminLogin,
  mobileOpen,
  onCloseMobile,
  onReadyForQuiz,
  onSelectModule,
}: SidebarProps) {
  const { user, cloudEnabled, signOutUser, progress } = useApp()
  const { isAdmin, logoutAdmin } = useAdmin()
  const { questions } = useQuestions()
  const [modulesOpen, setModulesOpen] = useState(false)

  const nav = (id: Screen) => { onNavigate(id); onCloseMobile() }

  const weakCount = useMemo(
    () => getWeakAreaQuestions(progress.history).length,
    [progress.history]
  )

  const content = (
    <div className="flex h-full flex-col gap-2 p-4 overflow-hidden">
      {/* Brand */}
      <div className="mb-2 flex items-center justify-between px-2 pt-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <StethoscopeIcon size={20} />
          </div>
          <span className="text-lg font-semibold tracking-tight">MedNexus</span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
          aria-label="Close menu"
        >
          <XIcon size={20} />
        </button>
      </div>

      {/* Live clock */}
      <div className="shrink-0">
        <LiveClock />
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <nav className="flex flex-col gap-1">
          {/* Dashboard */}
          <NavButton
            active={screen === "dashboard"}
            onClick={() => nav("dashboard")}
            icon={<LayoutDashboardIcon size={18} />}
            label="Dashboard"
          />

          {/* Profile */}
          <NavButton
            active={screen === "profile"}
            onClick={() => nav("profile")}
            icon={<UserIcon size={18} />}
            label="Profile"
          />

          <div className="my-1 h-px bg-sidebar-border/60" />

          {/* Study Modules expandable */}
          <div>
            <button
              type="button"
              onClick={() => setModulesOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <LayersIcon size={18} />
              <span className="flex-1 text-left">Study Modules</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
                {getModules().length}
              </span>
              {modulesOpen ? (
                <ChevronDownIcon size={14} className="text-muted-foreground" />
              ) : (
                <ChevronRightIcon size={14} className="text-muted-foreground" />
              )}
            </button>

            {modulesOpen && (
              <div className="ml-2 mt-1 rounded-xl border border-sidebar-border bg-sidebar-accent/20 px-2 py-1.5">
                <StudyModulesPanel
                  onSelectModule={onSelectModule}
                  onClose={onCloseMobile}
                />
              </div>
            )}
          </div>

          {/* Weak Areas */}
          <button
            type="button"
            disabled={weakCount === 0}
            onClick={() => {
              onReadyForQuiz({ module: "__weak__", discipline: null })
              onCloseMobile()
            }}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              weakCount > 0
                ? "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                : "text-muted-foreground/40 cursor-not-allowed"
            }`}
          >
            <ActivityIcon size={18} />
            <span className="flex-1 text-left">Weak Areas</span>
            {weakCount > 0 && (
              <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive tabular-nums">
                {weakCount}
              </span>
            )}
          </button>

          {/* Admin-only items */}
          {isAdmin && (
            <>
              <div className="my-1 h-px bg-sidebar-border/60" />
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                Admin
              </p>

              <NavButton
                active={screen === "question-editor"}
                onClick={() => nav("question-editor")}
                icon={<DatabaseIcon size={18} />}
                label="Question Editor"
                badge="Admin"
                badgeColor="amber"
              />

              <NavButton
                active={screen === "broadcast"}
                onClick={() => nav("broadcast")}
                icon={<MegaphoneIcon size={18} />}
                label="Broadcast"
                badge="Admin"
                badgeColor="amber"
              />
            </>
          )}

          <div className="my-1 h-px bg-sidebar-border/60" />

          <button
            type="button"
            onClick={() => { onOpenThemes(); onCloseMobile() }}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <PaletteIcon size={18} />
            Themes
          </button>
        </nav>
      </div>

      {/* Bottom section — always visible */}
      <div className="shrink-0 flex flex-col gap-3 pt-2">
        {/* Admin badge or login button */}
        {isAdmin ? (
          <div className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2">
            <div className="flex items-center gap-2">
              <DatabaseIcon size={14} className="text-amber-600" />
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Admin Mode</span>
            </div>
            <button
              type="button"
              onClick={logoutAdmin}
              className="rounded-lg px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-500/20 transition-colors"
            >
              Exit
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="flex items-center gap-2 rounded-xl border border-sidebar-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            <DatabaseIcon size={13} />
            Admin Login
          </button>
        )}

        {/* User card */}
        <div className="flex items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
            <UserIcon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.name ?? "Clinician"}</p>
            <p className="text-xs text-muted-foreground">{cloudEnabled ? "☁ Synced" : "Saving locally…"}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={signOutUser}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOutIcon size={18} />
          Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">{content}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
          />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[80%] border-r border-sidebar-border bg-sidebar shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  )
}

// ── Reusable nav button ──────────────────────────────────────────────────────
function NavButton({
  active, onClick, icon, label, badge, badgeColor = "amber",
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  badge?: string
  badgeColor?: "amber" | "sky"
}) {
  const amber = badgeColor === "amber"
  const activeClass = amber
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 shadow-sm ring-1 ring-amber-400/30"
    : "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
  const idleClass = amber
    ? "text-amber-700/80 dark:text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400"
    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? activeClass : idleClass}`}
    >
      {icon}
      {label}
      {badge && !active && (
        <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${amber ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-sky-500/15 text-sky-700"}`}>
          {badge}
        </span>
      )}
    </button>
  )
}
