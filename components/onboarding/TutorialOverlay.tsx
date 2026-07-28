"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { TutorialDefinition } from "./tutorials"
import { TutorialProgress } from "./TutorialProgress"
import { TutorialSpotlight } from "./TutorialSpotlight"
import { TutorialCoachmark } from "./TutorialCoachmark"
import { TutorialMobileSheet } from "./TutorialMobileSheet"
import { TutorialCompletion } from "./TutorialCompletion"

export function TutorialOverlay({ tutorial, stepIndex, onStep, onComplete, onPause, onDismiss }: { tutorial: TutorialDefinition; stepIndex: number; onStep: (step: number) => void; onComplete: () => void; onPause: () => void; onDismiss: () => void }) {
  const step = tutorial.steps[stepIndex]
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const previousFocus = useRef<HTMLElement | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-tutorial-anchor="${step.targetAnchorId}"]`)
    if (target) { target.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); setRect(target.getBoundingClientRect()) } else setRect(null)
  }, [step])
  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement
    requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("button")?.focus())
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") onPause(); if (event.key === "ArrowRight" && stepIndex < tutorial.steps.length - 1) onStep(stepIndex + 1); if (event.key === "ArrowLeft" && stepIndex > 0) onStep(stepIndex - 1) }
    window.addEventListener("keydown", key)
    return () => { window.removeEventListener("keydown", key); previousFocus.current?.focus() }
  }, [onPause, onStep, stepIndex, tutorial.steps.length])
  const content = <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-body" data-testid="tutorial-dialog">
    <TutorialProgress current={stepIndex} total={tutorial.steps.length}/><p className="mt-3 text-xs font-bold uppercase tracking-widest text-primary">{tutorial.name}</p><h2 id="tutorial-title" className="mt-1 text-xl font-bold">{step.title}</h2><p id="tutorial-body" className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>{!rect && <p className="mt-2 text-xs font-semibold text-amber-600">This feature is not visible on the current screen, so the explanation is shown here.</p>}
    <div className="mt-5 flex flex-wrap items-center gap-2"><button className="min-h-11 rounded-xl border px-4 text-sm font-semibold" disabled={stepIndex === 0} onClick={() => onStep(stepIndex - 1)}>Previous</button>{stepIndex === tutorial.steps.length - 1 ? <button className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground" onClick={onComplete}><TutorialCompletion label={tutorial.finishLabel}/></button> : <button className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground" onClick={() => onStep(stepIndex + 1)}>Next</button>}<button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-muted-foreground" onClick={() => setConfirmSkip(true)}>Skip tutorial</button></div>
    <button className="mt-2 min-h-11 w-full text-sm text-muted-foreground" onClick={onPause}>Close and resume later</button>
    {confirmSkip && <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"><p className="text-sm font-semibold">Stop this guided tour?</p><div className="mt-2 flex gap-2"><button className="min-h-11 flex-1 rounded-lg border bg-card px-2 text-sm" onClick={onPause}>Skip for now</button><button className="min-h-11 flex-1 rounded-lg bg-destructive px-2 text-sm font-semibold text-destructive-foreground" onClick={onDismiss}>Don&apos;t show again</button></div></div>}
  </div>
  const coachStyle = rect ? { left: Math.min(window.innerWidth - 400, Math.max(16, rect.left)), top: Math.min(window.innerHeight - 380, rect.bottom + 16) } : { left: "50%", top: "50%", transform: "translate(-50%,-50%)" }
  return <div className="fixed inset-0 z-[80]" data-testid="tutorial-overlay"><div className="absolute inset-0 bg-foreground/55" aria-hidden/><button aria-label="Close and resume tutorial later" className="absolute inset-0 cursor-default" onClick={onPause}/><TutorialSpotlight rect={rect}/><TutorialCoachmark style={coachStyle}>{content}</TutorialCoachmark><TutorialMobileSheet>{content}</TutorialMobileSheet></div>
}
