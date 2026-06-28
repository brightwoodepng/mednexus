"use client"

import { useState } from "react"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { useTheme } from "@/contexts/theme-context"
import { THEMES } from "@/lib/themes"
import { StethoscopeIcon, ArrowRightIcon } from "@/components/icons"

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
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

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}><path d="m15 18-6-6 6-6"/></svg>
      Back
    </button>
  )
}

function Brand() {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xl">
        <StethoscopeIcon size={38} />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">MedNexus</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Premium clinical Q-Bank for medical learners.</p>
    </div>
  )
}

function Footer() {
  return (
    <div className="mt-8 flex flex-col items-center gap-1.5 text-center">
      <p className="text-xs text-muted-foreground">Created by <span className="font-semibold text-foreground">Britechinc</span></p>
      <a
        href="https://wa.me/233543982307"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-[#25D366] hover:underline font-medium"
      >
        <WhatsAppIcon size={14} />
        For support contact admin
      </a>
    </div>
  )
}

// ── Role Picker ──────────────────────────────────────────────────────────────
function RoleSelect({ onSelect, glass }: { onSelect: (tab: "guest" | "student" | "admin") => void; glass: boolean }) {
  return (
    <div className={`rounded-3xl border border-border bg-card p-7 shadow-2xl ${glass ? "glass-auth-card" : ""}`}>
      <h2 className="mb-1 text-xl font-semibold tracking-tight">Welcome</h2>
      <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
        Choose how you want to access MedNexus.
      </p>
      <div className="flex flex-col gap-3">

        {/* Student Login / Register */}
        <button
          type="button"
          onClick={() => onSelect("student")}
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3.5 text-left transition-all hover:bg-primary/10 hover:border-primary/50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Student Login / Register</p>
            <p className="text-xs text-muted-foreground">Sign in or create an account to save progress</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14} className="shrink-0 text-muted-foreground"><path d="m9 18 6-6-6-6"/></svg>
        </button>

        {/* Continue as Guest */}
        <button
          type="button"
          onClick={() => onSelect("guest")}
          className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3.5 text-left transition-all hover:bg-muted"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              <line x1="17" x2="22" y1="8" y2="8"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Continue as Guest</p>
            <p className="text-xs text-muted-foreground">Progress saves locally on this device only</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14} className="shrink-0 text-muted-foreground"><path d="m9 18 6-6-6-6"/></svg>
        </button>

        {/* Admin Access */}
        <button
          type="button"
          onClick={() => onSelect("admin")}
          className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3.5 text-left transition-all hover:bg-muted"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Admin Access</p>
            <p className="text-xs text-muted-foreground">Question editor and system management</p>
          </div>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14} className="shrink-0 text-muted-foreground"><path d="m9 18 6-6-6-6"/></svg>
        </button>

      </div>
    </div>
  )
}

// ── Guest Form ────────────────────────────────────────────────────────────────
function GuestForm({ onBack }: { onBack: () => void }) {
  const { enterApp } = useApp()
  const { glassEnabled } = useTheme()
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await enterApp(name)
    setLoading(false)
  }

  return (
    <div className={`rounded-3xl border border-border bg-card p-7 shadow-2xl ${glassEnabled ? "glass-auth-card" : ""}`}>
      <BackButton onClick={onBack} />
      <h2 className="mb-1 text-xl font-semibold tracking-tight">Guest Access</h2>
      <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
        Your progress will be saved on this device only. Sign out to clear your session.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="guest-name">Your name</label>
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
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
        >
          {loading ? "Setting up…" : "Enter MedNexus"}
          {!loading && <ArrowRightIcon size={16} />}
        </button>
      </form>
    </div>
  )
}

