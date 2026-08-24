"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Search, ShieldCheck, UserCog } from "lucide-react"

type Role = "STUDENT" | "ADMIN" | "SUPER_ADMIN"
type Permission = "manage_mcq_content" | "manage_theory_content" | "manage_assessments" | "manage_users" | "manage_broadcasts" | "manage_system"
type ManagedUser = { uid: string; name: string; index_number: string; role: Role; permission_overrides: Partial<Record<Permission, boolean>> }
type Draft = { role: Role; permissions: Partial<Record<Permission, boolean>> }

const permissionGroups: Array<{ label: string; permissions: Permission[] }> = [
  { label: "Content", permissions: ["manage_mcq_content", "manage_theory_content"] },
  { label: "Operations", permissions: ["manage_assessments", "manage_users", "manage_broadcasts"] },
  { label: "Platform", permissions: ["manage_system"] },
]
const permissionLabels: Record<Permission, string> = {
  manage_mcq_content: "MCQ content", manage_theory_content: "Theory content", manage_assessments: "Assessments",
  manage_users: "User management", manage_broadcasts: "Notifications", manage_system: "System administration",
}
const roleLabels: Record<Role, string> = { STUDENT: "Student", ADMIN: "Administrator", SUPER_ADMIN: "Super admin" }
const control = "min-h-11 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25"

export default function RoleManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [baselines, setBaselines] = useState<Record<Role, Permission[]>>({ STUDENT: [], ADMIN: [], SUPER_ADMIN: [] })
  const [selected, setSelected] = useState("")
  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", search })
      const response = await fetch(`/api/admin/roles?${params}`, { signal })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Unable to load access assignments.")
      setUsers(data.users); setPermissions(data.permissions); setBaselines(data.baselines); setTotal(data.pagination?.total ?? 0)
      setSelected((current) => data.users.some((item: ManagedUser) => item.uid === current) ? current : data.users[0]?.uid ?? "")
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Unable to load access assignments.")
    } finally { setLoading(false) }
  }, [page, search])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(() => void load(controller.signal), 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [load])

  const user = users.find((item) => item.uid === selected)
  useEffect(() => { if (user) setDraft({ role: user.role, permissions: { ...user.permission_overrides } }) }, [user])
  const dirty = useMemo(() => Boolean(user && draft && (draft.role !== user.role || JSON.stringify(draft.permissions) !== JSON.stringify(user.permission_overrides))), [draft, user])
  const effective = (permission: Permission) => draft?.role === "SUPER_ADMIN" || (draft?.permissions[permission] ?? baselines[draft?.role ?? "STUDENT"].includes(permission))

  const save = async () => {
    if (!user || !draft || !dirty) return
    setSaving(true); setError(""); setNotice("")
    try {
      const response = await fetch("/api/admin/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid: user.uid, role: draft.role, permissions: draft.permissions, confirmed: true }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Unable to save access changes.")
      setNotice(`Access updated for ${user.name}.`); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save access changes.") }
    finally { setSaving(false) }
  }

  return <section className="max-w-7xl space-y-5">
    <header className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary"><ShieldCheck size={22}/></span><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Roles &amp; Permissions</h1></header>
    {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
    {notice ? <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div> : null}
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-3"><label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3"><Search size={16} className="text-muted-foreground"/><span className="sr-only">Search administrators</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search name or index" className="min-h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"/></label></div>
        <div className="max-h-[620px] divide-y divide-border overflow-y-auto">{loading ? <p className="p-5 text-sm text-muted-foreground">Loading people…</p> : users.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No matching people.</p> : users.map((item) => <button key={item.uid} onClick={() => setSelected(item.uid)} className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${selected === item.uid ? "bg-primary/10" : "hover:bg-muted/50"}`}><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-sm font-bold">{item.name.slice(0,2).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.name}</b><span className="block truncate text-xs text-muted-foreground">{item.index_number}</span></span><span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{roleLabels[item.role]}</span></button>)}</div>
        {total > 20 ? <div className="flex items-center justify-between border-t border-border p-3 text-xs"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="disabled:opacity-40">Previous</button><span>{page} / {Math.ceil(total/20)}</span><button disabled={page*20 >= total} onClick={() => setPage((value) => value + 1)} className="disabled:opacity-40">Next</button></div> : null}
      </aside>
      <main className="rounded-2xl border border-border bg-card p-4 sm:p-6">{user && draft ? <>
        <div className="flex items-center gap-3 border-b border-border pb-5"><span className="rounded-xl bg-primary/10 p-3 text-primary"><UserCog size={22}/></span><div className="min-w-0"><h2 className="truncate font-bold">{user.name}</h2><p className="truncate text-xs text-muted-foreground">{user.index_number}</p></div></div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]"><label className="block text-sm font-semibold">Role<select value={draft.role} disabled={user.role === "SUPER_ADMIN"} onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })} className={`${control} mt-2 w-full`}><option value="STUDENT">Student</option><option value="ADMIN">Administrator</option><option value="SUPER_ADMIN">Super administrator</option></select></label>
          <div className="space-y-4"><h3 className="text-sm font-bold">Effective permissions</h3>{permissionGroups.map((group) => { const available = group.permissions.filter((permission) => permissions.includes(permission)); if (available.length === 0) return null; return <fieldset key={group.label} className="overflow-hidden rounded-xl border border-border"><legend className="sr-only">{group.label} permissions</legend><div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.label}</div><div className="divide-y divide-border">{available.map((permission) => { const locked = draft.role === "SUPER_ADMIN"; const baseline = baselines[draft.role].includes(permission); const override = draft.permissions[permission]; const status = locked ? "Always on" : override === undefined ? (baseline ? "Role default" : "Not granted") : override ? "Custom grant" : "Custom removal"; return <label key={permission} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/25"><input type="checkbox" checked={effective(permission)} disabled={locked} onChange={(event) => setDraft({ ...draft, permissions: { ...draft.permissions, [permission]: event.target.checked } })} className="size-4 accent-primary"/><span className="min-w-0 flex-1 text-sm font-semibold">{permissionLabels[permission]}</span><span className="text-xs text-muted-foreground">{status}</span></label> })}</div></fieldset> })}</div>
        </div>
        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between"><span className="text-xs text-muted-foreground">{dirty ? "Unsaved access changes" : "No pending changes"}</span><button disabled={!dirty || saving} onClick={() => void save()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-40"><Check size={16}/>{saving ? "Saving…" : "Confirm changes"}</button></div>
      </> : <div className="grid min-h-80 place-items-center text-center text-muted-foreground"><div><ShieldCheck className="mx-auto mb-3"/><p>Select a person to review access.</p></div></div>}</main>
    </div>
  </section>
}
