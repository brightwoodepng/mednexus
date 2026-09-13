import { describe, expect, it } from "vitest"
import { IMPORT_QUESTION_BOUNDARY, importQuestionIndexAtOffset } from "@/lib/import-question-boundaries"

describe("MCQ import question boundaries", () => {
  it("does not treat ordinary numbered clinical text as a question", () => {
    expect(IMPORT_QUESTION_BOUNDARY.test("24 hours after admission, urine output falls.")).toBe(false)
    expect(IMPORT_QUESTION_BOUNDARY.test("2023 guidelines recommend follow-up.")).toBe(false)
    expect(IMPORT_QUESTION_BOUNDARY.test("2 litres of saline were given.")).toBe(false)
  })

  it.each(["1. First question", "2) Second question", "(3) Third question", "Question 4", "Q5: Fifth question"])(
    "recognises %s",
    (heading) => expect(IMPORT_QUESTION_BOUNDARY.test(heading)).toBe(true),
  )

  it("keeps a renal image with its question despite numbered text in the stem", () => {
    const text = `1. A patient develops acute kidney injury.\n24 hours later oliguria persists.\n[IMAGE_1]\nA. Prerenal injury\nB. Obstruction\n2. What is the next step?`
    const markerOffset = text.indexOf("[IMAGE_1]")
    expect(importQuestionIndexAtOffset(text, markerOffset)).toBe(0)
  })
})
