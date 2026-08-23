"use client"

import { type ReactNode } from "react"
import Link from "next/link"
import { ChevronLeftIcon, XIcon } from "@/components/icons"

export function SidebarFrame({ collapsed, mobileOpen, onCloseMobile, children, collapsedChildren, glass = false }: { collapsed: boolean; mobileOpen: boolean; onCloseMobile: () => void; children: ReactNode; collapsedChildren: ReactNode; glass?: boolean }) {
  const panelClass = glass ? "glass-sidebar" : "bg-sidebar border-r border-sidebar-border"
  return <>
    <aside className={`hidden shrink-0 md:block transition-[width] duration-200 ${panelClass} ${collapsed ? "w-14" : "w-64"}`}>{collapsed ? collapsedChildren : children}</aside>
    {mobileOpen && <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button type="button" aria-label="Close menu" onClick={onCloseMobile} className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
      <div className={`absolute left-0 top-0 h-full w-72 max-w-[80%] shadow-2xl animate-in slide-in-from-left duration-200 ${panelClass}`} style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>{children}</div>
    </div>}
  </>
}

export function SidebarHeader({ title, icon, onCollapse, onCloseMobile }: { title?: string; icon?: ReactNode; onCollapse: () => void; onCloseMobile: () => void }) {
  return <div className={`mb-1 flex items-center px-1 pt-1 shrink-0 ${title ? "justify-between" : "justify-end"}`}>
    {title && <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--hub-accent)]">{icon}{title}</span>}
    <div className="flex items-center gap-1">
      <button type="button" onClick={onCollapse} className="hidden rounded-xl p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:flex" aria-label="Collapse sidebar"><ChevronLeftIcon size={18} /></button>
      <button type="button" onClick={onCloseMobile} className="rounded-xl p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:hidden" aria-label="Close menu"><XIcon size={20} /></button>
    </div>
  </div>
}

export function SidebarNavButton({ active, onClick, icon, label, badge, trailing, glass = false, adminBadge, liveDot = false }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; badge?: string; trailing?: ReactNode; glass?: boolean; adminBadge?: string; liveDot?: boolean }) {
  const stateClass = active ? (glass ? "glass-pill-active text-sidebar-accent-foreground" : "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border") : (glass ? "text-sidebar-foreground/70 glass-pill-hover" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground")
  return <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`flex w-full min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${stateClass}`}>
    {icon}<span className="flex-1 text-left">{label}</span>{liveDot && <span className="relative flex h-2 w-2 shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"/><span className="relative inline-flex h-2 w-2 rounded-full bg-primary"/></span>}{badge && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-sidebar-foreground/70 tabular-nums">{badge}</span>}{adminBadge && <span className="ml-auto rounded-full border border-warning/30 bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-warning">{adminBadge}</span>}{trailing}
  </button>
}

/** A navigational counterpart to SidebarNavButton for route-based workspaces. */
export function SidebarNavLink({ active, href, onClick, icon, label, trailing, prefetch = true }: { active: boolean; href: string; onClick?: () => void; icon: ReactNode; label: string; trailing?: ReactNode; prefetch?: boolean }) {
  const stateClass = active
    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border"
    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"

  return <Link href={href} prefetch={prefetch} onClick={onClick} aria-current={active ? "page" : undefined} className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${stateClass}`}>
    {icon}<span className="flex-1 text-left">{label}</span>{trailing}
  </Link>
}

export function SidebarIconButton({ active, onClick, label, children, trailing, glass = false, liveDot = false }: { active: boolean; onClick: () => void; label: string; children: ReactNode; trailing?: ReactNode; glass?: boolean; liveDot?: boolean }) {
  const stateClass = active ? (glass ? "glass-pill-active text-sidebar-accent-foreground" : "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border") : (glass ? "text-sidebar-foreground/70 glass-pill-hover" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")
  return <button type="button" onClick={onClick} title={label} aria-label={label} aria-current={active ? "page" : undefined} className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${stateClass}`}>{children}{liveDot && <span className="absolute right-1 top-1 flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"/><span className="relative inline-flex h-2 w-2 rounded-full bg-primary"/></span>}{trailing}</button>
}

export function SidebarDivider({ compact = false }: { compact?: boolean }) { return <div className={`${compact ? "my-2 w-6" : "my-1.5 mx-1"} h-px bg-sidebar-border/60`} /> }
export function SidebarGroup({ label, children }: { label?: string; children: ReactNode }) { return <div className="flex flex-col gap-0.5">{label && <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">{label}</p>}{children}</div> }
export function SidebarCollapsedRail({ onExpand, children, footer }: { onExpand: () => void; children: ReactNode; footer?: ReactNode }) { return <div className="flex h-full flex-col items-center gap-0.5 px-1.5 py-4"><button type="button" onClick={onExpand} className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-sidebar-border text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label="Expand sidebar"><ChevronLeftIcon size={18} className="rotate-180" /></button>{children}{footer && <div className="mt-auto flex flex-col items-center gap-1">{footer}</div>}</div> }

export function SidebarProfileFooter({ children }: { children: ReactNode }) { return <div className="w-full rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 text-left">{children}</div> }
