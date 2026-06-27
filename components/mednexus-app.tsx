"use client"

import { useState, useCallback, useEffect } from "react"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { useStudyMode } from "@/contexts/study-mode-context"
import { getQuestionsForModuleAndDiscipline, getWeakAreaQuestions } from "@/lib/modules"
import { sortByUrgency } from "@/lib/srs"
import type { Screen } from "@/lib/view"
import type { QuizMode, BlockResult, Question, ExamScore } from "@/lib/types"
import { AuthScreen } from "@/components/auth-screen"
import { Sidebar } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { ModulesScreen } from "@/components/modules-screen"
import { QuantityModal } from "@/components/quantity-modal"
import { QuizSimulator } from "@/components/quiz-simulator"
import { ResultsScreen } from "@/components/results-screen"
import { ThemeModal } from "@/components/theme-modal"
import { QuestionEditor } from "@/components/question-editor"
import { BroadcastScreen } from "@/components/broadcast-screen"
import { LiveAssessmentsScreen } from "@/components/live-assessments-screen"
import { LiveAssessmentsAdmin } from "@/components/live-assessments-admin"
import { AdminLoginModal } from "@/components/admin-login-modal"
import { AdminUserManagement } from "@/components/admin-user-management"
import { NotificationBell } from "@/components/notification-bell"
import { ProfileHistory } from "@/components/profile-history"
import { WeakAreasScreen } from "@/components/weak-areas-screen"
import {
  MenuIcon,
  StethoscopeIcon,
  PaletteIcon,
  ZapIcon,
  TimerIcon,
  XIcon,
  HeartIcon,
} from "@/components/icons"

interface PendingQuiz {
  questions: Question[]
  moduleName: string
  discipline: string | null
  setupModule: string
}

interface ActiveQuiz {
  questions: Question[]
  moduleName: string
  discipline: string | null
  mode: QuizMode
  startedAt: number
  setupModule: string
}

// ── Credits Modal ─────────────────────────────────────────────────────────────
function CreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="relative flex flex-col items-center bg-primary px-6 pb-8 pt-10 text-primary-foreground">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-white/8" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-lg">
            <StethoscopeIcon size={32} />
          </div>
          <h2 className="relative mt-4 text-2xl font-bold tracking-tight">MedNexus</h2>
          <p className="relative mt-1 text-sm opacity-80">Medical Study Platform</p>
          <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-primary-foreground/70 hover:bg-white/15 transition-colors">
            <XIcon size={18} />
          </button>
        </div>
        <div className="space-y-5 px-6 py-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm text-muted-foreground">Designed &amp; built by</p>
            <p className="text-xl font-bold text-foreground">Britechinc</p>
          </div>
          <a
            href="https://wa.me/233543982307"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-[#25D366]/40 p-4 transition-all hover:bg-[#22c55e] active:bg-[#16a34a] shadow-sm bg-[color:var(--color-emerald-500)]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white shadow-sm">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Chat on WhatsApp</p>
              <p className="text-xs text-white/80">For support contact admin</p>
            </div>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 text-white/80">
              <path d="M7 17L17 7M17 7H7M17 7v10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <div className="rounded-2xl border border-amber-200 p-4 dark:border-amber-800/40 dark:bg-amber-900/20 bg-[color:var(--color-emerald-500)]">
            <div className="flex items-start gap-2.5">
              <HeartIcon size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold dark:text-amber-200 text-[#ffffff]">Support the Project</p>
                <p className="mt-1 text-xs leading-relaxed dark:text-amber-300 text-[#ffffff]">
                  Contributions help keep MedNexus growing. Reach out on WhatsApp to donate or collaborate.
                </p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Force Password Update Screen ──────────────────────────────────────────────
function ForcePasswordUpdate() {
  const { updatePassword, signOutUser, user } = useApp()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function EyeIcon({ open }: { open: boolean }) {
    return open ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError("Passwords do not match"); return }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return }
    setLoading(true)
    setError("")
    const result = await updatePassword(password)
    setLoading(false)
    if (!result.ok) setError(result.error ?? "Failed to update password")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={32} height={32}>
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Set New Password</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs">
            Hi {user?.name?.split(" ")[0]}! You logged in with a one-time password. Please create a permanent password to continue.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-7 shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError("") }}
                  placeholder="Min. 6 characters"
                  autoFocus
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 pr-11 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <EyeIcon open={showPw} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Confirm Password</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError("") }}
                placeholder="Re-enter password"
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
              disabled={loading || !password || !confirm}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Saving…" : "Set Password & Enter MedNexus"}
            </button>
          </form>
          <button type="button" onClick={signOutUser} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  )
}

