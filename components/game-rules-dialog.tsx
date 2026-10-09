"use client"

import { useEffect, useId, useRef } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

export function GameRulesDialog({ game, onClose, onContinue }: {
  game: { name: string; icon: string; gradient: string; desc: string; rules: string[] }
  onClose: () => void; onContinue: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    continueRef.current?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose() }
      if (event.key !== "Tab") return
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])")
      if (!buttons?.length) return
      const first = buttons[0], last = buttons[buttons.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener("keydown", keydown)
    return () => {
      document.removeEventListener("keydown", keydown)
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <header className="flex shrink-0 items-start gap-3 px-5 pt-5">
          <span aria-hidden="true" className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${game.gradient} text-3xl shadow-md`}>{game.icon}</span>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Before you play</p><h2 id={titleId} className="mt-1 break-words text-xl font-extrabold text-foreground">{game.name}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close game rules" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X size={19}/></button>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-5">
          <p id={descriptionId} className="text-sm leading-relaxed text-muted-foreground">{game.desc}</p>
          <h3 className="mt-5 text-sm font-bold text-foreground">How to play</h3>
          <ul className="mt-3 space-y-3">{game.rules.map(rule => <li key={rule} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"/><span>{rule}</span></li>)}</ul>
        </div>
        <footer className="flex shrink-0 flex-col gap-2 border-t border-border p-4">
          <button ref={continueRef} type="button" onClick={onContinue} className={`min-h-12 rounded-2xl bg-gradient-to-r ${game.gradient} px-4 py-3 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}>Continue to setup</button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Back to games</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
