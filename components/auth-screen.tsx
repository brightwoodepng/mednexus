"use client"

import { useState } from "react"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { StethoscopeIcon, ArrowRightIcon, EyeIcon, EyeOffIcon } from "@/components/icons"

type Role = "choose" | "guest" | "user" | "admin"
type UserTab = "login" | "register"

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

function PasswordInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  id?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "••••••••"}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-11 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        tabIndex={-1}
      >
        {show ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  )
}

// ── Guest Panel ────────────────────────────────────────────────────────────────
function GuestPanel({ onBack }: { onBack: () => void }) {
  const { enterApp } = useApp()
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await enterApp(name)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Continue without an account. Your progress is saved on this device and will be cleared when you log out.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="guest-name">
            Your name
          </label>
          <input
            id="guest-name"
            type="text"
            autoFocus
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Jane Doe"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
        >
          {loading ? "Setting up…" : "Continue as Guest"}
          {!loading && <ArrowRightIcon size={16} />}
        </button>
      </form>
      <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
        ← Back
      </button>
    </div>
  )
}

// ── User Panel ─────────────────────────────────────────────────────────────────
function UserPanel({ onBack }: { onBack: () => void }) {
  const { loginUser, registerUser } = useApp()
  const [tab, setTab] = useState<UserTab>("login")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [forgotPassword, setForgotPassword] = useState(false)

  // Login fields
  const [loginIndex, setLoginIndex] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Register fields
  const [regName, setRegName] = useState("")
  const [regLevel, setRegLevel] = useState("")
  const [regIndex, setRegIndex] = useState("")
  const [regPassword, setRegPassword] = useState("")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const result = await loginUser(loginIndex, loginPassword)
    setLoading(false)
    if (!result.ok) setError(result.error ?? "Login failed")
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!regName || !regLevel || !regIndex || !regPassword) {
      setError("All fields are required")
      return
    }
    setLoading(true)
    const result = await registerUser(regName, regLevel, regIndex, regPassword)
    setLoading(false)
    if (!result.ok) setError(result.error ?? "Registration failed")
  }

  if (forgotPassword) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Forgot your password?</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
            Please contact your administrator to reset your password.
          </p>
          <a
            href="https://wa.me/233543982307"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 text-sm font-medium text-[#25D366] hover:underline"
          >
            <WhatsAppIcon />
            Contact Admin on WhatsApp
          </a>
        </div>
        <button
          type="button"
          onClick={() => setForgotPassword(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          ← Back to login
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex rounded-xl border border-border bg-muted p-0.5">
        <button
          type="button"
          onClick={() => { setTab("login"); setError("") }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
            tab === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => { setTab("register"); setError("") }}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
            tab === "register" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Register
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {tab === "login" ? (
        <form onSubmit={handleLogin} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="login-index">
              Index Number
            </label>
            <input
              id="login-index"
              type="text"
              autoFocus
              value={loginIndex}
              onChange={(e) => setLoginIndex(e.target.value)}
              placeholder="e.g. UG/2021/001"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="login-password">
              Password
            </label>
            <PasswordInput value={loginPassword} onChange={setLoginPassword} id="login-password" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Log In"}
            {!loading && <ArrowRightIcon size={16} />}
          </button>
          <button
            type="button"
            onClick={() => setForgotPassword(true)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
          >
            Forgot password?
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="reg-name">
              Full Name
            </label>
            <input
              id="reg-name"
              type="text"
              autoFocus
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Dr. Jane Doe"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="reg-level">
              Level
            </label>
            <input
              id="reg-level"
              type="text"
              value={regLevel}
              onChange={(e) => setRegLevel(e.target.value)}
              placeholder="e.g. Level 400"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="reg-index">
              Index Number
            </label>
            <input
              id="reg-index"
              type="text"
              value={regIndex}
              onChange={(e) => setRegIndex(e.target.value)}
              placeholder="e.g. UG/2021/001"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="reg-password">
              Password
            </label>
            <PasswordInput value={regPassword} onChange={setRegPassword} id="reg-password" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Create Account"}
            {!loading && <ArrowRightIcon size={16} />}
          </button>
        </form>
      )}

      <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
        ← Back
      </button>
    </div>
  )
}

// ── Admin Panel ────────────────────────────────────────────────────────────────
function AdminPanel({ onBack }: { onBack: () => void }) {
  const { enterApp } = useApp()
  const { loginAdmin } = useAdmin()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const result = await loginAdmin(password)
    if (!result.ok) {
      setError(result.error ?? "Invalid password")
      setLoading(false)
      return
    }
    // Log admin into the app as a named user so the main app renders
    await enterApp("Admin")
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Enter the admin password to access the full dashboard with administrative tools.
      </p>
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-password">
            Admin Password
          </label>
          <PasswordInput value={password} onChange={setPassword} id="admin-password" />
        </div>
        <button
          type="submit"
          disabled={loading || !password}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Access Admin Dashboard"}
          {!loading && <ArrowRightIcon size={16} />}
        </button>
      </form>
      <button type="button" onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground transition-colors text-center">
        ← Back
      </button>
    </div>
  )
}

// ── Role Selector ──────────────────────────────────────────────────────────────
function RoleCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-muted/50 p-4 text-center transition-all hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm active:scale-[0.98]"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{description}</p>
      </div>
      <ArrowRightIcon size={14} className="text-muted-foreground" />
    </button>
  )
}

// ── Main Auth Screen ───────────────────────────────────────────────────────────
export function AuthScreen() {
  const [role, setRole] = useState<Role>("choose")

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xl">
              <StethoscopeIcon size={38} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">MedNexus</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Premium clinical Q-Bank for medical learners.
            </p>
          </div>

          {/* Card */}
          <div className="rounded-3xl border border-border bg-card p-6 shadow-2xl">
            {role === "choose" && (
              <div className="flex flex-col gap-4">
                <div className="text-center">
                  <h2 className="text-lg font-semibold tracking-tight">Welcome</h2>
                  <p className="mt-1 text-sm text-muted-foreground">How would you like to continue?</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <RoleCard
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                    title="Guest"
                    description="Quick access, local only"
                    onClick={() => setRole("guest")}
                  />
                  <RoleCard
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M6 12v5c3 3 9 3 12 0v-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                    title="Student"
                    description="Login or register"
                    onClick={() => setRole("user")}
                  />
                  <RoleCard
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    }
                    title="Admin"
                    description="Password protected"
                    onClick={() => setRole("admin")}
                  />
                </div>
              </div>
            )}

            {role === "guest" && <GuestPanel onBack={() => setRole("choose")} />}
            {role === "user"  && <UserPanel  onBack={() => setRole("choose")} />}
            {role === "admin" && <AdminPanel onBack={() => setRole("choose")} />}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="pb-6 pt-2 text-center">
        <p className="text-xs font-medium text-muted-foreground">Created by Britechinc</p>
        <div className="mt-1 flex items-center justify-center gap-1.5">
          <p className="text-xs text-muted-foreground">For support contact admin</p>
          <a
            href="https://wa.me/233543982307"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Contact admin on WhatsApp"
            className="flex items-center justify-center text-[#25D366] hover:opacity-80 transition-opacity"
          >
            <WhatsAppIcon />
          </a>
        </div>
      </footer>
    </main>
  )
}
