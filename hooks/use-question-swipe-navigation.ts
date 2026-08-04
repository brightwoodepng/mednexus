"use client"

import { useRef, type TouchEventHandler } from "react"

export const QUESTION_SWIPE_MIN_DISTANCE = 56
export const QUESTION_SWIPE_MAX_DURATION = 700
export const QUESTION_SWIPE_AXIS_RATIO = 1.25

const INTERACTIVE_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  "[role='button']",
  "[role='checkbox']",
  "[role='textbox']",
  "[contenteditable='true']",
  "[data-question-swipe-ignore]",
].join(", ")

export type QuestionSwipeDirection = "previous" | "next"

export function classifyQuestionSwipe({
  deltaX,
  deltaY,
  duration,
}: {
  deltaX: number
  deltaY: number
  duration: number
}): QuestionSwipeDirection | null {
  const horizontalDistance = Math.abs(deltaX)
  if (duration > QUESTION_SWIPE_MAX_DURATION) return null
  if (horizontalDistance < QUESTION_SWIPE_MIN_DISTANCE) return null
  if (horizontalDistance < Math.abs(deltaY) * QUESTION_SWIPE_AXIS_RATIO) return null
  return deltaX < 0 ? "next" : "previous"
}

export function isQuestionSwipeInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(INTERACTIVE_SELECTOR))
}

export function shouldStartQuestionSwipe({
  enabled,
  touchCount,
  interactiveTarget,
}: {
  enabled: boolean
  touchCount: number
  interactiveTarget: boolean
}) {
  return enabled && touchCount === 1 && !interactiveTarget
}

type SwipeStart = { x: number; y: number; startedAt: number } | null

export function useQuestionSwipeNavigation({
  enabled = true,
  onPrevious,
  onNext,
  onNavigate,
}: {
  enabled?: boolean
  onPrevious: () => void
  onNext: () => void
  onNavigate?: (direction: QuestionSwipeDirection) => void
}) {
  const startRef = useRef<SwipeStart>(null)

  const onTouchStart: TouchEventHandler<HTMLElement> = (event) => {
    startRef.current = null
    if (!shouldStartQuestionSwipe({
      enabled,
      touchCount: event.touches.length,
      interactiveTarget: isQuestionSwipeInteractiveTarget(event.target),
    })) return

    const touch = event.touches[0]
    startRef.current = { x: touch.clientX, y: touch.clientY, startedAt: Date.now() }
  }

  const onTouchEnd: TouchEventHandler<HTMLElement> = (event) => {
    const start = startRef.current
    startRef.current = null
    if (!enabled || !start || event.changedTouches.length !== 1) return

    const touch = event.changedTouches[0]
    const direction = classifyQuestionSwipe({
      deltaX: touch.clientX - start.x,
      deltaY: touch.clientY - start.y,
      duration: Date.now() - start.startedAt,
    })
    if (!direction) return

    if (direction === "next") onNext()
    else onPrevious()
    onNavigate?.(direction)
  }

  const onTouchCancel: TouchEventHandler<HTMLElement> = () => {
    startRef.current = null
  }

  return { onTouchStart, onTouchEnd, onTouchCancel }
}
