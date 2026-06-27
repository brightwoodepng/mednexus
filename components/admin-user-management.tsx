"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdmin } from "@/contexts/admin-context"

interface RegisteredUser {
  uid: string
  name: string
  level: string
  index_number: string
  status: string
  must_change_password: boolean
  created_at: string
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  )
}

function OtpModal({ otp, userName, onClose }: { otp: string; userName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(otp).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}>
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h3 className="mb-1 font-bold text-lg">One-Time Password</h3>
        <p className="mb-4 text-sm text-muted-foreground">Share this OTP with <span className="font-semibold text-foreground">{userName}</span>. They will be prompted to set a new password on their next login.</p>
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
          <span className="flex-1 text-center text-3xl font-bold tracking-[0.35em] text-foreground font-mono">{otp}</span>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mb-4 text-xs text-muted-foreground text-center">This OTP is valid until the user logs in with it.</p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={22} height={22}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
        </div>
        <h3 className="mb-2 font-bold text-lg">Are you sure?</h3>
        <p className="mb-5 text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition-colors">Cancel</button>
          <button type="button" onClick={onConfirm} className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-white hover:bg-destructive/90 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  )
}

export function AdminUserManagement() {
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
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    if (!adminToken) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)
      if (sort) params.set("sort", sort)
      if (order) params.set("order", order)
      const res = await fetch(`/api/admin/users?${params}`, {
        headers: { "x-admin-token": adminToken },
      })
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

  async function doAction(uid: string, action: string) {
    if (!adminToken) return
    setActionLoading(uid + action)
    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (res.ok) {
        if (action === "reset-password" && data.otp) {
          const user = users.find((u) => u.uid === uid)
          setOtpModal({ otp: data.otp, name: user?.name ?? "User" })
        }
        await fetchUsers()
      }
    } catch {}
    setActionLoading(null)
  }

  async function doDelete(uid: string) {
    if (!adminToken) return
    setActionLoading(uid + "delete")
    try {
      await fetch(`/api/admin/users/${uid}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken },
      })
      await fetchUsers()
    } catch {}
    setActionLoading(null)
    setConfirmDelete(null)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">Manage registered student accounts</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Users</p>
          <p className="mt-1 text-3xl font-bold">{totalCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Approved</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{users.filter((u) => u.status === "approved").length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">{users.filter((u) => u.status === "pending").length}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <SearchIcon />
          </div>
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
          onChange={(e) => {
            const [s, o] = e.target.value.split("-")
            setSort(s)
            setOrder(o)
          }}
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
        >
          <option value="created_at-desc">Newest First</option>
          <option value="created_at-asc">Oldest First</option>
          <option value="name-asc">Name A→Z</option>
          <option value="name-desc">Name Z→A</option>
          <option value="status-asc">Status</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <svg className="animate-spin mr-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Loading users…
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={40} height={40} className="mb-3 opacity-40">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p className="text-sm font-medium">No users found</p>
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
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                        OTP Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{user.index_number}</span>
                    {user.level && <span> · {user.level}</span>}
                    <span> · Joined {formatDate(user.created_at)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => doAction(user.uid, "approve")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === user.uid + "approve" ? "…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={!!actionLoading}
                        onClick={() => doAction(user.uid, "reject")}
                        className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                      >
                        {actionLoading === user.uid + "reject" ? "…" : "Reject"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={() => doAction(user.uid, "reset-password")}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {actionLoading === user.uid + "reset-password" ? "…" : "Reset Password"}
                  </button>
                  <button
                    type="button"
                    disabled={!!actionLoading}
                    onClick={() => setConfirmDelete(user)}
                    className="rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {otpModal && (
        <OtpModal otp={otpModal.otp} userName={otpModal.name} onClose={() => setOtpModal(null)} />
      )}
      {confirmDelete && (
        <ConfirmModal
          message={`This will permanently delete ${confirmDelete.name}'s account and all their progress data. This cannot be undone.`}
          onConfirm={() => doDelete(confirmDelete.uid)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
