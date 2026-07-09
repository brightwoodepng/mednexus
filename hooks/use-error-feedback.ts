"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Universal Error Feedback hook.
 *
 * Triggers:
 * - Web Vibration API double-pulse (100ms on, 50ms off, 100ms on)
 * - CSS shake animation flag (`isShaking`)
 * - Glassmorphic red flash flag (`isFlashing`)
 *
 * All three are gated by the caller — this hook is unconditional;
 * the consumer decides when to call `triggerError()`.
 */
export function useErrorFeedback() {
  const [isShaking, setIsShaking] = useState(false)
  const [isFlashing, setIsFlashing] = useState(false)
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafHandle = useRef<number | null>(null)
  const mounted = useRef(true)

  // Cleanup on unmount — prevents stale state updates after navigation
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      if (shakeTimer.current) clearTimeout(shakeTimer.current)
      if (flashTimer.current) clearTimeout(flashTimer.current)
      if (rafHandle.current !== null) cancelAnimationFrame(rafHandle.current)
    }
  }, [])

  const triggerError = useCallback(() => {
    // Haptics — double-pulse: 100ms on, 50ms off, 100ms on
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate([100, 50, 100]) } catch { /* silently ignore */ }
    }

    // Shake — clear any running timer so rapid wrong answers restart the animation
    if (shakeTimer.current) clearTimeout(shakeTimer.current)
    if (rafHandle.current !== null) cancelAnimationFrame(rafHandle.current)
    setIsShaking(false)
    // One-frame delay forces a DOM reflow so the CSS animation restarts
    // even if isShaking was already true from a previous trigger
    rafHandle.current = requestAnimationFrame(() => {
      if (!mounted.current) return
      setIsShaking(true)
      shakeTimer.current = setTimeout(() => {
        if (mounted.current) setIsShaking(false)
      }, 500)
    })

    // Red flash
    if (flashTimer.current) clearTimeout(flashTimer.current)
    setIsFlashing(true)
    flashTimer.current = setTimeout(() => {
      if (mounted.current) setIsFlashing(false)
    }, 500)
  }, [])

  return { triggerError, isShaking, isFlashing }
}
