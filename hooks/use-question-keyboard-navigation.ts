"use client"

import { useEffect } from "react"

type KeyboardEventLike = Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"> & {
  target: EventTarget | null
}

/** Keep question shortcuts from hijacking text entry or modified browser shortcuts. */
export function shouldNavigateQuestions(event: KeyboardEventLike) {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return false
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false

  const target = event.target as (EventTarget & {
    tagName?: string
    isContentEditable?: boolean
    closest?: (selector: string) => Element | null
  }) | null

  if (!target) return true
  if (target.isContentEditable) return false
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName ?? "")) return false
  return !target.closest?.("[contenteditable='true'], [role='textbox']")
}

export function useQuestionKeyboardNavigation({
  enabled = true,
  onPrevious,
  onNext,
}: {
  enabled?: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (!shouldNavigateQuestions(event)) return
      event.preventDefault()
      if (event.key === "ArrowLeft") onPrevious()
      else onNext()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, onNext, onPrevious])
}
