"use client"

import { useState } from "react"
import { useApp } from "@/contexts/app-context"
import type { Screen } from "@/lib/view"
import type { QuizMode, BlockResult } from "@/lib/types"
import { AuthScreen } from "@/components/auth-screen"
import { Sidebar } from "@/components/sidebar"
import { Dashboard } from "@/components/dashboard"
import { ModeSelectionModal } from "@/components/mode-selection-modal"
import { QuizSimulator } from "@/components/quiz-simulator"
import { ResultsScreen } from "@/components/results-screen"
import { ProfileHistory } from "@/components/profile-history"
import { ThemeModal } from "@/components/theme-modal"
import { QuestionEditor } from "@/components/question-editor"
import { MenuIcon, StethoscopeIcon, PaletteIcon } from "@/components/icons"

interface ActiveQuiz {
  subject: string
  mode: QuizMode
}

export function MedNexusApp() {
  const { user, authReady } = useApp()

  const [screen, setScreen] = useState<Screen>("dashboard")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [pendingSubject, setPendingSubject] = useState<string | null>(null)
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null)
  const [lastResult, setLastResult] = useState<{ result: BlockResult; moduleName: string } | null>(null)

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

  function startQuiz(mode: QuizMode) {
    if (!pendingSubject) return
    setActiveQuiz({ subject: pendingSubject, mode })
    setPendingSubject(null)
    setScreen("quiz")
  }

  function handleQuizComplete(result: BlockResult) {
    setLastResult({ result, moduleName: activeQuiz?.subject ?? "" })
    setActiveQuiz(null)
    setScreen("results")
  }

  function exitQuiz() {
    setActiveQuiz(null)
    setScreen("dashboard")
  }

  if (screen === "quiz" && activeQuiz) {
    return (
      <div className="h-screen bg-background">
        <QuizSimulator
          subject={activeQuiz.subject}
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
        screen={screen}
        onNavigate={setScreen}
        onOpenThemes={() => setThemeOpen(true)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Open menu"
          >
            <MenuIcon size={22} />
          </button>
          <div className="flex items-center gap-2">
            <StethoscopeIcon size={18} className="text-primary" />
            <span className="font-semibold">MedNexus</span>
          </div>
          <button
            type="button"
            onClick={() => setThemeOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Themes"
          >
            <PaletteIcon size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-5 sm:p-8">
          {screen === "dashboard" && <Dashboard onSelectModule={setPendingSubject} />}
          {screen === "profile" && <ProfileHistory />}
          {screen === "question-editor" && <QuestionEditor />}
          {screen === "results" && lastResult && (
            <ResultsScreen
              result={lastResult.result}
              moduleName={lastResult.moduleName}
              onReturn={() => setScreen("dashboard")}
              onRetry={() => setPendingSubject(lastResult.moduleName)}
            />
          )}
        </main>
      </div>

      <ModeSelectionModal subject={pendingSubject} onClose={() => setPendingSubject(null)} onStart={startQuiz} />
      <ThemeModal open={themeOpen} onClose={() => setThemeOpen(false)} />
    </div>
  )
}
