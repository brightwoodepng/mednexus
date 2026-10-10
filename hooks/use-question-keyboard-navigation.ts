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
  onOptionNavigate,
  onOptionConfirm,
}: {
  enabled?: boolean
  onPrevious: () => void
  onNext: () => void
  onOptionNavigate?: (direction: -1 | 1) => void
  onOptionConfirm?: () => void
}) {
  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || document.querySelector('[role="dialog"][aria-modal="true"]')) return
      if ((event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter") && shouldNavigateQuestions({ ...event, key: "ArrowRight", altKey: event.altKey, ctrlKey: event.ctrlKey, metaKey: event.metaKey, shiftKey: event.shiftKey, target: event.target })) {
        if (event.key === "Enter") { if (onOptionConfirm && !(event.target as Element)?.closest?.("button, a")) { event.preventDefault(); onOptionConfirm() } }
        else if (onOptionNavigate) { event.preventDefault(); onOptionNavigate(event.key === "ArrowUp" ? -1 : 1) }
        return
      }
      if (!shouldNavigateQuestions(event)) return
      event.preventDefault()
      if (event.key === "ArrowLeft") onPrevious()
      else onNext()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, onNext, onPrevious, onOptionNavigate, onOptionConfirm])
}
