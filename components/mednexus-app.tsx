"use client"

import { useState, useCallback } from "react"
import { useApp } from "@/contexts/app-context"
import { useAdmin } from "@/contexts/admin-context"
import { useStudyMode } from "@/contexts/study-mode-context"
import { getQuestionsForModuleAndDiscipline, getWeakAreaQuestions } from "@/lib/modules"
import type { Screen } from "@/lib/view"
import type { QuizMode, BlockResult, Question, ExamScore } from "@/lib/types"
import { AuthScreen } from "@/components/auth-screen"
import { Sidebar } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { QuantityModal } from "@/components/quantity-modal"
import { QuizSimulator } from "@/components/quiz-simulator"
import { ResultsScreen } from "@/components/results-screen"
import { ThemeModal } from "@/components/theme-modal"
import { QuestionEditor } from "@/components/question-editor"
import { BroadcastScreen } from "@/components/broadcast-screen"
import { AdminLoginModal } from "@/components/admin-login-modal"
import { NotificationBell } from "@/components/notification-bell"
import { ProfileHistory } from "@/components/profile-history"
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
}

interface ActiveQuiz {
  questions: Question[]
  moduleName: string
  discipline: string | null
  mode: QuizMode
  startedAt: number
}

// ── Credits Modal ─────────────────────────────────────────────────────────────
function CreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Header gradient */}
        <div className="relative flex flex-col items-center bg-primary px-6 pb-8 pt-10 text-primary-foreground">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -left-6 bottom-0 h-20 w-20 rounded-full bg-white/8" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 shadow-lg">
            <StethoscopeIcon size={32} />
          </div>
          <h2 className="relative mt-4 text-2xl font-bold tracking-tight">MedNexus</h2>
          <p className="relative mt-1 text-sm opacity-80">Medical Study Platform</p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-primary-foreground/70 hover:bg-white/15 transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm text-muted-foreground">Designed &amp; built by</p>
            <p className="text-xl font-bold text-foreground">Britechinc</p>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Contact</p>
            <div className="flex items-center gap-2">
              <span className="text-lg">💬</span>
              <div>
                <p className="text-sm font-semibold text-foreground">WhatsApp</p>
                <p className="text-sm text-muted-foreground">0543982307</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-800/30 dark:bg-amber-900/20">
            <div className="flex items-start gap-2.5">
              <HeartIcon size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Support the Project</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                  Contributions help keep MedNexus growing. Reach out on WhatsApp to donate or collaborate.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function MedNexusApp() {
  const { user, authReady, progress, saveExamScore } = useApp()
  const { isAdmin } = useAdmin()
  const { globalMode, setGlobalMode } = useStudyMode()

  const [screen, setScreen] = useState<Screen>("dashboard")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [adminLoginOpen, setAdminLoginOpen] = useState(false)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [pendingQuiz, setPendingQuiz] = useState<PendingQuiz | null>(null)
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null)
  const [dashboardModule, setDashboardModule] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{
    result: BlockResult
    moduleName: string
    discipline: string | null
    lastSetup: { module: string; discipline: string | null } | null
  } | null>(null)

  const safeScreen = (screen === "question-editor" || screen === "broadcast") && !isAdmin
    ? "dashboard"
    : screen

  const handleReadyForQuiz = useCallback((config: { module: string; discipline: string | null }) => {
    let questions: Question[]
    const isWeakAreas = config.module === "__weak__"
    if (isWeakAreas) {
      questions = getWeakAreaQuestions(progress.history)
    } else {
      questions = getQuestionsForModuleAndDiscipline(config.module, config.discipline)
    }
    setPendingQuiz({
      questions,
      moduleName: isWeakAreas ? "Weak Areas" : config.module,
      discipline: config.discipline,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.history])

  if (!authReady) {
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

  if (!user) return <AuthScreen />

  function handleStartQuiz(selectedQuestions: Question[]) {
    if (!pendingQuiz) return
    setActiveQuiz({
      questions: selectedQuestions,
      moduleName: pendingQuiz.moduleName,
      discipline: pendingQuiz.discipline,
      mode: globalMode,
      startedAt: Date.now(),
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

    setLastResult({
      result,
      moduleName: activeQuiz.moduleName,
      discipline: activeQuiz.discipline,
      lastSetup: activeQuiz.moduleName === "Weak Areas"
        ? { module: "__weak__", discipline: null }
        : { module: activeQuiz.moduleName, discipline: activeQuiz.discipline },
    })
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
        <QuizSimulator
          questions={activeQuiz.questions}
          moduleName={activeQuiz.moduleName}
          mode={activeQuiz.mode}
          onExit={exitQuiz}
          onComplete={handleQuizComplete}
        />
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
        onSelectModule={(mod) => {
          setDashboardModule(mod)
          setScreen("dashboard")
          setMobileNavOpen(false)
        }}
        onOpenCredits={() => setCreditsOpen(true)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
          {/* Mobile: hamburger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <MenuIcon size={22} />
          </button>

          {/* Mobile: brand (tappable for credits) */}
          <button
            type="button"
            onClick={() => setCreditsOpen(true)}
            className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-muted lg:hidden"
          >
            <StethoscopeIcon size={18} className="text-primary" />
            <span className="font-semibold">MedNexus</span>
          </button>

          {/* Desktop: spacer */}
          <div className="hidden lg:block" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <StudyModeToggle globalMode={globalMode} setGlobalMode={setGlobalMode} />
            <NotificationBell />
            <button
              type="button"
              onClick={() => setThemeOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Themes"
            >
              <PaletteIcon size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 sm:p-8">
          {safeScreen === "dashboard" && (
            <Dashboard
              onReadyForQuiz={handleReadyForQuiz}
              requestedModule={dashboardModule}
              onClearRequestedModule={() => setDashboardModule(null)}
            />
          )}
          {safeScreen === "profile" && <ProfileHistory />}
          {safeScreen === "question-editor" && isAdmin && <QuestionEditor />}
          {safeScreen === "broadcast" && isAdmin && <BroadcastScreen />}
          {safeScreen === "results" && lastResult && (
            <ResultsScreen
              result={lastResult.result}
              moduleName={lastResult.moduleName}
              onReturn={() => setScreen("dashboard")}
              onRetry={() => {
                if (lastResult.lastSetup) {
                  handleReadyForQuiz(lastResult.lastSetup)
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Quantity selection modal */}
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
    </div>
  )
}

// ── Study Mode Toggle ─────────────────────────────────────────────────────────
function StudyModeToggle({
  globalMode,
  setGlobalMode,
}: {
  globalMode: QuizMode
  setGlobalMode: (mode: QuizMode) => void
}) {
  return (
    <div className="flex items-center rounded-xl border border-border bg-muted p-0.5">
      <button
        type="button"
        onClick={() => setGlobalMode("trial")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
          globalMode === "trial"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <ZapIcon size={13} />
        <span>Trial</span>
      </button>
      <button
        type="button"
        onClick={() => setGlobalMode("exam")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
          globalMode === "exam"
            ? "bg-amber-500 text-white shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <TimerIcon size={13} />
        <span>Exam</span>
      </button>
    </div>
  )
}