// ── Student Form (Login + Register toggled) ───────────────────────────────────
function StudentForm({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const { glassEnabled } = useTheme()

  return (
    <div className={`rounded-3xl border border-border bg-card shadow-2xl overflow-hidden ${glassEnabled ? "glass-auth-card" : ""}`}>
      {/* Tab toggle */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === "login" ? "bg-card text-foreground border-b-2 border-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${mode === "register" ? "bg-card text-foreground border-b-2 border-primary" : "bg-muted/50 text-muted-foreground hover:text-foreground"}`}
        >
          Create Account
        </button>
      </div>

      <div className="p-7">
        <BackButton onClick={onBack} />
        {mode === "login" ? <LoginFields /> : <RegisterFields onRegistered={() => setMode("login")} />}
      </div>
    </div>
  )
}

// ── OTP Reset Fields ──────────────────────────────────────────────────────────
const ADMIN_WHATSAPP = "233543982307"

function OtpResetFields({ onBack }: { onBack: () => void }) {
  const { loginUser } = useApp()
  const [indexNumber, setIndexNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [whatsappSent, setWhatsappSent] = useState(false)

  const whatsappMessage = indexNumber.trim()
    ? `Hello, I would like to reset my MedNexus password. My index number is: ${indexNumber.trim()}`
    : `Hello, I would like to reset my MedNexus password.`
  const whatsappHref = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(whatsappMessage)}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!indexNumber.trim() || otp.length < 6) return
    setLoading(true)
    setError("")
    const result = await loginUser(indexNumber, otp)
    setLoading(false)
    if (!result.ok) setError(result.error ?? "Invalid index number or reset token")
  }

  return (
    <div className="flex flex-col gap-5">

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="otp-index">Your Index Number</label>
        <input
          id="otp-index"
          type="text"
          autoFocus
          value={indexNumber}
          onChange={(e) => { setIndexNumber(e.target.value); setError("") }}
          placeholder="sm/sms/22/0092"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setWhatsappSent(true)}
        className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#20bd5a] transition-colors"
      >
        <WhatsAppIcon size={16} />
        Request Reset Token via WhatsApp
      </a>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground shrink-0">Enter your reset token</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <input
          id="otp-code"
          type="text"
          inputMode="numeric"
          value={otp}
          onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError("") }}
          placeholder="6-digit token"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-center text-xl font-bold tracking-[0.4em] font-mono outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        />

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15} className="mt-0.5 shrink-0">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !indexNumber.trim() || otp.length < 6}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Verify Token & Set New Password"}
          {!loading && <ArrowRightIcon size={16} />}
        </button>
      </form>

      <button type="button" onClick={onBack} className="text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back to Log In
      </button>
    </div>
  )
}

// ── Login Fields ──────────────────────────────────────────────────────────────
function LoginFields() {
  const { loginUser } = useApp()
  const [mode, setMode] = useState<"login" | "otp">("login")
  const [indexNumber, setIndexNumber] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  if (mode === "otp") {
    return <OtpResetFields onBack={() => setMode("login")} />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!indexNumber.trim() || !password.trim()) return
    setLoading(true)
    setError("")
    const result = await loginUser(indexNumber, password)
    setLoading(false)
    if (!result.ok) setError(result.error ?? "Login failed")
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="login-index">Index Number</label>
        <input
          id="login-index"
          type="text"
          autoFocus
          value={indexNumber}
          onChange={(e) => { setIndexNumber(e.target.value); setError("") }}
          placeholder="sm/sms/22/0092"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="login-pw">Password</label>
        <div className="relative">
          <input
            id="login-pw"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError("") }}
            placeholder="Your password"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <EyeIcon open={showPw} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15} className="mt-0.5 shrink-0">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !indexNumber.trim() || !password.trim()}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Log In"}
        {!loading && <ArrowRightIcon size={16} />}
      </button>

      <button
        type="button"
        onClick={() => setMode("otp")}
        className="text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Forgot password? <span className="font-semibold text-primary">Enter with OTP</span>
      </button>
    </form>
  )
}

