"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdmin } from "@/contexts/admin-context"
import { ALL_LEVELS } from "@/lib/levels"

// ── Types ─────────────────────────────────────────────────────────────────────

interface RegisteredUser {
  uid: string
  name: string
  level: string
  index_number: string
  status: string
  must_change_password: boolean
  created_at: string
}

interface GuestUser {
  uid: string
  name: string
  class_level: string
  created_at: string
  expires_at: string
  last_active: string
}

// ── Small icons ───────────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })
}

function fmtRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 2) return "Just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 7) return `${days}d ago`
  return fmtDate(iso)
}

function exportCSV(filename: string, rows: Record<string, string>[]) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// ── Modals ────────────────────────────────────────────────────────────────────

function OtpModal({ otp, userName, onClose }: { otp: string; userName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(otp).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}>
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3 className="mb-1 font-bold text-lg">One-Time Password</h3>
        <p className="mb-4 text-sm text-muted-foreground">Share this OTP with <span className="font-semibold text-foreground">{userName}</span>. They will be prompted to set a new password on their next login.</p>
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
          <span className="flex-1 text-center text-3xl font-bold tracking-[0.35em] text-foreground font-mono">{otp}</span>
          <button type="button" onClick={copy} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground text-center">This OTP is valid until the user logs in with it.</p>
        <button type="button" onClick={onClose} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">Done</button>
      </div>
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel, busy }: { message: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
        </div>
        <h3 className="mb-2 font-bold text-lg">Are you sure?</h3>
        <p className="mb-5 text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-white hover:bg-destructive/90 transition-colors disabled:opacity-50">
            {busy ? <SpinnerIcon /> : null}
            {busy ? "Deleting…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditLevelModal({
  user,
  onSave,
  onCancel,
  busy,
}: {
  user: RegisteredUser
  onSave: (uid: string, level: string) => void
  onCancel: () => void
  busy: boolean
}) {
  const [level, setLevel] = useState(user.level || "")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </div>
        <h3 className="mb-1 font-bold text-lg">Edit Level</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Assign a new class level for <span className="font-semibold text-foreground">{user.name}</span>.
        </p>
        <div className="mb-5 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Class Level</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            <option value="" disabled>Select level…</option>
            {ALL_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50">Cancel</button>
          <button
            type="button"
            onClick={() => onSave(user.uid, level)}
            disabled={busy || !level}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {busy ? <SpinnerIcon /> : null}
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Registered Students Table ──────────────────────────────────────────────────

function RegisteredTable() {
  const { adminToken } = useAdmin()
  const [users, setUsers] = useState<RegisteredUser[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [sort, setSort] = useState("created_at")
  const [order, setOrder] = useState("desc")
  const [otpModal, setOtpModal] = useState<{ otp: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<RegisteredUser | null>(null)
  const [editLevelUser, setEditLevelUser] = useState<RegisteredUser | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (search) p.set("search", search)
      if (statusFilter) p.set("status", statusFilter)
      p.set("sort", sort)
      p.set("order", order)
      const res = await fetch(`/api/admin/users?${p}`, { headers: { "x-admin-token": adminToken } })
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users)
        setTotalCount(data.total)
      }
    } catch {}
    setLoading(false)
  }, [adminToken, search, statusFilter, sort, order])

  useEffect(() => {
    const t = setTimeout(fetchUsers, 300)
    return () => clearTimeout(t)
  }, [fetchUsers])

  async function doAction(uid: string, action: string, extra?: Record<string, string>) {
    if (!adminToken) return
    setActionLoading(uid + action)
    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (res.ok) {
        if (action === "reset-password" && data.otp) {
          const user = users.find((u) => u.uid === uid)
          setOtpModal({ otp: data.otp, name: user?.name ?? "User" })
        }
        if (action === "edit-level") setEditLevelUser(null)
        await fetchUsers()
      }
    } catch {}
    setActionLoading(null)
  }

  async function doDelete(uid: string) {
    if (!adminToken) return
    setActionLoading(uid + "delete")
    try {
      await fetch(`/api/admin/users/${uid}`, { method: "DELETE", headers: { "x-admin-token": adminToken } })
      await fetchUsers()
    } catch {}
    setActionLoading(null)
    setConfirmDelete(null)
  }

  function handleExport() {
    const rows = users.map((u) => ({
      Name: u.name,
      "Class Level": u.level || "",
      "Index Number": u.index_number,
      Status: u.status,
      "Registration Date": fmtDate(u.created_at),
    }))
    exportCSV(`registered-students-${Date.now()}.csv`, rows)
  }

  const approved = users.filter((u) => u.status === "approved").length
  const pending = users.filter((u) => u.status === "pending").length

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Approved</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{approved}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pending</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{pending}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><SearchIcon /></span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or index number…"
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="">All Status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
        </select>
        <select
          value={`${sort}-${order}`}
          onChange={(e) => { const [s, o] = e.target.value.split("-"); setSort(s); setOrder(o) }}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="created_at-desc">Newest First</option>
          <option value="created_at-asc">Oldest First</option>
          <option value="name-asc">Name A→Z</option>
          <option value="name-desc">Name Z→A</option>
          <option value="status-asc">Status</option>
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={users.length === 0}
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <SpinnerIcon /> Loading students…
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={40} height={40} className="mb-3 opacity-40">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p className="text-sm font-medium">No students found</p>
          <p className="text-xs mt-1">Try adjusting your search or filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((user) => (
            <div key={user.uid} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{user.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      user.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : user.status === "pending"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-destructive/15 text-destructive"
                    }`}>
                      {user.status}
                    </span>
                    {user.must_change_password && (
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">OTP Active</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{user.index_number}</span>
                    {user.level && <> · <span className="font-medium text-foreground/70">{user.level}</span></>}
                    {" · "}<span>Joined {fmtDate(user.created_at)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.status === "pending" && (
                    <>
                      <button type="button" disabled={!!actionLoading} onClick={() => doAction(user.uid, "approve")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        {actionLoading === user.uid + "approve" ? "…" : "Approve"}
                      </button>
                      <button type="button" disabled={!!actionLoading} onClick={() => doAction(user.uid, "reject")}
                        className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50">
                        {actionLoading === user.uid + "reject" ? "…" : "Reject"}
                      </button>
                    </>
                  )}
                  <button type="button" disabled={!!actionLoading} onClick={() => setEditLevelUser(user)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50">
                    Edit Level
                  </button>
                  <button type="button" disabled={!!actionLoading} onClick={() => doAction(user.uid, "reset-password")}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50">
                    {actionLoading === user.uid + "reset-password" ? "…" : "Reset Password"}
                  </button>
                  <button type="button" disabled={!!actionLoading} onClick={() => setConfirmDelete(user)}
                    className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {otpModal && <OtpModal otp={otpModal.otp} userName={otpModal.name} onClose={() => setOtpModal(null)} />}
      {confirmDelete && (
        <ConfirmModal
          message={`This will permanently delete ${confirmDelete.name}'s account and all their progress data. This cannot be undone.`}
          onConfirm={() => doDelete(confirmDelete.uid)}
          onCancel={() => setConfirmDelete(null)}
          busy={actionLoading === confirmDelete.uid + "delete"}
        />
      )}
      {editLevelUser && (
        <EditLevelModal
          user={editLevelUser}
          onSave={(uid, level) => doAction(uid, "edit-level", { level })}
          onCancel={() => setEditLevelUser(null)}
          busy={actionLoading === editLevelUser.uid + "edit-level"}
        />
      )}
    </>
  )
}

