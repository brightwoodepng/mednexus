"use client"

import { useEffect, useRef } from "react"
import confetti from "canvas-confetti"
import { FlameIcon } from "@/components/icons"
import type { StreakCheerEvent } from "@/hooks/use-streak-engine"

interface StreakCheerProps {
  event: StreakCheerEvent | null
  onDone: () => void
}

function tierMessage(tier: number): string {
  if (tier >= 5) return "LEGENDARY RUN!"
  if (tier >= 3) return "UNSTOPPABLE!"
  if (tier >= 2) return "ON FIRE!"
  return "STREAK!"
}

/**
 * Physics-based streak cheer — glassmorphic toast + canvas-confetti burst.
 * Purely presentational; caller (Trial Mode QuizSimulator) decides when to
 * fire it via the Dynamic Streak Engine, gated on gamification opt-in.
 */
export function StreakCheer({ event, onDone }: StreakCheerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!event) return

    // Physics-based confetti burst, scaled gently with milestone tier.
    const particleCount = Math.min(40 + event.tier * 15, 120)
    confetti({
      particleCount,
      spread: 70,
      startVelocity: 32,
      gravity: 1.1,
      ticks: 160,
      scalar: 0.9,
      origin: { x: 0.5, y: 0.22 },
      colors: ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f472b6"],
      zIndex: 80,
    })

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(onDone, 1800)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id])

  if (!event) return null

  return (
    <div
      key={event.id}
      className="pointer-events-none fixed inset-x-0 top-6 z-[75] flex justify-center px-4 animate-streak-cheer-in"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 shadow-2xl shadow-black/20 backdrop-blur-2xl ring-1 ring-white/10 dark:bg-white/[0.06]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/30 via-orange-500/30 to-rose-500/30 ring-1 ring-white/20">
          <FlameIcon size={20} className="text-amber-400" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-extrabold tracking-wide text-foreground">
            {tierMessage(event.tier)}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {event.streak} in a row 🔥
          </span>
        </div>
      </div>
    </div>
  )
}
