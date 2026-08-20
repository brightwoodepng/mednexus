"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useApp } from "@/contexts/app-context"
import { useTheme } from "@/contexts/theme-context"
import { ThemeModal } from "@/components/theme-modal"
import { ArrowRightIcon, StethoscopeIcon } from "@/components/icons"
import { CLASS_LEVELS, ALL_LEVELS } from "@/lib/levels"
import { readRememberedIndexNumber } from "@/lib/auth-preferences"

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
    <button
      type="button"
      onClick={onClick}
      className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
        <path d="m15 18-6-6 6-6"/>
      </svg>
      Back
    </button>
  )
}

function LevelSelect({ id, value, onChange, required, levels = CLASS_LEVELS }: {
  id: string; value: string; onChange: (v: string) => void; required?: boolean; levels?: readonly string[]
}) {
  return (
    <select
      id={id}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 appearance-none"
    >
      <option value="" disabled>Select your level…</option>
      {levels.map((lvl) => (
        <option key={lvl} value={lvl}>{lvl}</option>
      ))}
    </select>
  )
}

// ── Brand ─────────────────────────────────────────────────────────────────────
function Brand() {
  return (
    <div className="mb-5 flex items-center justify-center gap-3 lg:hidden">
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-[1.4] rounded-2xl bg-primary/25 blur-xl auth-logo-glow"
        />
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/20">
          <StethoscopeIcon size={24} />
        </div>
      </div>
      <h1 className="text-2xl font-bold leading-none tracking-tight">MedNexus</h1>
    </div>
  )
}

function ValuePanel() {
  return (
    <section aria-label="MedNexus product showcase" className="relative hidden min-h-[640px] text-foreground lg:block">
      <header className="absolute left-0 top-0 z-20 flex items-center gap-3.5">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl ring-1 ring-primary/25">
          <StethoscopeIcon size={24} />
        </span>
        <div>
          <p className="text-xl font-black tracking-tight">MedNexus</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Medical learning workspace</p>
        </div>
      </header>

      <div className="absolute inset-x-0 bottom-14 top-20">
        <div className="absolute left-[1%] top-8 w-[82%] drop-shadow-[0_32px_30px_rgba(0,0,0,0.38)]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-t-[1.35rem] rounded-b-md border-[9px] border-slate-900 bg-slate-950 pb-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
            <span aria-hidden="true" className="absolute left-1/2 top-[3px] z-20 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-slate-500 ring-1 ring-black/80" />
            <div className="relative mt-1 h-[calc(100%-0.25rem)] w-full overflow-hidden rounded-sm bg-slate-950">
              <Image
                src="/auth/dashboard-preview.png"
                alt="MedNexus MCQ dashboard displayed on a laptop"
                fill
                priority
                unoptimized
                sizes="(min-width: 1280px) 760px, (min-width: 1024px) 50vw, 0px"
                className="select-none object-cover object-top"
                draggable={false}
              />
            </div>
          </div>
          <div aria-hidden="true" className="relative mx-auto h-7 w-[108%] origin-top [clip-path:polygon(3%_0,97%_0,100%_72%,97%_100%,3%_100%,0_72%)] bg-gradient-to-b from-slate-300 via-slate-500 to-slate-800 shadow-xl">
            <span className="absolute left-1/2 top-0 h-1.5 w-28 -translate-x-1/2 rounded-b-lg bg-slate-200/80 shadow-inner" />
            <span className="absolute bottom-0.5 left-1/2 h-1 w-[86%] -translate-x-1/2 rounded-full bg-slate-950/55" />
          </div>
        </div>

        <div className="absolute bottom-1 right-[1%] z-10 w-[24%] rotate-[2deg] drop-shadow-[0_28px_25px_rgba(0,0,0,0.45)]">
          <span aria-hidden="true" className="absolute -left-1 top-[21%] h-12 w-1 rounded-l bg-slate-700" />
          <span aria-hidden="true" className="absolute -right-1 top-[27%] h-16 w-1 rounded-r bg-slate-700" />
          <div className="relative aspect-[375/811] overflow-hidden rounded-[2.2rem] border-[8px] border-slate-900 bg-slate-950 p-[3px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)]">
            <span aria-hidden="true" className="absolute left-1/2 top-2 z-20 h-4 w-16 -translate-x-1/2 rounded-full bg-black ring-1 ring-white/10" />
            <span aria-hidden="true" className="absolute left-[calc(50%+1.25rem)] top-[0.72rem] z-30 h-1.5 w-1.5 rounded-full bg-slate-700" />
            <div className="relative h-full w-full overflow-hidden rounded-[1.65rem] bg-slate-950">
              <Image
                src="/auth/rankings-phone-preview.png"
                alt="MedNexus rankings displayed on a phone"
                fill
                priority
                unoptimized
                sizes="(min-width: 1280px) 230px, (min-width: 1024px) 16vw, 0px"
                className="select-none object-cover object-top"
                draggable={false}
              />
            </div>
            <span aria-hidden="true" className="absolute bottom-2 left-1/2 z-20 h-1 w-14 -translate-x-1/2 rounded-full bg-white/70" />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <div className="mt-6 flex justify-center">
      <a
        href="https://wa.me/233543982307"
        target="_blank"
        rel="noopener noreferrer"
        className="auth-link inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <WhatsAppIcon size={13} />
        Contact support
      </a>
    </div>
  )
}

