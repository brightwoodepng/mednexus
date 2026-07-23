"use client"

import Link from "next/link"
import { Menu, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { useState } from "react"

type Capability = "mcq" | "assessments" | "users" | "system" | "broadcasts"
type AdminShellProps = { capabilities: Record<Capability, boolean>; children: React.ReactNode }

const groups: Array<{ label?: string; items: Array<{ href?: string; label: string; capability?: Capability; soon?: boolean }> }> = [
  { items: [{ href: "/admin", label: "Dashboard" }] },
  { label: "CONTENT MANAGEMENT", items: [
    { href: "/admin/mcq", label: "MCQ Bank", capability: "mcq" },
    { label: "Theory Vault — Coming soon", soon: true }, { label: "OSCE Simulator — Coming soon", soon: true },
  ] },
  { label: "ASSESSMENTS", items: [{ href: "/admin/assessments", label: "Live Assessments", capability: "assessments" }, { href: "/admin/results", label: "Assessment Results", capability: "assessments" }] },
  { label: "USER MANAGEMENT", items: [{ href: "/admin/users", label: "Users", capability: "users" }, { href: "/admin/roles", label: "Roles & Permissions", capability: "system" }] },
  { label: "SYSTEM", items: [
    { href: "/admin/modules", label: "Modules & Disciplines", capability: "mcq" },
    { href: "/admin/imports-exports", label: "Imports & Exports", capability: "mcq" },
    { href: "/admin/notifications", label: "Notifications", capability: "broadcasts" },
    { href: "/admin/settings", label: "System Settings", capability: "system" },
  ] },
]

export function AdminShell({ capabilities, children }: AdminShellProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const navigation = <nav aria-label="Admin navigation" className="space-y-6">
    {groups.map((group, groupIndex) => <section key={group.label ?? "dashboard"}>
      {group.label && <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500">{group.label}</p>}
      <div className="space-y-0.5">{group.items.map((item) => {
        if (item.soon) return <span key={item.label} aria-disabled="true" className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm text-slate-600">{item.label}</span>
        if (item.capability && !capabilities[item.capability]) return null
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href!)
        return <Link onClick={() => setOpen(false)} key={item.href} href={item.href!} aria-current={active ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 ${active ? "bg-cyan-400/15 text-cyan-200" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>{item.label}</Link>
      })}</div>
    </section>)}
  </nav>

  return <div className="min-h-screen bg-slate-950 text-slate-100">
    <button type="button" aria-label="Open admin navigation" onClick={() => setOpen(true)} className="fixed left-4 top-4 z-30 rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-100 shadow-lg md:hidden"><Menu size={20} /></button>
    {open && <button aria-label="Close admin navigation overlay" className="fixed inset-0 z-30 bg-slate-950/70 md:hidden" onClick={() => setOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-900/95 p-5 shadow-2xl transition-transform md:translate-x-0 md:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="mb-8 flex items-center justify-between"><Link href="/admin" className="text-lg font-bold tracking-tight text-white">MedNexus <span className="text-cyan-400">Console</span></Link><button type="button" aria-label="Close admin navigation" onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:text-white md:hidden"><X size={20} /></button></div>
      {navigation}
      <Link href="/" className="mt-auto rounded-lg border border-cyan-400/30 px-3 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/10 focus:outline-none focus:ring-2 focus:ring-cyan-400">← Return to Learner Workspace</Link>
    </aside>
    <main className="min-h-screen px-4 pb-10 pt-20 md:ml-72 md:px-8 md:pt-8">{children}</main>
  </div>
}
