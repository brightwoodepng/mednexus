"use client"

import { useCallback, useRef, useState } from "react"

/**
 * Dynamic Streak Engine [TRIAL MODE ONLY]
 *
 * Scales streak-cheer thresholds to the total number of questions selected
 * for the session, preventing pop-up fatigue on large quizzes.
 *
 *   20–50 questions   → cheer every 5 consecutive correct
 *   51–100 questions  → cheer every 10 consecutive correct
 *   101–150 questions → cheer every 15 consecutive correct
 *   151+ questions    → cheer every 20 consecutive correct
 *   <20 questions     → cheer every 5 consecutive correct (short-session default)
 *
 * Entirely dormant unless `enabled` is true (i.e. gamification opted-in for
 * this Trial Mode session).
 */

export interface StreakCheerEvent {
  /** Current consecutive-correct streak length that triggered this cheer */
  streak: number
  /** The dynamic threshold used for this session */
  threshold: number
  /** Milestone tier — increments each time the streak crosses another threshold multiple */
  tier: number
  /** Monotonic id so consumers can key/dedupe re-renders of the same event */
  id: number
}

export function getStreakThreshold(totalQuestions: number): number {
  if (totalQuestions > 150) return 20
  if (totalQuestions > 100) return 15
  if (totalQuestions > 50) return 10
  return 5
}

export function useStreakEngine(totalQuestions: number, enabled: boolean) {
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [cheerEvent, setCheerEvent] = useState<StreakCheerEvent | null>(null)

  const threshold = getStreakThreshold(totalQuestions)
  const cheerIdRef = useRef(0)

  const recordAnswer = useCallback((correct: boolean) => {
    if (!enabled) return

    setStreak((prev) => {
      const next = correct ? prev + 1 : 0

      setBestStreak((best) => Math.max(best, next))

      // Fire a cheer exactly on each threshold multiple — never on 0.
      if (next > 0 && next % threshold === 0) {
        cheerIdRef.current += 1
        setCheerEvent({
          streak: next,
          threshold,
          tier: next / threshold,
          id: cheerIdRef.current,
        })
      }

      return next
    })
  }, [enabled, threshold])

  const clearCheer = useCallback(() => setCheerEvent(null), [])

  const reset = useCallback(() => {
    setStreak(0)
    setBestStreak(0)
    setCheerEvent(null)
  }, [])

  return { streak, bestStreak, threshold, cheerEvent, recordAnswer, clearCheer, reset, enabled }
}