// ── Guest Form ────────────────────────────────────────────────────────────────
function GuestForm({ onBack }: { onBack: () => void }) {
  const { enterApp } = useApp()
  const [name, setName] = useState("")
  const [classLevel, setClassLevel] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !classLevel) return
    setLoading(true)
    await enterApp(name, classLevel)
    setLoading(false)
  }

  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 id="auth-title" className="text-xl font-bold tracking-tight">Guest Access</h2>
      <p className="mt-1.5 mb-6 text-sm text-muted-foreground leading-relaxed">
        Progress saves on this device only. Sign out to clear your session.
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
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="guest-level">Level / Year</label>
          <LevelSelect id="guest-level" value={classLevel} onChange={setClassLevel} required levels={ALL_LEVELS} />
        </div>
        <button
          type="submit"
          disabled={loading || !name.trim() || !classLevel}
          className="mt-1 flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90 hover:shadow-primary/20 active:scale-[0.988] disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? "Setting up…" : "Continue as Guest"}
          {!loading && <ArrowRightIcon size={15} />}
        </button>
      </form>
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

        {error && <ErrorAlert message={error} />}

        <button
          type="submit"
          disabled={loading || !indexNumber.trim() || otp.length < 6}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90 hover:shadow-primary/20 active:scale-[0.988] disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? "Verifying…" : "Verify Token & Set New Password"}
          {!loading && <ArrowRightIcon size={15} />}
        </button>
      </form>

      <button type="button" onClick={onBack} className="text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back to Log In
      </button>
    </div>
  )
}

// ── Error alert ───────────────────────────────────────────────────────────────
function ErrorAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15} className="mt-0.5 shrink-0">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <path d="M12 9v4"/><path d="M12 17h.01"/>
      </svg>
      {message}
    </div>
  )
}

// ── Login Fields ──────────────────────────────────────────────────────────────
function LoginFields({
  guestAccessEnabled,
  registrationEnabled,
  onGuest,
  onRegister,
  onOtp,
}: {
  guestAccessEnabled: boolean
  registrationEnabled: boolean
  onGuest: () => void
  onRegister: () => void
  onOtp: () => void
}) {
  const { loginUser } = useApp()
  const [indexNumber, setIndexNumber] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const indexRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const rememberedIndex = readRememberedIndexNumber()
    if (rememberedIndex) {
      setIndexNumber(rememberedIndex)
      window.requestAnimationFrame(() => passwordRef.current?.focus())
      return
    }
    indexRef.current?.focus()
  }, [])

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
            ref={indexRef}
            type="text"
            autoComplete="username"
            value={indexNumber}
            onChange={(e) => { setIndexNumber(e.target.value); setError("") }}
            placeholder="sm/sms/22/0092"
            className="min-h-[52px] w-full rounded-xl border border-input bg-background/85 px-4 py-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="login-pw">Password</label>
          <div className="relative">
            <input
              id="login-pw"
              ref={passwordRef}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError("") }}
              placeholder="Your password"
              className="min-h-[52px] w-full rounded-xl border border-input bg-background/85 px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <EyeIcon open={showPw} />
            </button>
          </div>
        </div>

        {error && <ErrorAlert message={error} />}

        <button
          type="submit"
          disabled={loading || !indexNumber.trim() || !password.trim()}
          className="auth-btn-primary mt-1 flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold transition-[background-color,box-shadow,opacity] disabled:opacity-50 disabled:shadow-none"
        >
          {loading ? "Signing in…" : "Log In"}
          {!loading && <ArrowRightIcon size={15} />}
        </button>

        <button
          type="button"
          onClick={onOtp}
          className="auth-link min-h-11 rounded-md px-2 text-center text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Forgot password? Enter with OTP
        </button>

        {guestAccessEnabled && (
          <button
            type="button"
            onClick={onGuest}
            className="auth-btn-secondary flex min-h-[52px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-[background-color,border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={15} height={15}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              <line x1="17" x2="22" y1="8" y2="8"/>
            </svg>
            Continue as guest
          </button>
        )}

        {registrationEnabled && (
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button type="button" onClick={onRegister} className="auth-link min-h-11 rounded-md px-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
              Create an account
            </button>
          </p>
        )}
      </form>
  )
}

