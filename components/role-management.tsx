"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, GraduationCap, Search, ShieldCheck, UserCog } from "lucide-react"

type Role = "STUDENT" | "ADMIN" | "SUPER_ADMIN"
type RoleFilter = "ADMINISTRATORS" | "ALL" | Role
type Permission = "manage_mcq_content" | "manage_theory_content" | "manage_assessments" | "manage_users" | "manage_broadcasts" | "manage_system"
type ManagedUser = { uid: string; name: string; index_number: string; role: Role; permission_overrides: Partial<Record<Permission, boolean>> }
type Draft = { role: Role; permissions: Partial<Record<Permission, boolean>> }

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
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ADMINISTRATORS")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError("")
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20", search, role: roleFilter })
      const response = await fetch(`/api/admin/roles?${params}`, { signal })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Unable to load access assignments.")
      setUsers(data.users); setPermissions(data.permissions); setBaselines(data.baselines); setTotal(data.pagination?.total ?? 0)
      setSelected((current) => data.users.some((item: ManagedUser) => item.uid === current) ? current : data.users[0]?.uid ?? "")
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(cause instanceof Error ? cause.message : "Unable to load access assignments.")
    } finally { setLoading(false) }
  }, [page, roleFilter, search])

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

  return <section className="max-w-7xl space-y-4 pb-20">
    <header className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><ShieldCheck size={20}/></span><h1 className="text-2xl font-bold tracking-tight">Roles &amp; Permissions</h1></header>
    {error ? <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
    {notice ? <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div> : null}

    <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-[minmax(0,1fr)_130px] lg:grid-cols-1">
          <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3"><Search size={15} className="text-muted-foreground"/><span className="sr-only">Search accounts</span><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search name or index" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"/></label>
          <label><span className="sr-only">Filter by role</span><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as RoleFilter); setPage(1) }} className={`${control} min-h-10 w-full`}><option value="ADMINISTRATORS">Administrators</option><option value="SUPER_ADMIN">Super admins</option><option value="ADMIN">Admins</option><option value="STUDENT">Students</option><option value="ALL">All accounts</option></select></label>
        </div>
        <div className="max-h-[600px] divide-y divide-border overflow-y-auto">{loading ? <p className="p-5 text-sm text-muted-foreground">Loading…</p> : users.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No matching accounts.</p> : users.map((item) => <button key={item.uid} onClick={() => setSelected(item.uid)} className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors ${selected === item.uid ? "bg-primary/10" : "hover:bg-muted/50"}`}><span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{item.name.slice(0,2).toUpperCase()}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.name}</b><span className="block truncate text-xs text-muted-foreground">{item.index_number}</span></span><span className="rounded-full bg-muted px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{roleLabels[item.role]}</span></button>)}</div>
        {total > 20 ? <div className="flex items-center justify-between border-t border-border p-3 text-xs"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="disabled:opacity-40">Previous</button><span>{page} / {Math.ceil(total/20)}</span><button disabled={page*20 >= total} onClick={() => setPage((value) => value + 1)} className="disabled:opacity-40">Next</button></div> : null}
      </aside>

      <main className="rounded-2xl border border-border bg-card p-4 sm:p-5">{user && draft ? <>
        <div className="grid items-end gap-4 border-b border-border pb-5 sm:grid-cols-[minmax(0,1fr)_240px]"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><UserCog size={19}/></span><div className="min-w-0"><h2 className="truncate font-bold">{user.name}</h2><p className="truncate text-xs text-muted-foreground">{user.index_number}</p></div></div><label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Role<select value={draft.role} disabled={user.role === "SUPER_ADMIN"} onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })} className={`${control} mt-1.5 w-full normal-case tracking-normal text-foreground`}><option value="STUDENT">Student</option><option value="ADMIN">Administrator</option><option value="SUPER_ADMIN">Super administrator</option></select></label></div>

        {draft.role === "STUDENT" ? <div className="grid min-h-56 place-items-center text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><GraduationCap size={23}/></span><h3 className="mt-3 font-bold">Learner access</h3><p className="mt-1 text-sm text-muted-foreground">Change the role to grant administrative access.</p></div></div> : <div className="mt-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Effective permissions</h3><span className="text-xs text-muted-foreground">{permissions.filter(effective).length} of {permissions.length} enabled</span></div><div className="grid gap-2 sm:grid-cols-2">{permissions.map((permission) => { const locked = draft.role === "SUPER_ADMIN"; const baseline = baselines[draft.role].includes(permission); const override = draft.permissions[permission]; const status = locked ? "Always on" : override === undefined ? (baseline ? "Role default" : "Not granted") : override ? "Custom grant" : "Custom removal"; return <label key={permission} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:bg-muted/30"><input type="checkbox" checked={effective(permission)} disabled={locked} onChange={(event) => setDraft({ ...draft, permissions: { ...draft.permissions, [permission]: event.target.checked } })} className="peer sr-only"/><span className="relative h-6 w-10 shrink-0 rounded-full bg-muted transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-disabled:opacity-60"/><span className="min-w-0 flex-1"><b className="block truncate text-sm">{permissionLabels[permission]}</b><span className="text-[11px] text-muted-foreground">{status}</span></span></label> })}</div></div>}
      </> : <div className="grid min-h-72 place-items-center text-center text-muted-foreground"><div><ShieldCheck className="mx-auto mb-3"/><p>Select an account to review access.</p></div></div>}</main>
    </div>

    {user && draft && dirty ? <div className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-2xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur lg:left-[260px]"><span className="pl-2 text-sm font-semibold">Unsaved access changes</span><button disabled={saving} onClick={() => void save()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><Check size={16}/>{saving ? "Saving…" : "Confirm changes"}</button></div> : null}
  </section>
}
