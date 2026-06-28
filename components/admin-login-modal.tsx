"use client"

import { useState } from "react"
import { useAdmin } from "@/contexts/admin-context"
import { XIcon, DatabaseIcon, CheckIcon, AlertTriangleIcon } from "@/components/icons"

interface AdminLoginModalProps {
  onClose: () => void
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

export function AdminLoginModal({ onClose }: AdminLoginModalProps) {
  const { loginAdmin } = useAdmin()
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim()) return
    setLoading(true)
    setError("")
    const result = await loginAdmin(password)
    setLoading(false)
    if (result.ok) {
      onClose()
    } else {
      setError(result.error ?? "Login failed")
    }
  }

  return (
    <div className="glass-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="glass-modal w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl">
        {/* Header */}
        <div className="glass-modal-header flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <DatabaseIcon size={18} />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Admin Login</h3>
              <p className="text-[11px] text-muted-foreground">Question Editor access</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the admin password to unlock full Question Editor access. Regular users can still view and answer questions.
          </p>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError("") }}
                placeholder="Enter admin password"
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <EyeIcon open={showPw} />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertTriangleIcon size={14} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <CheckIcon size={15} />
            )}
            {loading ? "Verifying…" : "Login as Admin"}
          </button>

          <p className="text-center text-xs text-muted-foreground">
            Session lasts 24 hours · Set password via <code className="rounded bg-muted px-1">ADMIN_PASSWORD</code> env var
          </p>
        </form>
      </div>
    </div>
  )
}
