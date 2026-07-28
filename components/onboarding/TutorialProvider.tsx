"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useApp } from "@/contexts/app-context"
import { emptyOnboardingRecord, TUTORIAL_IDS, TUTORIAL_VERSION, type OnboardingRecord, type TutorialId } from "@/lib/onboarding"
import type { StudyHubId } from "@/components/study-hub-switcher"
import { tutorials } from "./tutorials"
import { TutorialOverlay } from "./TutorialOverlay"

type TutorialContextValue = { replay: (id: TutorialId) => Promise<void>; reset: () => Promise<void>; records: Record<TutorialId, OnboardingRecord>; activeTutorial: TutorialId | null }
const TutorialContext = createContext<TutorialContextValue | null>(null)
const idForHub = (hub: StudyHubId): TutorialId | null => hub === "mcq-qbank" ? "mcq_qbank_intro" : hub === "theory-vault" ? "theory_vault_intro" : null

export function TutorialProvider({ activeHub, blocked, welcomeOpen, children }: { activeHub: StudyHubId; blocked: boolean; welcomeOpen: boolean; children: ReactNode }) {
  const { user, authReady } = useApp()
  const [records, setRecords] = useState<Record<TutorialId, OnboardingRecord>>(() => ({ mcq_qbank_intro: emptyOnboardingRecord("mcq_qbank_intro"), theory_vault_intro: emptyOnboardingRecord("theory_vault_intro") }))
  const [activeTutorial, setActiveTutorial] = useState<TutorialId | null>(null)
  const priorHub = useRef(activeHub)
  const registered = user?.role === "user" && user.sessionVerified
  const guestKey = user?.role === "guest" ? `mednexus:onboarding:guest:${user.uid}:v${TUTORIAL_VERSION}` : null

  const persistLocal = useCallback((next: Record<TutorialId, OnboardingRecord>) => { if (guestKey) localStorage.setItem(guestKey, JSON.stringify(next)) }, [guestKey])
  const update = useCallback(async (id: TutorialId, action: "start"|"step"|"complete"|"dismiss"|"restart", currentStep: number) => {
    let record: OnboardingRecord
    if (registered) {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tutorialId: id, tutorialVersion: TUTORIAL_VERSION, action, currentStep }) })
      if (!response.ok) return
      record = (await response.json()).tutorial
    } else {
      const now = new Date().toISOString(); const old = records[id]
      record = { ...old, status: action === "complete" ? "completed" : action === "dismiss" ? "dismissed" : "in_progress", currentStep: action === "restart" ? 0 : currentStep, startedAt: old.startedAt ?? now, completedAt: action === "complete" ? now : null, dismissedAt: action === "dismiss" ? now : null, updatedAt: now }
    }
    setRecords(current => { const next = { ...current, [id]: record }; if (!registered) persistLocal(next); return next })
  }, [persistLocal, records, registered])

  useEffect(() => {
    if (!authReady || !user) return
    if (registered) fetch("/api/onboarding", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (!data) return; setRecords(current => { const next = { ...current }; for (const row of data.tutorials) next[row.tutorialId as TutorialId] = row; return next }) }).catch(() => undefined)
    else if (guestKey) { try { const saved = localStorage.getItem(guestKey); if (saved) setRecords(JSON.parse(saved)) } catch {} }
  }, [authReady, guestKey, registered, user])

  useEffect(() => {
    if (priorHub.current !== activeHub && activeTutorial) { void update(activeTutorial, "step", records[activeTutorial].currentStep); setActiveTutorial(null) }
    priorHub.current = activeHub
    if (!authReady || !user || blocked || welcomeOpen || activeTutorial) return
    const id = idForHub(activeHub); if (!id) return
    const record = records[id]; if (record.status === "completed" || record.status === "dismissed") return
    const timer = window.setTimeout(() => { setActiveTutorial(id); void update(id, record.status === "in_progress" ? "step" : "start", record.currentStep) }, 350)
    return () => clearTimeout(timer)
  }, [activeHub, activeTutorial, authReady, blocked, records, update, user, welcomeOpen])

  const replay = useCallback(async (id: TutorialId) => { await update(id, "restart", 0); setActiveTutorial(id) }, [update])
  const reset = useCallback(async () => { for (const id of TUTORIAL_IDS) await update(id, "restart", 0); setActiveTutorial(null) }, [update])
  const value = useMemo(() => ({ replay, reset, records, activeTutorial }), [activeTutorial, records, replay, reset])
  const active = activeTutorial ? records[activeTutorial] : null
  return <TutorialContext.Provider value={value}>{children}{activeTutorial && active && <TutorialOverlay tutorial={tutorials[activeTutorial]} stepIndex={Math.min(active.currentStep, tutorials[activeTutorial].steps.length - 1)} onStep={step => void update(activeTutorial, "step", step)} onPause={() => setActiveTutorial(null)} onDismiss={() => { void update(activeTutorial, "dismiss", active.currentStep); setActiveTutorial(null) }} onComplete={() => { void update(activeTutorial, "complete", tutorials[activeTutorial].steps.length - 1); setActiveTutorial(null) }}/>}</TutorialContext.Provider>
}

export function useTutorials() { const context = useContext(TutorialContext); if (!context) throw new Error("useTutorials must be used within TutorialProvider"); return context }
