"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useApp } from "@/contexts/app-context"
import { emptyOnboardingRecord, TUTORIAL_IDS, TUTORIAL_VERSION, type OnboardingRecord, type TutorialId } from "@/lib/onboarding"
import type { StudyHubId } from "@/components/study-hub-switcher"
import { tutorials } from "./tutorials"
import { TutorialNavigationController } from "./TutorialNavigationController"

type TutorialContextValue = { replay: (id: TutorialId) => Promise<void>; reset: () => Promise<void>; records: Record<TutorialId, OnboardingRecord>; activeTutorial: TutorialId | null }
const TutorialContext = createContext<TutorialContextValue | null>(null)
const idForHub = (hub: StudyHubId): TutorialId | null => hub === "mcq-qbank" ? "mcq_qbank_intro" : hub === "theory-vault" ? "theory_vault_intro" : null

export function TutorialProvider({ activeHub, blocked, welcomeOpen, children }: { activeHub: StudyHubId; blocked: boolean; welcomeOpen: boolean; children: ReactNode }) {
  const { user, authReady } = useApp()
  const [records, setRecords] = useState<Record<TutorialId, OnboardingRecord>>(() => ({ mcq_qbank_intro: emptyOnboardingRecord("mcq_qbank_intro"), theory_vault_intro: emptyOnboardingRecord("theory_vault_intro") }))
  const [activeTutorial, setActiveTutorial] = useState<TutorialId | null>(null)
  const priorHub = useRef(activeHub)
  const registered = user?.role === "user" && user.sessionVerified
  const localKey = user ? `mednexus:onboarding:${user.role}:${user.uid}:v${TUTORIAL_VERSION}` : null

  const persistLocal = useCallback((next: Record<TutorialId, OnboardingRecord>) => { if (localKey) localStorage.setItem(localKey, JSON.stringify(next)) }, [localKey])
  const update = useCallback(async (id: TutorialId, action: "start"|"step"|"complete"|"dismiss"|"restart", currentStep: number, currentStepId?: string) => {
    // Navigation must never wait on storage. A missing onboarding table or a
    // temporary network error previously left the overlay open on the same step.
    setRecords(current => {
      const now = new Date().toISOString(); const old = current[id]
      const record: OnboardingRecord = { ...old, status: action === "complete" ? "completed" : action === "dismiss" ? "dismissed" : "in_progress", currentStep: action === "restart" ? 0 : currentStep, currentStepId: action === "restart" ? null : (currentStepId ?? old.currentStepId ?? null), startedAt: old.startedAt ?? now, completedAt: action === "complete" ? (old.completedAt ?? now) : null, dismissedAt: action === "dismiss" ? (old.dismissedAt ?? now) : null, updatedAt: now }
      const next = { ...current, [id]: record }; persistLocal(next); return next
    })
    if (!registered) return
    try {
      const response = await fetch("/api/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tutorialId: id, tutorialVersion: TUTORIAL_VERSION, action, currentStep, currentStepId }) })
      if (!response.ok) return
      const record = (await response.json()).tutorial as OnboardingRecord
      setRecords(current => { const next = { ...current, [id]: record }; persistLocal(next); return next })
    } catch { /* The local checkpoint keeps the tutorial usable offline. */ }
  }, [persistLocal, registered])

  useEffect(() => {
    if (!authReady || !user) return
    if (localKey) { try { const saved = localStorage.getItem(localKey); if (saved) setRecords(JSON.parse(saved)) } catch {} }
    if (registered) fetch("/api/onboarding", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (!data) return; setRecords(current => { const next = { ...current }; for (const row of data.tutorials) { const id = row.tutorialId as TutorialId; const localUpdated = next[id]?.updatedAt; if (!localUpdated || !row.updatedAt || new Date(row.updatedAt) >= new Date(localUpdated)) next[id] = row } persistLocal(next); return next }) }).catch(() => undefined)
  }, [authReady, localKey, persistLocal, registered, user])

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
  const definition = activeTutorial ? tutorials[activeTutorial] : null
  const resolvedStep = active && definition ? Math.max(0, active.currentStepId ? definition.steps.findIndex(step => step.id === active.currentStepId) : Math.min(active.currentStep, definition.steps.length - 1)) : 0
  return <TutorialContext.Provider value={value}>{children}{activeTutorial && active && definition && <TutorialNavigationController tutorial={definition} stepIndex={resolvedStep} onCheckpoint={() => void update(activeTutorial, "step", resolvedStep, definition.steps[resolvedStep].id)} onStep={step => void update(activeTutorial, "step", step, definition.steps[step].id)} onPause={() => { void update(activeTutorial, "step", resolvedStep, definition.steps[resolvedStep].id); setActiveTutorial(null) }} onDismiss={() => { void update(activeTutorial, "dismiss", resolvedStep, definition.steps[resolvedStep].id); setActiveTutorial(null) }} onComplete={() => { void update(activeTutorial, "complete", definition.steps.length - 1, definition.steps.at(-1)?.id); setActiveTutorial(null) }}/>}</TutorialContext.Provider>
}

export function useTutorials() { const context = useContext(TutorialContext); if (!context) throw new Error("useTutorials must be used within TutorialProvider"); return context }
