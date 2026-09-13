import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const quiz = readFileSync("components/quiz-simulator.tsx", "utf8")
const groupStudy = readFileSync("components/group-study/group-study-room.tsx", "utf8")

describe("MCQ answer locking", () => {
  it("offers an optional lock toggle in normal MCQ setup", () => {
    const setup = readFileSync("components/quantity-modal.tsx", "utf8")
    expect(setup).toContain('role="switch"')
    expect(setup).toContain("Lock answer before submitting")
    expect(setup).toContain("Submit immediately when an option is selected.")
  })

  it("keeps a Tutor selection pending when answer locking is enabled", () => {
    expect(quiz).toContain("setPendingSelections(prev => ({ ...prev, [current.id]: optionId }))")
    expect(quiz).toContain("function lockInSingleAnswer()")
    expect(quiz).toContain("function commitSingleAnswer(optionId: string)")
    expect(quiz).toContain("You can change your selection until you lock it.")
  })

  it("does not reveal Tutor feedback from a tentative selection", () => {
    expect(quiz).toContain('committedAnswer !== null)')
    expect(quiz).toContain("requiresAnswerLock && !revealed")
  })

  it("retains the explicit Group Study lock step", () => {
    expect(groupStudy).toContain(">Lock answer</button>")
    expect(groupStudy).toContain('onSubmit={() => act("submit"')
  })
})
