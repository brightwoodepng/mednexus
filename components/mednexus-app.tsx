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

export function MedNexusApp() {
  const { user, authReady, progress, saveExamScore } = useApp()
  const { isAdmin } = useAdmin()
  const { globalMode, setGlobalMode } = useStudyMode()

  const [screen, setScreen] = useState<Screen>("dashboard")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [adminLoginOpen, setAdminLoginOpen] = useState(false)
  const [pendingQuiz, setPendingQuiz] = useState<PendingQuiz | null>(null)
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null)
  const [lastResult, setLastResult] = useState<{
    result: BlockResult
    moduleName: string
    discipline: string | null
    lastSetup: { module: string; discipline: string | null } | null
  } | null>(null)

  const safeScreen = (screen === "question-editor" || screen === "broadcast") && !isAdmin
    ? "dashboard"
    : screen

  // Called by Dashboard when user has selected module (+ optional discipline)
  // Must be defined before any early returns to obey Rules of Hooks
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

  // Called by QuantityModal when user confirms quantity
  function handleStartQuiz(shuffledQuestions: Question[]) {
    if (!pendingQuiz) return
    setActiveQuiz({
      questions: shuffledQuestions,
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

    // Save exam score if in exam mode
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

  // Full-screen quiz view
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
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (visible on all screens) */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
          {/* Mobile: hamburger menu */}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <MenuIcon size={22} />
          </button>

          {/* Mobile: brand */}
          <div className="flex items-center gap-2 lg:hidden">
            <StethoscopeIcon size={18} className="text-primary" />
            <span className="font-semibold">MedNexus</span>
          </div>

          {/* Desktop: spacer */}
          <div className="hidden lg:block" />

          {/* Right side: mode toggle + bell + theme */}
          <div className="flex items-center gap-2">
            {/* Study Mode Toggle */}
            <StudyModeToggle globalMode={globalMode} setGlobalMode={setGlobalMode} />

            {/* Notification Bell */}
            <NotificationBell />

            {/* Theme toggle */}
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
            <Dashboard onReadyForQuiz={handleReadyForQuiz} />
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
    </div>
  )
}

// ── Study Mode Toggle ────────────────────────────────────────────────────────
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
        <span className="hidden sm:inline">Trial</span>
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
        <span className="hidden sm:inline">Exam</span>
      </button>
    </div>
  )
}
