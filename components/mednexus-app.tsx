"use client"

import { useState, useCallback } from "react"
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
import { AdminLoginModal } from "@/components/admin-login-modal"
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
  InfoIcon,
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
              <p className="text-xs text-white/80">+233 54 398 2307</p>
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
  const [modulesInitialModule, setModulesInitialModule] = useState<string | null>(null)
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

    setPendingQuiz({
      questions,
      moduleName: displayName,
      discipline: config.discipline,
      setupModule: config.module,
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

    setLastResult({
      result,
      moduleName: activeQuiz.moduleName,
      discipline: activeQuiz.discipline,
      lastSetup: { module: activeQuiz.setupModule, discipline: activeQuiz.discipline },
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
          setModulesInitialModule(mod)
          setScreen("modules")
          setMobileNavOpen(false)
        }}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2 sm:px-4 sm:py-2.5">
          {/* Mobile: hamburger */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <MenuIcon size={20} />
          </button>

          {/* Mobile: brand (non-interactive) */}
          <div className="flex min-w-0 items-center gap-1.5 px-1.5 py-1 lg:hidden">
            <StethoscopeIcon size={16} className="shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold">MedNexus</span>
          </div>

          {/* Desktop: spacer */}
          <div className="hidden flex-1 lg:block" />

          {/* Mobile: push right */}
          <div className="flex-1 lg:hidden" />

          {/* Right side — all items visible on all screen sizes */}
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <StudyModeToggle globalMode={globalMode} setGlobalMode={setGlobalMode} />
            <NotificationBell />
            <button
              type="button"
              onClick={() => setThemeOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
              aria-label="Themes"
            >
              <PaletteIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCreditsOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
              aria-label="About MedNexus"
            >
              <InfoIcon size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8">
          {safeScreen === "dashboard" && (
            <Dashboard
              onReadyForQuiz={handleReadyForQuiz}
              onOpenModules={(mod) => {
                setModulesInitialModule(mod ?? null)
                setScreen("modules")
              }}
              onOpenWeakAreas={() => setScreen("weak-areas")}
            />
          )}
          {safeScreen === "modules" && (
            <ModulesScreen
              onReadyForQuiz={handleReadyForQuiz}
              initialModule={modulesInitialModule}
            />
          )}
          {safeScreen === "weak-areas" && (
            <WeakAreasScreen onReadyForQuiz={handleReadyForQuiz} />
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
