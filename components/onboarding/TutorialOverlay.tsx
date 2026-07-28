"use client"
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { TutorialDefinition } from "./tutorials"
import { TutorialProgress } from "./TutorialProgress"
import { TutorialSpotlight } from "./TutorialSpotlight"
import { TutorialCoachmark } from "./TutorialCoachmark"
import { TutorialMobileSheet } from "./TutorialMobileSheet"
import { TutorialCompletion } from "./TutorialCompletion"

function visibleAnchor(id?: string) {
  if (!id) return null
  return [...document.querySelectorAll<HTMLElement>(`[data-tutorial-anchor="${id}"]`)].find(element => {
    const box = element.getBoundingClientRect(); const style = getComputedStyle(element)
    return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden"
  }) ?? null
}

export function TutorialOverlay({ tutorial, stepIndex, isPhone, measureEpoch, interactionComplete, onStep, onComplete, onPause, onDismiss }: { tutorial: TutorialDefinition; stepIndex: number; isPhone: boolean; measureEpoch: number; interactionComplete: boolean; onStep: (step: number) => void; onComplete: () => void; onPause: () => void; onDismiss: () => void }) {
  const step = tutorial.steps[stepIndex]
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const previousFocus = useRef<HTMLElement | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const anchorId = step.navigationAction?.type === "open-appearance" ? "appearance-modal" : isPhone ? ((step.mobileDrawerTargetAnchorId && visibleAnchor(step.mobileDrawerTargetAnchorId)) ? step.mobileDrawerTargetAnchorId : step.mobileTargetAnchorId) : step.desktopTargetAnchorId
  const bottomTarget = isPhone && anchorId?.startsWith("mobile-bottom")
  const tryIt = Boolean(step.interaction && isPhone)
  const allowTargetInteraction = tryIt || step.navigationAction?.type === "open-appearance"

  const measure = useCallback(() => {
    const target = visibleAnchor(anchorId)
    setRect(target?.getBoundingClientRect() ?? null)
  }, [anchorId])

  useLayoutEffect(() => {
    const target = visibleAnchor(anchorId)
    target?.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
    measure()
    const first = requestAnimationFrame(measure); const delayed = window.setTimeout(measure, 300)
    return () => { cancelAnimationFrame(first); clearTimeout(delayed) }
  }, [anchorId, measure, measureEpoch])

  useEffect(() => {
    const viewport = window.visualViewport
    const events: [EventTarget, string][] = [[window, "resize"], [window, "orientationchange"], [window, "scroll"]]
    if (viewport) events.push([viewport, "resize"], [viewport, "scroll"])
    events.forEach(([target, name]) => target.addEventListener(name, measure, { passive: true }))
    const observer = new ResizeObserver(measure); if (document.body) observer.observe(document.body)
    return () => { events.forEach(([target, name]) => target.removeEventListener(name, measure)); observer.disconnect() }
  }, [measure])

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus())
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onPause()
      if (event.key === "ArrowRight" && interactionComplete && stepIndex < tutorial.steps.length - 1) onStep(stepIndex + 1)
      if (event.key === "ArrowLeft" && stepIndex > 0) onStep(stepIndex - 1)
      if (event.key === "Tab" && dialog.current) {
        const controls = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])')]
        if (!controls.length) return
        const first = controls[0], last = controls.at(-1)!
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener("keydown", key)
    return () => { window.removeEventListener("keydown", key); previousFocus.current?.focus() }
  }, [interactionComplete, onPause, onStep, stepIndex, tutorial.steps.length])

  const content = <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-body" data-testid="tutorial-dialog" className="min-w-0" aria-live="polite">
    <TutorialProgress current={stepIndex} total={tutorial.steps.length}/><p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-primary">{tutorial.name}</p><h2 id="tutorial-title" className="mt-0.5 text-lg font-bold leading-6">{step.title}</h2><p id="tutorial-body" className="mt-1.5 text-sm leading-5 text-muted-foreground">{step.body}</p>
    {tryIt && !interactionComplete && <p className="mt-3 rounded-lg bg-primary/10 p-3 text-sm font-semibold text-primary">Try it: activate the highlighted control. You can still skip or close the tour.</p>}
    {!rect && <p className="mt-2 text-xs font-semibold text-amber-600">This feature is not visible on the current screen, so the explanation is shown here.</p>}
    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap"><button className="min-h-11 rounded-xl border px-3 text-sm font-semibold" disabled={stepIndex === 0} onClick={() => onStep(stepIndex - 1)}>Previous</button>{stepIndex === tutorial.steps.length - 1 ? <button className="min-h-11 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground sm:flex-1" onClick={onComplete}><TutorialCompletion label={tutorial.finishLabel}/></button> : <button disabled={!interactionComplete} className="min-h-11 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1" onClick={() => onStep(stepIndex + 1)}>Next</button>}<button className="col-span-2 min-h-11 rounded-xl px-3 text-sm font-semibold text-muted-foreground sm:col-span-1" onClick={() => setConfirmSkip(true)}>Skip tutorial</button></div>
    <button className="min-h-11 w-full text-sm text-muted-foreground" onClick={onPause}>Close and resume later</button>
    {confirmSkip && <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><p className="text-sm font-semibold">Stop this guided tour?</p><div className="mt-2 flex gap-2"><button className="min-h-11 flex-1 rounded-lg border bg-card px-2 text-sm" onClick={onPause}>Skip for now</button><button className="min-h-11 flex-1 rounded-lg bg-destructive px-2 text-sm font-semibold text-destructive-foreground" onClick={onDismiss}>Don&apos;t show again</button></div></div>}
  </div>
  const width = typeof window === "undefined" ? 1024 : window.innerWidth, height = typeof window === "undefined" ? 768 : window.innerHeight
  const cardWidth = Math.min(352, width - 32), cardHeight = 300, gap = 16
  const coachStyle = rect ? (() => {
    const spaceRight = width - rect.right, spaceLeft = rect.left
    const left = spaceRight >= cardWidth + gap ? rect.right + gap : spaceLeft >= cardWidth + gap ? rect.left - cardWidth - gap : Math.min(width - cardWidth - 16, Math.max(16, rect.left))
    const top = Math.min(height - cardHeight - 16, Math.max(16, rect.top + rect.height / 2 - cardHeight / 2))
    return { left, top }
  })() : { left: "50%", top: "50%", transform: "translate(-50%,-50%)" }
  return <div className="pointer-events-none fixed inset-0 z-[80] h-[100dvh]" data-testid="tutorial-overlay"><div className={`absolute inset-0 bg-foreground/55 ${allowTargetInteraction ? "pointer-events-none" : "pointer-events-auto"}`} aria-hidden/><button aria-label="Close and resume tutorial later" className={`absolute inset-0 cursor-default ${allowTargetInteraction ? "pointer-events-none" : "pointer-events-auto"}`} onClick={onPause}/><TutorialSpotlight rect={rect} interactive={tryIt}/>{isPhone ? <TutorialMobileSheet avoidBottomNavigation={Boolean(bottomTarget)}>{content}</TutorialMobileSheet> : <TutorialCoachmark style={coachStyle}>{content}</TutorialCoachmark>}</div>
}