// ── Guest Users Table ──────────────────────────────────────────────────────────

function GuestTable() {
  const { adminToken } = useAdmin()
  const [guests, setGuests] = useState<GuestUser[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState("last_active")
  const [order, setOrder] = useState("desc")
  const [confirmDelete, setConfirmDelete] = useState<GuestUser | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchGuests = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    try {
      const p = new URLSearchParams()
      if (search) p.set("search", search)
      p.set("sort", sort)
      p.set("order", order)
      const res = await fetch(`/api/admin/guests?${p}`, { headers: { "x-admin-token": adminToken } })
      if (res.ok) {
        const data = await res.json()
        setGuests(data.guests)
        setTotalCount(data.total)
      }
    } catch {}
    setLoading(false)
  }, [adminToken, search, sort, order])

  useEffect(() => {
    const t = setTimeout(fetchGuests, 300)
    return () => clearTimeout(t)
  }, [fetchGuests])

  async function doDelete(uid: string) {
    if (!adminToken) return
    setActionLoading(uid)
    try {
      await fetch(`/api/admin/guests/${uid}`, { method: "DELETE", headers: { "x-admin-token": adminToken } })
      await fetchGuests()
    } catch {}
    setActionLoading(null)
    setConfirmDelete(null)
  }

  function handleExport() {
    const rows = guests.map((g) => ({
      Name: g.name,
      "Class Level": g.class_level,
      "Created At": fmtDate(g.created_at),
      "Last Active": fmtDate(g.last_active),
      "Expires At": fmtDate(g.expires_at),
    }))
    exportCSV(`guest-users-${Date.now()}.csv`, rows)
  }

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Active Guests</p>
          <p className="mt-1 text-2xl font-bold">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In Current View</p>
          <p className="mt-1 text-2xl font-bold text-primary">{guests.length}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><SearchIcon /></span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <select
          value={`${sort}-${order}`}
          onChange={(e) => { const [s, o] = e.target.value.split("-"); setSort(s); setOrder(o) }}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="last_active-desc">Last Active</option>
          <option value="created_at-desc">Newest First</option>
          <option value="created_at-asc">Oldest First</option>
          <option value="name-asc">Name A→Z</option>
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={guests.length === 0}
          className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <SpinnerIcon /> Loading guests…
        </div>
      ) : guests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={40} height={40} className="mb-3 opacity-40">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            <line x1="17" x2="22" y1="8" y2="8"/>
          </svg>
          <p className="text-sm font-medium">No active guest sessions</p>
          <p className="text-xs mt-1">Guest sessions expire automatically after 7 days.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {guests.map((guest) => (
            <div key={guest.uid} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-foreground">{guest.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Guest</span>
                    {guest.class_level && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{guest.class_level}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {fmtDate(guest.created_at)}
                    {" · "}Last active <span className="font-medium text-foreground/70">{fmtRelative(guest.last_active)}</span>
                    {" · "}Expires {fmtDate(guest.expires_at)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!!actionLoading}
                  onClick={() => setConfirmDelete(guest)}
                  className="shrink-0 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                >
                  {actionLoading === guest.uid ? "…" : "Block / Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          message={`This will permanently remove the guest session for "${confirmDelete.name}" and all associated data. They will need to create a new guest session to return.`}
          onConfirm={() => doDelete(confirmDelete.uid)}
          onCancel={() => setConfirmDelete(null)}
          busy={actionLoading === confirmDelete.uid}
        />
      )}
    </>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────

export function AdminUserManagement() {
  const [tab, setTab] = useState<"registered" | "guests">("registered")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">Manage registered students and active guest sessions</p>
      </div>

      {/* Toggle */}
      <div className="inline-flex rounded-xl border border-border bg-muted p-1 gap-1">
        <button
          type="button"
          onClick={() => setTab("registered")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
            tab === "registered"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Registered Students
        </button>
        <button
          type="button"
          onClick={() => setTab("guests")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all ${
            tab === "guests"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Guest Users
        </button>
      </div>

      {/* Content */}
      {tab === "registered" ? <RegisteredTable /> : <GuestTable />}
    </div>
  )
}
