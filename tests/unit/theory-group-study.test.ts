import { describe, expect, it } from "vitest"
import { publicGroupStudyQuestion, type GroupStudyQuestionSnapshot } from "@/lib/group-study"
import { isTheoryDiscussionTimer } from "@/lib/theory-group-study"

const question: GroupStudyQuestionSnapshot = {
  id: "theory-1", module: "Renal", subject: "Physiology", vignette: "Scenario", options: [], multiple: false, correctAnswer: "", explanation: null,
  theory: { title: "Filtration", prompt: "A. Explain filtration", modelAnswer: "A. Secret answer", keyMarkingPoints: ["Secret marking point"], media: [], hasAnswer: true },
}

describe("Theory Group Study", () => {
  it("withholds both model answers and marking points until revealed", () => {
    const hidden = publicGroupStudyQuestion(question, false)
    expect(JSON.stringify(hidden)).not.toContain("Secret")
    expect(hidden).not.toHaveProperty("correctAnswer")
    expect(hidden).not.toHaveProperty("explanation")
    expect(hidden).toHaveProperty("theory.prompt", question.theory?.prompt)
    expect(publicGroupStudyQuestion(question, true)).toHaveProperty("theory.modelAnswer", "A. Secret answer")
    expect(publicGroupStudyQuestion(question, true)).toHaveProperty("theory.keyMarkingPoints", ["Secret marking point"])
  })
  it("supports prompt-only questions without an answer key", () => {
    const promptOnly = { ...question, theory: { ...question.theory!, modelAnswer: "", hasAnswer: false, keyMarkingPoints: [] } }
    expect(publicGroupStudyQuestion(promptOnly, true)).toHaveProperty("theory.hasAnswer", false)
  })
  it.each([null, 30, 120, 300, 600, 3600])("accepts discussion timer %s", value => expect(isTheoryDiscussionTimer(value)).toBe(true))
  it.each([0, -1, 29, 3601, 60.5, "120", undefined, NaN])("rejects invalid timer %s", value => expect(isTheoryDiscussionTimer(value)).toBe(false))
})
