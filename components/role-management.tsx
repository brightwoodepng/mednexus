"use client"

import { useCallback, useEffect, useState } from "react"

type Role = "STUDENT" | "ADMIN" | "SUPER_ADMIN"
type Permission = "manage_mcq_content" | "manage_theory_content" | "manage_assessments" | "manage_users" | "manage_broadcasts" | "manage_system"
type ManagedUser = { uid: string; name: string; index_number: string; role: Role; permission_overrides: Partial<Record<Permission, boolean>> }

const labels: Record<Permission, string> = {
  manage_mcq_content: "MCQ content", manage_theory_content: "Theory content",
  manage_assessments: "Assessments", manage_users: "Users",
  manage_broadcasts: "Broadcasts", manage_system: "System administration",
}

export default function RoleManagement() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const response = await fetch(`/api/admin/roles?page=${page}&pageSize=20`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to load role assignments")
      setUsers(data.users); setPermissions(data.permissions); setTotal(data.pagination?.total ?? data.users.length)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load role assignments") }
    finally { setLoading(false) }
  }, [page])
  useEffect(() => { void load() }, [load])

  async function save(uid: string, update: { role?: Role; permissions?: Partial<Record<Permission, boolean>> }) {
    setSaving(uid); setError("")
    try {
      if (!window.confirm("Confirm this role or permission change? This action is audited.")) return
      const response = await fetch("/api/admin/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid, ...update, confirmed: true }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to save changes")
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save changes") }
    finally { setSaving(null) }
  }

  return <section className="max-w-6xl">
    <p className="text-sm text-primary">SYSTEM ACCESS</p>
    <h1 className="mt-2 text-3xl font-bold">Roles &amp; permissions</h1>
    <p className="mt-3 max-w-3xl text-sm text-muted-foreground">SUPER_ADMIN always has every permission. ADMIN receives the standard operational baseline; an explicit setting below grants or removes an individual capability.</p>
    {error && <p role="alert" className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {loading ? <p className="mt-8 text-muted-foreground">Loading access assignments…</p> : <div className="mt-8 overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="p-4">User</th><th className="p-4">Role</th>{permissions.map((permission) => <th key={permission} className="p-4 font-medium">{labels[permission]}</th>)}</tr></thead>
      <tbody>{users.map((user) => <tr key={user.uid} className="border-t border-border align-top"><td className="p-4"><p className="font-semibold">{user.name}</p><p className="mt-1 text-xs text-muted-foreground">{user.index_number}</p></td><td className="p-4"><select aria-label={`Role for ${user.name}`} value={user.role} disabled={saving === user.uid} onChange={(event) => void save(user.uid, { role: event.target.value as Role })} className="rounded-lg border border-border bg-background px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"><option>STUDENT</option><option>ADMIN</option><option>SUPER_ADMIN</option></select></td>{permissions.map((permission) => { const override = user.permission_overrides[permission]; const locked = user.role === "SUPER_ADMIN"; return <td key={permission} className="p-4"><label className="flex cursor-pointer items-center gap-2"><input className="accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" type="checkbox" checked={locked ? true : override ?? false} disabled={locked || saving === user.uid} onChange={(event) => void save(user.uid, { permissions: { [permission]: event.target.checked } })} /><span className="text-xs text-muted-foreground">{locked ? "Always" : override === undefined ? "Baseline" : override ? "Granted" : "Removed"}</span></label></td> })}</tr>)}</tbody></table>
    </div>}
    {!loading && total > 20 && <div className="mt-4 flex items-center justify-between text-sm"><span className="text-muted-foreground">Page {page} of {Math.ceil(total / 20)}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage(value => value - 1)} className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">Previous</button><button disabled={page * 20 >= total} onClick={() => setPage(value => value + 1)} className="rounded-lg border border-border px-3 py-2 disabled:opacity-40">Next</button></div></div>}
  </section>
}