// ── Register Fields ───────────────────────────────────────────────────────────
function RegisterFields({ onRegistered }: { onRegistered: () => void }) {
  const { registerUser, loginUser } = useApp()
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
    if (!result.ok) {
      setLoading(false)
      setError(result.error ?? "Registration failed")
    } else if (result.status === "approved") {
      const login = await loginUser(indexNumber, password)
      setLoading(false)
      if (!login.ok) {
        setError(login.error ?? "Account created! Automatic sign-in failed — please log in manually.")
        onRegistered()
      }
    } else {
      setLoading(false)
      setSuccess({ status: result.status ?? "pending" })
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
        <h3 className="mb-2 text-lg font-bold tracking-tight">Account Created</h3>
        {success.status === "approved" ? (
          <>
            <p className="mb-5 text-sm text-muted-foreground">Your account has been automatically approved. You can now log in.</p>
            <button type="button" onClick={onRegistered} className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90 hover:shadow-primary/20">
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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
        <LevelSelect id="reg-level" value={level} onChange={(v) => { setLevel(v); setError("") }} required />
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
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
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

      {error && <ErrorAlert message={error} />}

      <button
        type="submit"
        disabled={loading || !name.trim() || !indexNumber.trim() || !password.trim() || !confirmPassword.trim()}
        className="mt-1 flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90 hover:shadow-primary/20 active:scale-[0.988] disabled:opacity-50 disabled:shadow-none"
      >
        {loading ? "Creating account…" : "Create Account"}
        {!loading && <ArrowRightIcon size={15} />}
      </button>
    </form>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
type AuthView = "login" | "register" | "guest" | "otp"

export function AuthScreen({
  registrationEnabled = true,
  guestAccessEnabled = true,
}: {
  registrationEnabled?: boolean
  guestAccessEnabled?: boolean
}) {
  const [view, setView] = useState<AuthView>("login")
  const [themeOpen, setThemeOpen] = useState(false)

  useEffect(() => {
    if ((view === "guest" && !guestAccessEnabled) || (view === "register" && !registrationEnabled)) {
      setView("login")
    }
  }, [guestAccessEnabled, registrationEnabled, view])

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-14 safe-area-inset sm:px-6 lg:flex lg:items-center lg:px-10 lg:py-8">
      <button
        type="button"
        onClick={() => setThemeOpen(true)}
        title="Change theme"
        className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={13} height={13}>
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        Theme
      </button>

      <div aria-hidden="true" className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-[1440px] items-center gap-8 xl:grid-cols-[minmax(0,1fr)_440px] xl:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(390px,440px)]">
        <ValuePanel />

        <div className="mx-auto w-full max-w-[440px]">
          <Brand />
          <section className="glass-auth-card rounded-[2rem] p-5 shadow-xl sm:p-8" aria-labelledby="auth-title">
            {view === "login" && (
              <>
                <div className="mb-6">
                  <h2 id="auth-title" className="text-2xl font-bold tracking-tight">Welcome back</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">Sign in to continue to your workspace.</p>
                </div>
                <LoginFields
                  guestAccessEnabled={guestAccessEnabled}
                  registrationEnabled={registrationEnabled}
                  onGuest={() => setView("guest")}
                  onRegister={() => setView("register")}
                  onOtp={() => setView("otp")}
                />
              </>
            )}

            {view === "guest" && guestAccessEnabled && <GuestForm onBack={() => setView("login")} />}

            {view === "register" && registrationEnabled && (
              <div>
                <BackButton onClick={() => setView("login")} />
                <h2 id="auth-title" className="text-xl font-bold tracking-tight">Create your account</h2>
                <p className="mb-6 mt-1.5 text-sm text-muted-foreground">Save your progress and use MedNexus across devices.</p>
                <RegisterFields onRegistered={() => setView("login")} />
              </div>
            )}

            {view === "otp" && (
              <div>
                <h2 id="auth-title" className="text-xl font-bold tracking-tight">Reset access</h2>
                <p className="mb-6 mt-1.5 text-sm text-muted-foreground">Request a one-time reset token, then use it to sign in.</p>
                <OtpResetFields onBack={() => setView("login")} />
              </div>
            )}
          </section>
          <Footer />
        </div>
      </div>

      <ThemeModal open={themeOpen} onClose={() => setThemeOpen(false)} />
    </main>
  )
}
