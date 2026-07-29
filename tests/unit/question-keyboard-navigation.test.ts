import { describe, expect, it } from "vitest"
import { shouldNavigateQuestions } from "@/hooks/use-question-keyboard-navigation"

function keyboardEvent(key: string, target: unknown = null, modifiers = {}) {
  return {
    key,
    target,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  } as Parameters<typeof shouldNavigateQuestions>[0]
}

describe("question keyboard navigation", () => {
  it.each(["ArrowLeft", "ArrowRight"])("accepts the %s key", (key) => {
    expect(shouldNavigateQuestions(keyboardEvent(key))).toBe(true)
  })

  it("ignores unrelated and modified shortcuts", () => {
    expect(shouldNavigateQuestions(keyboardEvent("Enter"))).toBe(false)
    expect(shouldNavigateQuestions(keyboardEvent("ArrowRight", null, { metaKey: true }))).toBe(false)
    expect(shouldNavigateQuestions(keyboardEvent("ArrowLeft", null, { altKey: true }))).toBe(false)
  })

  it.each(["INPUT", "TEXTAREA", "SELECT"])("does not navigate while a %s has focus", (tagName) => {
    expect(shouldNavigateQuestions(keyboardEvent("ArrowRight", { tagName }))).toBe(false)
  })

  it("does not navigate from editable or textbox content", () => {
    expect(shouldNavigateQuestions(keyboardEvent("ArrowLeft", { isContentEditable: true }))).toBe(false)
    expect(shouldNavigateQuestions(keyboardEvent("ArrowRight", { closest: () => ({}) }))).toBe(false)
  })
})