// ── Register Fields ───────────────────────────────────────────────────────────
function RegisterFields({ onRegistered }: { onRegistered: () => void }) {
  const { registerUser } = useApp()
  const [name, setName] = useState("")
  const [level, setLevel] = useState("")
  const [indexNumber, setIndexNumber] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState<{ status: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !indexNumber.trim() || !password.trim()) return
    if (password !== confirmPassword) { setError("Passwords do not match"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true)
    setError("")
    const result = await registerUser(name, level, indexNumber, password)
    setLoading(false)
    if (!result.ok) {
      setError(result.error ?? "Registration failed")
    } else {
      setSuccess({ status: result.status ?? "approved" })
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={28} height={28}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <h3 className="mb-2 text-lg font-semibold">Account Created</h3>
        {success.status === "approved" ? (
          <>
            <p className="mb-5 text-sm text-muted-foreground">Your account has been automatically approved. You can now log in.</p>
            <button type="button" onClick={onRegistered} className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
              Go to Log In
            </button>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">Your account is <span className="font-semibold text-amber-600">pending approval</span>.</p>
            <p className="mb-5 text-sm text-muted-foreground">An admin will review your details. You'll be able to log in once approved.</p>
            <a
              href="https://wa.me/233543982307"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <WhatsAppIcon size={16} />
              Contact admin for quick approval
            </a>
          </>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="reg-name">Full Name</label>
        <input
          id="reg-name"
          type="text"
          autoFocus
          autoComplete="name"
          value={name}
          onChange={(e) => { setName(e.target.value); setError("") }}
          placeholder="Dr. Jane Doe"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="reg-level">Level / Year</label>
        <input
          id="reg-level"
          type="text"
          value={level}
          onChange={(e) => { setLevel(e.target.value); setError("") }}
          placeholder="e.g. Level 300, Year 2, Intern…"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="reg-index">Index Number</label>
        <input
          id="reg-index"
          type="text"
          value={indexNumber}
          onChange={(e) => { setIndexNumber(e.target.value); setError("") }}
          placeholder="e.g. smsms220092 or sm/sms/22/0092"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <p className="text-[11px] text-muted-foreground">Slashes are optional — we'll format it automatically.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="reg-pw">Password</label>
        <div className="relative">
          <input
            id="reg-pw"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError("") }}
            placeholder="Min. 6 characters"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <EyeIcon open={showPw} />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="reg-confirm-pw">Confirm Password</label>
        <input
          id="reg-confirm-pw"
          type={showPw ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => { setConfirmPassword(e.target.value); setError("") }}
          placeholder="Re-enter your password"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15} className="mt-0.5 shrink-0">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !name.trim() || !indexNumber.trim() || !password.trim() || !confirmPassword.trim()}
        className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
      >
        {loading ? "Creating account…" : "Create Account"}
        {!loading && <ArrowRightIcon size={16} />}
      </button>
    </form>
  )
}

// ── Admin Access Form ─────────────────────────────────────────────────────────
function AdminForm({ onBack }: { onBack: () => void }) {
  const { loginAdmin } = useAdmin()
  const { glassEnabled } = useTheme()
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
    if (!result.ok) setError(result.error ?? "Login failed")
  }

  return (
    <div className={`rounded-3xl border border-border bg-card p-7 shadow-2xl ${glassEnabled ? "glass-auth-card" : ""}`}>
      <BackButton onClick={onBack} />
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={20} height={20}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Admin Access</h2>
          <p className="text-xs text-muted-foreground">Question editor &amp; system management</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="admin-pw">Admin Password</label>
          <div className="relative">
            <input
              id="admin-pw"
              type={showPw ? "text" : "password"}
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              placeholder="Enter admin password"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <EyeIcon open={showPw} />
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15} className="mt-0.5 shrink-0">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
        >
          {loading ? "Verifying…" : "Enter Admin Mode"}
          {!loading && <ArrowRightIcon size={16} />}
        </button>
      </form>
    </div>
  )
}

// ── Theme Picker ──────────────────────────────────────────────────────────────
function LandingThemePicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setTheme, glassEnabled } = useTheme()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className={`animate-ios-sheet relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl ${glassEnabled ? "glass-auth-card" : ""}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Choose Theme</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTheme(t.id); onClose() }}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all ${theme === t.id ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border hover:border-border/80 hover:bg-muted"}`}
            >
              <div className="flex shrink-0 gap-0.5">
                <span className="h-5 w-2.5 rounded-l-full" style={{ background: t.swatch.bg }} />
                <span className="h-5 w-2.5" style={{ background: t.swatch.primary }} />
                <span className="h-5 w-2.5 rounded-r-full" style={{ background: t.swatch.surface }} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-foreground">{t.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{t.mode}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export function AuthScreen() {
  const [view, setView] = useState<"role-select" | "guest" | "student" | "admin">("role-select")
  const [themeOpen, setThemeOpen] = useState(false)
  const { glassEnabled } = useTheme()

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12 safe-area-inset">
      <button
        type="button"
        onClick={() => setThemeOpen(true)}
        title="Change theme"
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={14} height={14}>
          <circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        Theme
      </button>

      <div className="w-full max-w-sm">
        <Brand />
        {view === "role-select" && <RoleSelect onSelect={setView} glass={glassEnabled} />}
        {view === "guest" && <GuestForm onBack={() => setView("role-select")} />}
        {view === "student" && <StudentForm onBack={() => setView("role-select")} />}
        {view === "admin" && <AdminForm onBack={() => setView("role-select")} />}
        <Footer />
      </div>

      <LandingThemePicker open={themeOpen} onClose={() => setThemeOpen(false)} />
    </main>
  )
}
