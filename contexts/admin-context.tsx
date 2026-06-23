"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react"

const LS_ADMIN_TOKEN = "mednexus-admin-token"

interface AdminContextValue {
  isAdmin: boolean
  adminReady: boolean
  loginAdmin: (password: string) => Promise<{ ok: boolean; error?: string }>
  logoutAdmin: () => void
  adminToken: string | null
}

const AdminContext = createContext<AdminContextValue | undefined>(undefined)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminReady, setAdminReady] = useState(false)

  // On mount, check if there's a stored token and verify it
  useEffect(() => {
    async function init() {
      try {
        const stored = localStorage.getItem(LS_ADMIN_TOKEN)
        if (stored) {
          const res = await fetch("/api/admin/auth", {
            headers: { "x-admin-token": stored },
          })
          const data = await res.json()
          if (data.valid) {
            setAdminToken(stored)
            setIsAdmin(true)
          } else {
            localStorage.removeItem(LS_ADMIN_TOKEN)
          }
        }
      } catch {
        // Network error — leave admin as false
      } finally {
        setAdminReady(true)
      }
    }
    init()
  }, [])

  const loginAdmin = useCallback(async (password: string) => {
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) return { ok: false, error: data.error ?? "Login failed" }
      localStorage.setItem(LS_ADMIN_TOKEN, data.token)
      setAdminToken(data.token)
      setIsAdmin(true)
      return { ok: true }
    } catch {
      return { ok: false, error: "Network error" }
    }
  }, [])

  const logoutAdmin = useCallback(() => {
    localStorage.removeItem(LS_ADMIN_TOKEN)
    setAdminToken(null)
    setIsAdmin(false)
  }, [])

  return (
    <AdminContext.Provider value={{ isAdmin, adminReady, loginAdmin, logoutAdmin, adminToken }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error("useAdmin must be used within AdminProvider")
  return ctx
}
