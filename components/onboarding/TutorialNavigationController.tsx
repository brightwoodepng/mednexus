"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useApplicationShell } from "@/components/authenticated-application-shell"
import { useTheme } from "@/contexts/theme-context"
import type { TutorialDefinition, TutorialNavigationAction, TutorialStep } from "./tutorials"
import { TutorialOverlay } from "./TutorialOverlay"

const phoneQuery = "(max-width: 767px)"

export function TutorialNavigationController({ tutorial, stepIndex, onStep, onCheckpoint, onPause, onDismiss, onComplete }: {
  tutorial: TutorialDefinition; stepIndex: number; onStep: (step: number) => void; onCheckpoint: () => void
  onPause: () => void; onDismiss: () => void; onComplete: () => void
}) {
  const shell = useApplicationShell()
  const theme = useTheme()
  const [isPhone, setIsPhone] = useState(false)
  const [measureEpoch, setMeasureEpoch] = useState(0)
  const [interactionComplete, setInteractionComplete] = useState(false)
  const initialTheme = useRef({ theme: theme.activeTheme, glass: theme.isGlassEnabled })
  const changed = useRef({ drawer: false, sidebar: false, workspace: false, account: false, appearance: false })
  const step = tutorial.steps[stepIndex]

  useEffect(() => {
    const media = matchMedia(phoneQuery)
    const sync = () => setIsPhone(media.matches)
    sync(); media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  const restoreUi = useCallback(() => {
    if (changed.current.drawer) shell.setMobileNavigationOpen(false)
    if (changed.current.sidebar) shell.setSidebarCollapsed(true)
    if (changed.current.workspace) shell.setWorkspaceSwitcherOpen(false)
    if (changed.current.account) shell.setAccountMenuOpen(false)
    if (changed.current.appearance) shell.setAppearanceOpen(false)
    changed.current = { drawer: false, sidebar: false, workspace: false, account: false, appearance: false }
  }, [shell])

  const apply = useCallback((action: TutorialNavigationAction | undefined, current: TutorialStep) => {
    if (!action || action.type === "none" || action.type === "navigate-preview") return
    if (action.type === "open-mobile-drawer" && isPhone) { shell.setMobileNavigationOpen(true); changed.current.drawer = true }
    if (action.type === "close-mobile-drawer") shell.setMobileNavigationOpen(false)
    if (action.type === "open-workspace-switcher") { shell.setWorkspaceSwitcherOpen(true); changed.current.workspace = true }
    if (action.type === "close-workspace-switcher") shell.setWorkspaceSwitcherOpen(false)
    if (action.type === "open-account-menu") { shell.setAccountMenuOpen(true); changed.current.account = true }
    if (action.type === "close-account-menu") shell.setAccountMenuOpen(false)
    if (action.type === "open-appearance") { shell.setAppearanceOpen(true); changed.current.appearance = true }
    if (action.type === "close-appearance") shell.setAppearanceOpen(false)
    // A collapsed rail is expanded only when its full-sidebar target is needed.
    if (!isPhone && shell.sidebarCollapsed && current.desktopTargetAnchorId?.startsWith("desktop-")) {
      shell.setSidebarCollapsed(false); changed.current.sidebar = true
    }
  }, [isPhone, shell])

  useEffect(() => {
    setInteractionComplete(!step.interaction || (!isPhone && step.interaction.expectedAction === "open-mobile-drawer"))
    if (!step.interaction) apply(step.navigationAction, step)
    const timer = window.setTimeout(() => setMeasureEpoch(value => value + 1), 260)
    return () => clearTimeout(timer)
  }, [apply, step, isPhone])

  useEffect(() => {
    if (step.interaction?.expectedAction === "open-mobile-drawer" && shell.mobileNavigationOpen) {
      changed.current.drawer = true; setInteractionComplete(true); onCheckpoint(); window.setTimeout(() => setMeasureEpoch(value => value + 1), 240)
    }
    if (step.interaction?.expectedAction === "open-workspace-switcher" && shell.workspaceSwitcherOpen) {
      changed.current.workspace = true; setInteractionComplete(true); onCheckpoint(); window.setTimeout(() => setMeasureEpoch(value => value + 1), 220)
    }
  }, [onCheckpoint, shell.mobileNavigationOpen, shell.workspaceSwitcherOpen, step.interaction])

  const leaveStep = (next: number) => { if (step.restoreUiAfterStep) restoreUi(); onStep(next) }
  const cancel = (callback: () => void) => { restoreUi(); theme.setActiveTheme(initialTheme.current.theme); theme.setIsGlassEnabled(initialTheme.current.glass); callback() }
  const finish = () => { restoreUi(); onComplete() }

  return <TutorialOverlay tutorial={tutorial} stepIndex={stepIndex} isPhone={isPhone} measureEpoch={measureEpoch} interactionComplete={interactionComplete} onStep={leaveStep} onPause={() => cancel(onPause)} onDismiss={() => cancel(onDismiss)} onComplete={finish} />
}
