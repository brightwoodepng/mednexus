"use client"

import { useEffect, useState, type RefObject } from "react"
import type { CosmeticMotionState } from "./types"

export function resolveCosmeticMotionState(
  requested: CosmeticMotionState,
  visible: boolean,
  prefersReducedMotion: boolean,
): CosmeticMotionState {
  if (prefersReducedMotion) return "reduced"
  return visible ? requested : "static"
}

/**
 * Pauses cosmetic motion outside the viewport without an animation-frame state
 * loop. A single IntersectionObserver update is made only when visibility flips.
 */
export function useCosmeticMotion<T extends Element>(
  ref: RefObject<T | null>,
  requested: CosmeticMotionState = "static",
) {
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "80px 0px",
      threshold: 0.01,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return resolveCosmeticMotionState(requested, visible, reduced)
}
