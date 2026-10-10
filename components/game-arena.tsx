"use client"

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { Volume2, VolumeX, Vibrate, Sparkles } from "lucide-react"
import { GAME_PRESENTATION, type ArenaMode, type GameOutcome } from "@/lib/game-presentation"
import { GAME_FEEDBACK_KEY, readGameFeedbackPreferences, unlockGameAudio, playGameFeedback } from "@/lib/game-feedback"
import "./game-arena.css"

export function GameArena({ mode, round, total, outcome = null, feedbackKey, streak = 0, timedOut = false, children }: {
  mode: ArenaMode; round: number; total: number; outcome?: GameOutcome; feedbackKey?: string
  streak?: number; timedOut?: boolean; children: ReactNode
}) {
  const theme = GAME_PRESENTATION[mode]
  const [preferences, setPreferences] = useState({ sound: true, haptics: true })
  const [preferencesReady, setPreferencesReady] = useState(false)
  const lastFeedback = useRef<string | null>(null)
  const [celebration, setCelebration] = useState(0)
  useEffect(() => {
    setPreferences(readGameFeedbackPreferences())
    setPreferencesReady(true)
    const update = () => setPreferences(readGameFeedbackPreferences())
    window.addEventListener("storage", update)
    return () => window.removeEventListener("storage", update)
  }, [])

  useEffect(() => {
    if (!outcome || !preferencesReady) return
    const key = mode + ":" + (feedbackKey ?? round) + ":" + outcome
    if (lastFeedback.current === key) return
    lastFeedback.current = key
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
    playGameFeedback(mode, outcome === "correct", preferences, reducedMotion)
    if (outcome === "correct" && !reducedMotion) setCelebration(value => value + 1)
  }, [outcome, feedbackKey, mode, round, preferences, preferencesReady])

  function toggle(key: "sound" | "haptics") {
    const next = { ...preferences, [key]: !preferences[key] }
    setPreferences(next)
    try { localStorage.setItem(GAME_FEEDBACK_KEY, JSON.stringify(next)) } catch {}
    if (next.sound) unlockGameAudio()
  }
  const style = { "--game-accent": theme.accent, "--game-glow": theme.glow } as CSSProperties
  return <section data-game-arena={mode} data-outcome={outcome ?? "ready"} className="game-arena" style={style}
    onPointerDownCapture={() => { if (preferences.sound) unlockGameAudio() }}
    onKeyDownCapture={event => { if (preferences.sound && (event.key === "Enter" || event.key === " ")) unlockGameAudio() }}>
    <div className="game-arena-inner">
      <header className="game-arena-header">
        <div className="flex min-w-0 items-center gap-3">
          <span className="game-mode-emblem" aria-hidden="true">{theme.icon}</span>
          <div className="min-w-0"><h1 className="break-words text-base font-black tracking-tight sm:text-xl">{theme.title}</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">{theme.mission}</p></div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className="game-feedback-toggle" aria-label={preferences.sound ? "Mute game sounds" : "Enable game sounds"} aria-pressed={preferences.sound} onClick={() => toggle("sound")}>{preferences.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button>
          <button type="button" className="game-feedback-toggle" aria-label={preferences.haptics ? "Disable game haptics" : "Enable game haptics"} aria-pressed={preferences.haptics} onClick={() => toggle("haptics")}><Vibrate size={17} /></button>
        </div>
      </header>
      <div className="game-round-track" aria-label={"Round " + round + " of " + total}>
        <span className="text-[10px] font-bold uppercase tracking-widest">Round {round}<span className="opacity-50"> / {total}</span></span>
        <div className="game-round-meter"><div style={{ width: Math.min(100, Math.max(0, (round - (outcome ? 0 : 1)) / Math.max(1, total) * 100)) + "%" }} /></div>
      </div>
      <div className={"game-feedback-line " + (outcome ? "game-feedback-" + outcome : "")} role="status" aria-live="polite" aria-atomic="true">
        <span aria-hidden="true">{outcome === "correct" ? "✦" : outcome === "wrong" ? "↻" : "◆"}</span>
        <span>{outcome === "correct" ? (streak >= 3 ? theme.correct + " · " + streak + " combo!" : theme.correct) : outcome === "wrong" ? (timedOut ? "Time’s up!" : theme.wrong) : theme.mission}</span>
        {outcome === "correct" && <Sparkles size={16} aria-hidden />}
      </div>
      <div className="game-arena-content">{children}</div>
      {outcome === "correct" && celebration > 0 && <div key={celebration} className="game-celebration" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--burst-x": (i - 5.5) * 24 + "px", "--burst-turn": i * 39 + "deg", animationDelay: (i % 3) * .035 + "s", background: i % 2 ? theme.accent : theme.glow } as CSSProperties} />)}
      </div>}
    </div>
  </section>
}
