"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { useTheme } from "@/contexts/theme-context"
import type { Screen } from "@/lib/view"
import type { TutorialDefinition, TutorialNavigationAction, TutorialStep } from "./tutorials"
import { TutorialOverlay } from "./TutorialOverlay"

const phoneQuery = "(max-width: 767px)"

export function TutorialNavigationController({ tutorial, stepIndex, onStep, onCheckpoint, onNavigate, onPause, onDismiss, onComplete }: {
  tutorial: TutorialDefinition; stepIndex: number; onStep: (step: number) => void; onCheckpoint: () => void
  onNavigate: (screen: Screen) => void
  onPause: () => void; onDismiss: () => void; onComplete: () => void
}) {
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileNavigationOpen,
    setMobileNavigationOpen,
    workspaceSwitcherOpen,
    setWorkspaceSwitcherOpen,
    setAccountMenuOpen,
    setAppearanceOpen,
  } = useApplicationShell()
  const theme = useTheme()
  const [isPhone, setIsPhone] = useState(false)
  const [measureEpoch, setMeasureEpoch] = useState(0)
  const [interactionComplete, setInteractionComplete] = useState(false)
  const initialTheme = useRef({ theme: theme.activeTheme, glass: theme.isGlassEnabled })
  const changed = useRef({ drawer: false, sidebar: false, workspace: false, account: false, appearance: false })
  const onNavigateRef = useRef(onNavigate)
  const onCheckpointRef = useRef(onCheckpoint)
  const checkpointedStep = useRef<string | null>(null)
  const step = tutorial.steps[stepIndex]

  useEffect(() => { onNavigateRef.current = onNavigate }, [onNavigate])
  useEffect(() => { onCheckpointRef.current = onCheckpoint }, [onCheckpoint])

  useEffect(() => {
    const media = matchMedia(phoneQuery)
    const sync = () => setIsPhone(media.matches)
    sync(); media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  const restoreUi = useCallback(() => {
    if (changed.current.drawer) setMobileNavigationOpen(false)
    if (changed.current.sidebar) setSidebarCollapsed(true)
    if (changed.current.workspace) setWorkspaceSwitcherOpen(false)
    if (changed.current.account) setAccountMenuOpen(false)
    if (changed.current.appearance) setAppearanceOpen(false)
    changed.current = { drawer: false, sidebar: false, workspace: false, account: false, appearance: false }
  }, [setAccountMenuOpen, setAppearanceOpen, setMobileNavigationOpen, setSidebarCollapsed, setWorkspaceSwitcherOpen])

  const apply = useCallback((action: TutorialNavigationAction | undefined, current: TutorialStep) => {
    if (!action || action.type === "none") return
    if (action.type === "navigate-preview") { onNavigateRef.current(action.screen); return }
    if (action.type === "open-mobile-drawer" && isPhone) { setMobileNavigationOpen(true); changed.current.drawer = true }
    if (action.type === "close-mobile-drawer") setMobileNavigationOpen(false)
    if (action.type === "open-workspace-switcher") { setWorkspaceSwitcherOpen(true); changed.current.workspace = true }
    if (action.type === "close-workspace-switcher") setWorkspaceSwitcherOpen(false)
    if (action.type === "open-account-menu") { setAccountMenuOpen(true); changed.current.account = true }
    if (action.type === "close-account-menu") setAccountMenuOpen(false)
    if (action.type === "open-appearance") { setAppearanceOpen(true); changed.current.appearance = true }
    if (action.type === "close-appearance") setAppearanceOpen(false)
    // A collapsed rail is expanded only when its full-sidebar target is needed.
    if (!isPhone && sidebarCollapsed && current.desktopTargetAnchorId?.startsWith("desktop-")) {
      setSidebarCollapsed(false); changed.current.sidebar = true
    }
  }, [isPhone, setAccountMenuOpen, setAppearanceOpen, setMobileNavigationOpen, setSidebarCollapsed, setWorkspaceSwitcherOpen, sidebarCollapsed])

  useEffect(() => {
    checkpointedStep.current = null
    setInteractionComplete(!step.interaction || (!isPhone && step.interaction.expectedAction === "open-mobile-drawer"))
    if (!step.interaction || !isPhone) apply(step.navigationAction, step)
    const timer = window.setTimeout(() => setMeasureEpoch(value => value + 1), 260)
    return () => clearTimeout(timer)
  }, [apply, step, isPhone])

  useEffect(() => {
    if (checkpointedStep.current === step.id) return
    if (step.interaction?.expectedAction === "open-mobile-drawer" && mobileNavigationOpen) {
      checkpointedStep.current = step.id
      changed.current.drawer = true
      if (step.navigationAction?.type === "open-workspace-switcher") apply(step.navigationAction, step)
      setInteractionComplete(true)
      onCheckpointRef.current()
      window.setTimeout(() => setMeasureEpoch(value => value + 1), 240)
    }
    if (step.interaction?.expectedAction === "open-workspace-switcher" && workspaceSwitcherOpen) {
      checkpointedStep.current = step.id
      changed.current.workspace = true
      setInteractionComplete(true)
      onCheckpointRef.current()
      window.setTimeout(() => setMeasureEpoch(value => value + 1), 220)
    }
  }, [apply, mobileNavigationOpen, step, workspaceSwitcherOpen])

  const leaveStep = (next: number) => { if (step.restoreUiAfterStep) restoreUi(); onStep(next) }
  const cancel = (callback: () => void) => { restoreUi(); theme.setActiveTheme(initialTheme.current.theme); theme.setIsGlassEnabled(initialTheme.current.glass); callback() }
  const finish = () => { restoreUi(); onComplete() }

  return <TutorialOverlay tutorial={tutorial} stepIndex={stepIndex} isPhone={isPhone} measureEpoch={measureEpoch} interactionComplete={interactionComplete} onStep={leaveStep} onPause={() => cancel(onPause)} onDismiss={() => cancel(onDismiss)} onComplete={finish} />
}
