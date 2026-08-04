import { describe, expect, it } from "vitest"
import {
  classifyQuestionSwipe,
  QUESTION_SWIPE_MAX_DURATION,
  QUESTION_SWIPE_MIN_DISTANCE,
  shouldStartQuestionSwipe,
} from "@/hooks/use-question-swipe-navigation"

describe("question swipe navigation", () => {
  it("maps left and right swipes to the matching question direction", () => {
    expect(classifyQuestionSwipe({ deltaX: -80, deltaY: 8, duration: 250 })).toBe("next")
    expect(classifyQuestionSwipe({ deltaX: 80, deltaY: -8, duration: 250 })).toBe("previous")
  })

  it("rejects gestures shorter than the distance threshold", () => {
    expect(classifyQuestionSwipe({ deltaX: QUESTION_SWIPE_MIN_DISTANCE - 1, deltaY: 0, duration: 200 })).toBeNull()
  })

  it("rejects vertical and diagonal scrolling gestures", () => {
    expect(classifyQuestionSwipe({ deltaX: 58, deltaY: 80, duration: 200 })).toBeNull()
    expect(classifyQuestionSwipe({ deltaX: -60, deltaY: 55, duration: 200 })).toBeNull()
  })

  it("rejects slow horizontal gestures", () => {
    expect(classifyQuestionSwipe({ deltaX: 100, deltaY: 0, duration: QUESTION_SWIPE_MAX_DURATION + 1 })).toBeNull()
  })

  it("starts only for a single touch outside interactive controls", () => {
    expect(shouldStartQuestionSwipe({ enabled: true, touchCount: 1, interactiveTarget: false })).toBe(true)
    expect(shouldStartQuestionSwipe({ enabled: true, touchCount: 2, interactiveTarget: false })).toBe(false)
    expect(shouldStartQuestionSwipe({ enabled: true, touchCount: 1, interactiveTarget: true })).toBe(false)
    expect(shouldStartQuestionSwipe({ enabled: false, touchCount: 1, interactiveTarget: false })).toBe(false)
  })
})
