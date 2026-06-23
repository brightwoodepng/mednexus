"use client"

import { useApp } from "@/contexts/app-context"
import {
  StethoscopeIcon,
  LayoutDashboardIcon,
  UserIcon,
  PaletteIcon,
  LogOutIcon,
  XIcon,
  DatabaseIcon,
} from "@/components/icons"
import type { Screen } from "@/lib/view"

interface SidebarProps {
  screen: Screen
  onNavigate: (screen: Screen) => void
  onOpenThemes: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

const NAV_ITEMS: { id: Screen; label: string; icon: typeof LayoutDashboardIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { id: "profile", label: "Profile & History", icon: UserIcon },
  { id: "question-editor", label: "Question Editor", icon: DatabaseIcon },
]

export function Sidebar({ screen, onNavigate, onOpenThemes, mobileOpen, onCloseMobile }: SidebarProps) {
  const { user, cloudEnabled, signOutUser } = useApp()

  const content = (
    <div className="flex h-full flex-col gap-2 p-4">
      {/* Brand */}
      <div className="mb-4 flex items-center justify-between px-2 pt-2">
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

      {/* Primary nav */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = screen === item.id
          const Icon = item.icon
          const isEditor = item.id === "question-editor"
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavigate(item.id)
                onCloseMobile()
              }}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? isEditor
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 shadow-sm ring-1 ring-amber-400/30"
                    : "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : isEditor
                    ? "text-amber-700/80 dark:text-amber-400/80 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Icon size={18} />
              {item.label}
              {isEditor && !active && (
                <span className="ml-auto rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Admin
                </span>
              )}
            </button>
          )
        })}

        <div className="my-1 h-px bg-sidebar-border/60" />

        <button
          type="button"
          onClick={() => {
            onOpenThemes()
            onCloseMobile()
          }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <PaletteIcon size={18} />
          Themes
        </button>
      </nav>

      <div className="mt-auto flex flex-col gap-3">
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
