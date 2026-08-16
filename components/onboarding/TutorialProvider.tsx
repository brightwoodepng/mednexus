"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useApp } from "@/contexts/app-context"
import { emptyOnboardingRecord, TUTORIAL_IDS, TUTORIAL_VERSION, type OnboardingRecord, type TutorialId } from "@/lib/onboarding"
import type { StudyHubId } from "@/components/study-hub-switcher"
import type { Screen } from "@/lib/view"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { withHubContext } from "@/lib/admin-hub-routing"
import { tutorials } from "./tutorials"
import { TutorialNavigationController } from "./TutorialNavigationController"

type TutorialContextValue = { replay: (id: TutorialId) => Promise<void>; reset: () => Promise<void>; records: Record<TutorialId, OnboardingRecord>; activeTutorial: TutorialId | null; isPhone: boolean }
const TutorialContext = createContext<TutorialContextValue | null>(null)
const idForHub = (hub: StudyHubId, isPhone: boolean): TutorialId | null => hub === "mcq-qbank" ? (isPhone ? "mcq_qbank_phone_intro" : "mcq_qbank_desktop_intro") : hub === "theory-vault" ? (isPhone ? "theory_vault_phone_intro" : "theory_vault_desktop_intro") : null
const emptyRecords = () => Object.fromEntries(TUTORIAL_IDS.map(id => [id, emptyOnboardingRecord(id)])) as Record<TutorialId, OnboardingRecord>

