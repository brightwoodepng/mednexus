"use client"

import { useEffect, useRef } from "react"
import confetti from "canvas-confetti"
import type { StreakCheerEvent } from "@/hooks/use-streak-engine"

/**
 * Task 4 — High-Octane Streak Cheers [TRIAL MODE ONLY]
 *
 * Fires physics-based spark/fire confetti from the bottom-left AND
 * bottom-right corners simultaneously, shooting inward toward the
 * center of the screen.
 *
 * Displays large, bold, tilted combo text in the screen center with a
 * heavy "pop-in" entrance (scale-up overshoot), a brief hold, then a
 * smooth auto-dismiss — no user interaction required.
 *
 * Strictly dormant when this component receives a null event (i.e. when
 * gamification is off or when no streak threshold has been crossed).
 */

const FIRE_COLORS = [
  "#ff4500", // deep orange-red
  "#ff6a00", // vivid orange
  "#ff8c00", // dark orange
  "#ffa500", // orange
  "#ffcc00", // amber-yellow
  "#ffe066", // light yellow
  "#ff2d2d", // red spark
  "#ffffff",  // white flash
]

/** Maps streak count to display label + emoji */
function comboLabel(streak: number): string {
  if (streak >= 50) return `${streak} HIT COMBO! 🌋`
  if (streak >= 40) return `${streak} HIT COMBO! 💥`
  if (streak >= 30) return `${streak} HIT COMBO! 🚀`
  if (streak >= 20) return `${streak} HIT COMBO! ⚡`
  if (streak >= 15) return `${streak} HIT COMBO! 🥊`
  if (streak >= 10) return `${streak} HIT COMBO! 🥊`
  return `${streak} HIT COMBO! 🔥`
}

interface StreakCheerProps {
  event: StreakCheerEvent | null
  onDone: () => void
}

export function StreakCheer({ event, onDone }: StreakCheerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!event) return

    // Scale particle density with milestone tier (capped to avoid perf hit)
    const particlesTotal = Math.min(60 + event.tier * 14, 140)
    const perCorner = Math.ceil(particlesTotal / 2)

    const shared = {
      particleCount: perCorner,
      spread: 54,
      startVelocity: 55,
      gravity: 0.88,
      decay: 0.91,
      ticks: 230,
      colors: FIRE_COLORS,
      shapes: ["circle", "square"] as confetti.Shape[],
      scalar: 0.92,
      zIndex: 9998,
    }

    // ── Bottom-left corner → shoots up-right (inward) ──
    confetti({ ...shared, angle: 62, origin: { x: 0, y: 1 } })

    // ── Bottom-right corner → shoots up-left (inward) ──
    confetti({ ...shared, angle: 118, origin: { x: 1, y: 1 } })

    // Auto-dismiss: slightly after animation ends (2.1s)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onDone, 2200)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id])

  if (!event) return null

  return (
    /* Full-screen fixed overlay — pointer-events-none so it never blocks
       the quiz UI beneath it. z-[9997] sits just below the confetti canvas
       (z-[9998]) but above everything else in the quiz.                     */
    <div
      key={event.id}
      className="pointer-events-none fixed inset-0 z-[9997] flex items-center justify-center"
      aria-live="assertive"
      aria-atomic="true"
    >
      {/* Subtle radial dark vignette behind text — improves legibility on
          any background without obscuring the quiz content.                  */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 58% 36% at 50% 50%, rgba(0,0,0,0.38) 0%, transparent 100%)",
        }}
      />

      {/* Combo text — large, bold, fire gradient, auto-dismissing via CSS  */}
      <p
        className="animate-combo-pop-in relative select-none text-center font-black leading-none tracking-tighter"
        style={{
          fontSize: "clamp(2.4rem, 9vw, 5rem)",
          background: "linear-gradient(140deg, #ff4500 0%, #ff8c00 42%, #ffcc00 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter:
            "drop-shadow(0 0 28px rgba(255, 110, 0, 0.75)) drop-shadow(0 3px 10px rgba(0,0,0,0.55))",
        }}
      >
        {comboLabel(event.streak)}
      </p>
    </div>
  )
}
