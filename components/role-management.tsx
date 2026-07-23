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

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const response = await fetch("/api/admin/roles")
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to load role assignments")
      setUsers(data.users); setPermissions(data.permissions)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load role assignments") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function save(uid: string, update: { role?: Role; permissions?: Partial<Record<Permission, boolean>> }) {
    setSaving(uid); setError("")
    try {
      const response = await fetch("/api/admin/roles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid, ...update }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Unable to save changes")
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save changes") }
    finally { setSaving(null) }
  }

  return <section className="max-w-6xl">
    <p className="text-sm text-cyan-300">SYSTEM ACCESS</p>
    <h1 className="mt-2 text-3xl font-bold">Roles &amp; permissions</h1>
    <p className="mt-3 max-w-3xl text-sm text-slate-400">SUPER_ADMIN always has every permission. ADMIN receives the standard operational baseline; an explicit setting below grants or removes an individual capability.</p>
    {error && <p role="alert" className="mt-5 rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-200">{error}</p>}
    {loading ? <p className="mt-8 text-slate-400">Loading access assignments…</p> : <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-900 text-slate-400"><tr><th className="p-4">User</th><th className="p-4">Role</th>{permissions.map((permission) => <th key={permission} className="p-4 font-medium">{labels[permission]}</th>)}</tr></thead>
      <tbody>{users.map((user) => <tr key={user.uid} className="border-t border-slate-800 align-top"><td className="p-4"><p className="font-semibold">{user.name}</p><p className="mt-1 text-xs text-slate-500">{user.index_number}</p></td><td className="p-4"><select aria-label={`Role for ${user.name}`} value={user.role} disabled={saving === user.uid} onChange={(event) => void save(user.uid, { role: event.target.value as Role })} className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5"><option>STUDENT</option><option>ADMIN</option><option>SUPER_ADMIN</option></select></td>{permissions.map((permission) => { const override = user.permission_overrides[permission]; const locked = user.role === "SUPER_ADMIN"; return <td key={permission} className="p-4"><label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={locked ? true : override ?? false} disabled={locked || saving === user.uid} onChange={(event) => void save(user.uid, { permissions: { [permission]: event.target.checked } })} /><span className="text-xs text-slate-400">{locked ? "Always" : override === undefined ? "Baseline" : override ? "Granted" : "Removed"}</span></label></td> })}</tr>)}</tbody></table>
    </div>}
  </section>
}
