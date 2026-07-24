"use client"

import Link from "next/link"
import {
  Bell, BookOpen, ChevronLeft, ClipboardList, Database, FileInput, GraduationCap,
  LayoutDashboard, Menu, MonitorCog, Settings, ShieldCheck, Users, X,
} from "lucide-react"
import { usePathname } from "next/navigation"
import { useState, type ComponentType } from "react"

type Capability = "mcq" | "assessments" | "users" | "system" | "broadcasts"
type AdminShellProps = { capabilities: Record<Capability, boolean>; children: React.ReactNode }
type AdminIcon = ComponentType<{ size?: number; className?: string }>

type AdminItem = { href?: string; label: string; icon: AdminIcon; capability?: Capability; soon?: boolean }
type AdminGroup = { label?: string; items: AdminItem[] }

const groups: AdminGroup[] = [
  { items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Content management", items: [
    { href: "/admin/mcq", label: "MCQ Bank", icon: Database, capability: "mcq" },
    { label: "Theory Vault", icon: BookOpen, soon: true },
    { label: "OSCE Simulator", icon: GraduationCap, soon: true },
  ] },
  { label: "Assessments", items: [
    { href: "/admin/assessments", label: "Live Assessments", icon: ClipboardList, capability: "assessments" },
    { href: "/admin/results", label: "Assessment Results", icon: FileInput, capability: "assessments" },
  ] },
  { label: "User management", items: [
    { href: "/admin/users", label: "Users", icon: Users, capability: "users" },
    { href: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, capability: "system" },
  ] },
  { label: "System", items: [
    { href: "/admin/modules", label: "Modules & Disciplines", icon: BookOpen, capability: "mcq" },
    { href: "/admin/imports-exports", label: "Imports & Exports", icon: FileInput, capability: "mcq" },
    { href: "/admin/notifications", label: "Notifications", icon: Bell, capability: "broadcasts" },
    { href: "/admin/settings", label: "System Settings", icon: Settings, capability: "system" },
    { href: "/admin/system/question-bank", label: "Question Bank Source", icon: MonitorCog, capability: "system" },
  ] },
]

/**
 * Administration uses the learner shell's semantic theme language, but keeps
 * a separate information architecture and never exposes learner navigation.
 */
export function AdminShell({ capabilities, children }: AdminShellProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const navigation = (
    <nav aria-label="Admin navigation" className="space-y-5">
      {groups.map((group) => (
        <section key={group.label ?? "dashboard"}>
          {group.label && <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/50">{group.label}</p>}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon
              if (item.soon) return (
                <span key={item.label} aria-disabled="true" title="Coming soon" className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/40">
                  <Icon size={18} /><span className="min-w-0 flex-1 truncate">{item.label}</span><span className="text-[9px] font-bold uppercase tracking-wide">Soon</span>
                </span>
              )
              if (item.capability && !capabilities[item.capability]) return null
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href!)
              return (
                <Link onClick={() => setOpen(false)} key={item.href} href={item.href!} aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${active ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"}`}>
                  <Icon size={18} /><span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <button type="button" aria-label="Open admin navigation" onClick={() => setOpen(true)} className="fixed left-3 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"><Menu size={20} /></button>
      {open && <button type="button" aria-label="Close admin navigation overlay" className="fixed inset-0 z-30 bg-foreground/30 backdrop-blur-sm md:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-40 flex h-dvh w-72 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground shadow-2xl transition-transform md:translate-x-0 md:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="mb-3 flex shrink-0 items-center justify-between px-1 pt-1">
          <Link href="/admin" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"><ShieldCheck size={19} /></span>
            <span><span className="block text-sm font-bold tracking-tight">MedNexus</span><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/55">Admin Console</span></span>
          </Link>
          <button type="button" aria-label="Close admin navigation" onClick={() => setOpen(false)} className="rounded-xl p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:hidden"><X size={19} /></button>
        </div>

        <div className="mb-3 shrink-0 rounded-xl border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-foreground/50">Workspace</p>
          <p className="mt-0.5 text-sm font-semibold">Platform administration</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">{navigation}</div>

        <div className="mt-3 shrink-0 border-t border-sidebar-border pt-3">
          <Link href="/" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><ChevronLeft size={18} />Return to Learner Workspace</Link>
        </div>
      </aside>

      <main className="min-h-screen px-4 pb-10 pt-20 md:ml-72 md:px-8 md:py-8 lg:px-10">{children}</main>
    </div>
  )
}