function WhatsAppButton({ label }: { label: string }) {
  return (
    <a
      href="https://wa.me/233543982307"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-3.5 text-sm font-semibold text-white shadow-md transition-opacity hover:opacity-90"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" width={18} height={18}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
      {label}
    </a>
  )
}

// ── Pending Approval Screen ───────────────────────────────────────────────────
function PendingApprovalScreen() {
  const { signOutUser, user } = useApp()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-500/15 text-amber-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={38} height={38}>
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Account Pending</h1>
        <p className="mb-1 text-sm text-muted-foreground">
          Hi <span className="font-semibold text-foreground">{user?.name}</span>, your account is awaiting admin approval.
        </p>
        <p className="mb-8 text-sm text-muted-foreground">
          Your index number didn't match the expected format, so an admin needs to verify your details manually.
        </p>
        <WhatsAppButton label="Contact Admin on WhatsApp" />
        <button type="button" onClick={signOutUser} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
          Sign out
        </button>
      </div>
    </div>
  )
}

// ── Rejected Screen ───────────────────────────────────────────────────────────
function RejectedScreen() {
  const { signOutUser, user } = useApp()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" width={38} height={38}>
            <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Account Rejected</h1>
        <p className="mb-1 text-sm text-muted-foreground">
          Hi <span className="font-semibold text-foreground">{user?.name}</span>, your account registration was not approved.
        </p>
        <p className="mb-8 text-sm text-muted-foreground">
          Please contact the admin for more information or to appeal this decision.
        </p>
        <WhatsAppButton label="Contact Admin on WhatsApp" />
        <button type="button" onClick={signOutUser} className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
          Sign out
        </button>
      </div>
    </div>
  )
}