export function TutorialProvider({ activeHub, currentScreen, blocked, welcomeOpen, onNavigate, children }: { activeHub: StudyHubId; currentScreen: Screen; blocked: boolean; welcomeOpen: boolean; onNavigate: (screen: Screen) => void; children: ReactNode }) {
  const { user, authReady } = useApp()
  const {
    setActiveStudyHub,
    setMobileNavigationOpen,
    setWorkspaceSwitcherOpen,
    setAccountMenuOpen,
    setAppearanceOpen,
    setNotificationOpen,
  } = useApplicationShell()
  const [records, setRecords] = useState<Record<TutorialId, OnboardingRecord>>(emptyRecords)
  const [activeTutorial, setActiveTutorial] = useState<TutorialId | null>(null)
  const [pendingReplay, setPendingReplay] = useState<TutorialId | null>(null)
  const [isPhone, setIsPhone] = useState(false)
  const [deviceReady, setDeviceReady] = useState(false)
  // Pausing is a session-level choice. The persisted `in_progress` status is what
  // lets a later visit resume, but it must not immediately reopen the tour in
  // the same mounted provider.
  const pausedTutorials = useRef(new Set<TutorialId>())
  const priorHub = useRef(activeHub)
  const registered = user?.role === "user" && user.sessionVerified
  const localKey = user ? `mednexus:onboarding:${user.role}:${user.uid}:v${TUTORIAL_VERSION}` : null

  useEffect(() => {
    const media = matchMedia("(max-width: 767px)")
    const sync = () => { setIsPhone(media.matches); setDeviceReady(true) }
    sync(); media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

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
    if (localKey) { try { const saved = localStorage.getItem(localKey); if (saved) setRecords({ ...emptyRecords(), ...JSON.parse(saved) }) } catch {} }
    if (registered) fetch("/api/onboarding", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => { if (!data) return; setRecords(current => { const next = { ...current }; for (const row of data.tutorials) { if (!TUTORIAL_IDS.includes(row.tutorialId as TutorialId)) continue; const id = row.tutorialId as TutorialId; const localUpdated = next[id]?.updatedAt; if (!localUpdated || !row.updatedAt || new Date(row.updatedAt) >= new Date(localUpdated)) next[id] = row } persistLocal(next); return next }) }).catch(() => undefined)
  }, [authReady, localKey, persistLocal, registered, user])

  useEffect(() => {
    if (priorHub.current !== activeHub && activeTutorial) { void update(activeTutorial, "step", records[activeTutorial].currentStep); setActiveTutorial(null) }
    priorHub.current = activeHub
    const hubHome: Screen = activeHub === "theory-vault" ? "theory-dashboard" : "dashboard"
    if (!deviceReady || !authReady || !user || blocked || welcomeOpen || activeTutorial || pendingReplay || currentScreen !== hubHome) return
    const id = idForHub(activeHub, isPhone); if (!id) return
    const record = records[id]; if (record.status === "completed" || record.status === "dismissed" || pausedTutorials.current.has(id)) return
    const timer = window.setTimeout(() => { setActiveTutorial(id); void update(id, record.status === "in_progress" ? "step" : "start", record.currentStep) }, 350)
    return () => clearTimeout(timer)
  }, [activeHub, activeTutorial, authReady, blocked, currentScreen, deviceReady, isPhone, pendingReplay, records, update, user, welcomeOpen])

  useEffect(() => {
    if (!pendingReplay || blocked || welcomeOpen) return
    const targetHub: StudyHubId = pendingReplay.startsWith("mcq_qbank_") ? "mcq-qbank" : "theory-vault"
    const targetScreen: Screen = targetHub === "mcq-qbank" ? "dashboard" : "theory-dashboard"
    if (activeHub !== targetHub || currentScreen !== targetScreen) return
    const timer = window.setTimeout(() => {
      setActiveTutorial(pendingReplay)
      setPendingReplay(null)
    }, 120)
    return () => clearTimeout(timer)
  }, [activeHub, blocked, currentScreen, pendingReplay, welcomeOpen])

  const replay = useCallback(async (id: TutorialId) => {
    const targetHub: StudyHubId = id.startsWith("mcq_qbank_") ? "mcq-qbank" : "theory-vault"
    const targetScreen: Screen = targetHub === "mcq-qbank" ? "dashboard" : "theory-dashboard"
    pausedTutorials.current.delete(id)
    setActiveTutorial(null)
    setPendingReplay(id)
    setMobileNavigationOpen(false)
    setWorkspaceSwitcherOpen(false)
    setAccountMenuOpen(false)
    setAppearanceOpen(false)
    setNotificationOpen(false)
    setActiveStudyHub(targetHub)
    window.history.pushState({}, "", withHubContext("/", targetHub))
    onNavigate(targetScreen)
    await update(id, "restart", 0)
  }, [onNavigate, setAccountMenuOpen, setActiveStudyHub, setAppearanceOpen, setMobileNavigationOpen, setNotificationOpen, setWorkspaceSwitcherOpen, update])
  const reset = useCallback(async () => { for (const id of TUTORIAL_IDS) await update(id, "restart", 0); setActiveTutorial(null) }, [update])
  const value = useMemo(() => ({ replay, reset, records, activeTutorial, isPhone }), [activeTutorial, isPhone, records, replay, reset])
  const active = activeTutorial ? records[activeTutorial] : null
  const definition = activeTutorial ? tutorials[activeTutorial] : null
  const resolvedStep = active && definition ? Math.max(0, active.currentStepId ? definition.steps.findIndex(step => step.id === active.currentStepId) : Math.min(active.currentStep, definition.steps.length - 1)) : 0
  return <TutorialContext.Provider value={value}>{children}{activeTutorial && active && definition && <TutorialNavigationController tutorial={definition} stepIndex={resolvedStep} onNavigate={onNavigate} onCheckpoint={() => void update(activeTutorial, "step", resolvedStep, definition.steps[resolvedStep].id)} onStep={step => void update(activeTutorial, "step", step, definition.steps[step].id)} onPause={() => { pausedTutorials.current.add(activeTutorial); void update(activeTutorial, "step", resolvedStep, definition.steps[resolvedStep].id); setActiveTutorial(null) }} onDismiss={() => { pausedTutorials.current.add(activeTutorial); void update(activeTutorial, "dismiss", resolvedStep, definition.steps[resolvedStep].id); setActiveTutorial(null) }} onComplete={() => { pausedTutorials.current.add(activeTutorial); void update(activeTutorial, "complete", definition.steps.length - 1, definition.steps.at(-1)?.id); setActiveTutorial(null) }}/>}</TutorialContext.Provider>
}

export function useTutorials() { const context = useContext(TutorialContext); if (!context) throw new Error("useTutorials must be used within TutorialProvider"); return context }
