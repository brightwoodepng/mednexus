"use client"
import { useEffect, useRef } from "react"
import Link from "next/link"
import { useApp } from "@/contexts/app-context"
import { useEconomy } from "@/contexts/economy-context"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { NotificationBell } from "@/components/notification-bell"
import { LayoutDashboardIcon, LogOutIcon, UserIcon } from "@/components/icons"
import { STORE_ITEMS } from "@/lib/economy"
import { canShowAdminConsoleLink } from "@/lib/admin-console-link"
import type { Screen } from "@/lib/view"

export function LearnerHeaderActions({ onNavigate, onOpenAppearance }: { onNavigate: (screen: Screen) => void; onOpenAppearance: () => void }) {
  const { user, signOutUser } = useApp()
  const { equippedCosmetics } = useEconomy()
  const { accountMenuOpen, setAccountMenuOpen } = useApplicationShell()
  const accountRef = useRef<HTMLDivElement>(null)
  const name = user?.name || "Guest"
  const role = user?.serverRole === "SUPER_ADMIN" ? "Super admin" : user?.serverRole === "ADMIN" ? "Admin" : user?.role === "user" ? "Student" : "Guest"
  const avatar = STORE_ITEMS.find(item => item.id === equippedCosmetics.avatar)
  useEffect(() => {
    if (!accountMenuOpen) return
    const close = (event: MouseEvent) => { if (accountRef.current && !accountRef.current.contains(event.target as Node)) setAccountMenuOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [accountMenuOpen, setAccountMenuOpen])
  return <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
    <button data-tutorial-anchor="header-appearance" type="button" onClick={onOpenAppearance} className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-muted" aria-label="Appearance"><span aria-hidden="true">🎨</span></button>
    <div data-tutorial-anchor="header-notifications"><NotificationBell borderless realistic /></div>
    <div ref={accountRef} className="relative" data-tutorial-anchor="header-account-menu">
      <button type="button" onClick={() => setAccountMenuOpen(!accountMenuOpen)} aria-expanded={accountMenuOpen} aria-haspopup="menu" aria-label="Open account menu" title={name + " · " + role} className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-left transition-colors hover:bg-muted md:w-auto md:min-w-0 md:gap-2 md:p-1.5 md:pr-3">
        <span aria-hidden="true" className="text-xl md:hidden">👤</span>
        <span className="hidden h-7 w-7 md:flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-primary-foreground">{avatar?.imagePath ? <img src={avatar.imagePath} alt={avatar.name} className="h-full w-full object-cover" /> : <span aria-hidden="true">👤</span>}</span>
        <span className="hidden min-w-0 max-w-36 md:block"><span className="block truncate text-xs font-semibold leading-tight">{name}</span><span className="block truncate text-[9px] leading-tight text-muted-foreground">{role}</span></span>
      </button>
      {accountMenuOpen && <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">
        <button type="button" role="menuitem" onClick={() => { onNavigate("profile"); setAccountMenuOpen(false) }} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold hover:bg-muted"><UserIcon size={16} />Profile & account</button>
        {canShowAdminConsoleLink(user) && <div className="my-1 border-t border-border pt-1"><Link role="menuitem" href="/admin" onClick={() => setAccountMenuOpen(false)} className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10"><LayoutDashboardIcon size={16} />Open Admin Console</Link></div>}
        <button type="button" role="menuitem" onClick={signOutUser} className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold text-destructive hover:bg-destructive/10"><LogOutIcon size={16} />Sign out</button>
      </div>}
    </div>
  </div>
}