// ── Study Mode Toggle ─────────────────────────────────────────────────────────
function StudyModeToggle({ globalMode, setGlobalMode }: { globalMode: QuizMode; setGlobalMode: (mode: QuizMode) => void }) {
  return (
    <div className="flex items-center rounded-xl border border-border bg-muted p-0.5">
      <button
        type="button"
        onClick={() => setGlobalMode("trial")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${globalMode === "trial" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        <ZapIcon size={13} />
        <span>Trial</span>
      </button>
      <button
        type="button"
        onClick={() => setGlobalMode("exam")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${globalMode === "exam" ? "bg-amber-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
      >
        <TimerIcon size={13} />
        <span>Exam</span>
      </button>
    </div>
  )
}

// ── Welcome Modal ─────────────────────────────────────────────────────────────
function WelcomeModal({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 bg-foreground/30 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="bg-primary px-6 pt-8 pb-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={32} height={32}>
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Welcome to MedNexus!</h2>
          <p className="mt-1.5 text-sm text-white/80">Hi {name.split(" ")[0]} — you&apos;re all set.</p>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            {[
              { icon: "📚", text: "Practice questions across all your modules" },
              { icon: "📊", text: "Track your progress and identify weak areas" },
              { icon: "🎯", text: "Take timed exams to sharpen your skills" },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <span className="text-lg">{icon}</span>
                <span className="text-sm text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Start Learning
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export function MedNexusApp() {
  const { user, authReady, progress, saveExamScore, requiresPasswordUpdate } = useApp()
  const { isAdmin, adminReady } = useAdmin()
  const { globalMode, setGlobalMode } = useStudyMode()

  const [screen, setScreen] = useState<Screen>("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [adminLoginOpen, setAdminLoginOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [pendingQuiz, setPendingQuiz] = useState<PendingQuiz | null>(null)
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null)
  const [modulesInitialModule, setModulesInitialModule] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{
    result: BlockResult
    moduleName: string
    discipline: string | null
    lastSetup: { module: string; discipline: string | null } | null
  } | null>(null)

  useEffect(() => {
    if (user?.role === "user" && user.status === "approved" && !requiresPasswordUpdate) {
      const key = `mednexus-welcome-seen-${user.uid}`
      if (!localStorage.getItem(key)) {
        setShowWelcome(true)
        localStorage.setItem(key, "1")
      }
    }
  }, [user?.uid, user?.role, user?.status, requiresPasswordUpdate])

  const adminOnlyScreens: Screen[] = ["question-editor", "broadcast", "live-assessments-admin", "user-management"]
  const safeScreen = adminOnlyScreens.includes(screen) && !isAdmin ? "dashboard" : screen

  const handleReadyForQuiz = useCallback((config: { module: string; discipline: string | null }) => {
    let questions: Question[]
    let displayName: string

    const TRIAL_PREFIX = "__weak_trial__|"
    const EXAM_PREFIX  = "__weak_exam__|"
    const srsData = progress.srsData ?? {}

    if (config.module === "__weak__") {
      questions = sortByUrgency(getWeakAreaQuestions(progress.history), srsData)
      displayName = "Weak Areas"
    } else if (config.module.startsWith(TRIAL_PREFIX)) {
      const modName = config.module.slice(TRIAL_PREFIX.length)
      const weakTrialQs = getWeakAreaQuestions(progress.history.filter((e) => e.mode === "trial"))
      questions = weakTrialQs.filter((q) => (q.module?.trim() || q.subject) === modName)
      if (config.discipline) questions = questions.filter((q) => q.subject === config.discipline)
      questions = sortByUrgency(questions, srsData)
      displayName = config.discipline ?? modName
    } else if (config.module.startsWith(EXAM_PREFIX)) {
      const modName = config.module.slice(EXAM_PREFIX.length)
      const weakExamQs = getWeakAreaQuestions(progress.history.filter((e) => e.mode === "exam"))
      questions = weakExamQs.filter((q) => (q.module?.trim() || q.subject) === modName)
      if (config.discipline) questions = questions.filter((q) => q.subject === config.discipline)
      questions = sortByUrgency(questions, srsData)
      displayName = config.discipline ?? modName
    } else {
      questions = getQuestionsForModuleAndDiscipline(config.module, config.discipline)
      displayName = config.module
    }

    setPendingQuiz({ questions, moduleName: displayName, discipline: config.discipline, setupModule: config.module })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.history])

  if (!authReady || !adminReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <StethoscopeIcon size={26} />
          </div>
          <p className="text-sm">Loading MedNexus…</p>
        </div>
      </div>
    )
  }

  // Admins bypass the user login flow entirely
  if (!user && !isAdmin) return <AuthScreen />

  // These checks only apply to regular users
  if (user) {
    if (requiresPasswordUpdate) return <ForcePasswordUpdate />
    if (user.role === "user" && user.status === "pending") return <PendingApprovalScreen />
    if (user.role === "user" && user.status === "rejected") return <RejectedScreen />
  }

  function handleStartQuiz(selectedQuestions: Question[]) {
    if (!pendingQuiz) return
    setActiveQuiz({
      questions: selectedQuestions,
      moduleName: pendingQuiz.moduleName,
      discipline: pendingQuiz.discipline,
      mode: globalMode,
      startedAt: Date.now(),
      setupModule: pendingQuiz.setupModule,
    })
    setPendingQuiz(null)
    setScreen("quiz")
  }

  function handleQuizComplete(result: BlockResult) {
    if (!activeQuiz) return
    if (activeQuiz.mode === "exam" && result.timeTakenMs !== undefined) {
      const score: ExamScore = {
        id: `score-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        moduleName: activeQuiz.moduleName,
        discipline: activeQuiz.discipline,
        score: result.percentage,
        total: result.total,
        correct: result.correct,
        timeTakenMs: result.timeTakenMs,
        date: new Date().toISOString(),
      }
      saveExamScore(score)
    }
    setLastResult({ result, moduleName: activeQuiz.moduleName, discipline: activeQuiz.discipline, lastSetup: { module: activeQuiz.setupModule, discipline: activeQuiz.discipline } })
    setActiveQuiz(null)
    setScreen("results")
  }

  function exitQuiz() {
    setActiveQuiz(null)
    setScreen("dashboard")
  }

  if (safeScreen === "quiz" && activeQuiz) {
    return (
      <div className="h-screen bg-background">
        <QuizSimulator questions={activeQuiz.questions} moduleName={activeQuiz.moduleName} mode={activeQuiz.mode} onExit={exitQuiz} onComplete={handleQuizComplete} />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        screen={safeScreen}
        onNavigate={setScreen}
        onOpenThemes={() => setThemeOpen(true)}
        onOpenAdminLogin={() => setAdminLoginOpen(true)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        onReadyForQuiz={handleReadyForQuiz}
        onSelectModule={(mod) => { setModulesInitialModule(mod); setScreen("modules"); setMobileNavOpen(false) }}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed(true)}
        onExpand={() => setSidebarCollapsed(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 sm:px-4 sm:py-2.5">
          <button type="button" onClick={() => setMobileNavOpen(true)} className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Open menu">
            <MenuIcon size={20} />
          </button>
          <div className="flex min-w-0 items-center gap-1.5 px-1.5 py-1">
            <StethoscopeIcon size={16} className="shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">MedNexus</span>
          </div>
          <div className="flex-1" />
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <StudyModeToggle globalMode={globalMode} setGlobalMode={setGlobalMode} />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8" onClick={() => { if (!sidebarCollapsed) setSidebarCollapsed(true) }}>
          {safeScreen === "dashboard" && (
            <Dashboard onReadyForQuiz={handleReadyForQuiz} onOpenModules={(mod) => { setModulesInitialModule(mod ?? null); setScreen("modules") }} onOpenWeakAreas={() => setScreen("weak-areas")} />
          )}
          {safeScreen === "modules" && <ModulesScreen onReadyForQuiz={handleReadyForQuiz} initialModule={modulesInitialModule} />}
          {safeScreen === "weak-areas" && <WeakAreasScreen onReadyForQuiz={handleReadyForQuiz} />}
          {safeScreen === "profile" && <ProfileHistory />}
          {safeScreen === "question-editor" && isAdmin && <QuestionEditor />}
          {safeScreen === "broadcast" && isAdmin && <BroadcastScreen />}
          {safeScreen === "live-assessments" && <LiveAssessmentsScreen />}
          {safeScreen === "live-assessments-admin" && isAdmin && <LiveAssessmentsAdmin />}
          {safeScreen === "user-management" && isAdmin && <AdminUserManagement />}
          {safeScreen === "results" && lastResult && (
            <ResultsScreen result={lastResult.result} moduleName={lastResult.moduleName} onReturn={() => setScreen("dashboard")} onRetry={() => { if (lastResult.lastSetup) handleReadyForQuiz(lastResult.lastSetup) }} />
          )}
        </main>
      </div>

      <QuantityModal
        open={pendingQuiz !== null}
        label={pendingQuiz?.discipline ?? pendingQuiz?.moduleName ?? ""}
        sublabel={pendingQuiz?.discipline ? pendingQuiz.moduleName : undefined}
        questions={pendingQuiz?.questions ?? []}
        onClose={() => setPendingQuiz(null)}
        onStart={handleStartQuiz}
      />

      <ThemeModal open={themeOpen} onClose={() => setThemeOpen(false)} />
      {adminLoginOpen && <AdminLoginModal onClose={() => setAdminLoginOpen(false)} />}
      <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
      {showWelcome && user && <WelcomeModal name={user.name} onClose={() => setShowWelcome(false)} />}
    </div>
  )
}
