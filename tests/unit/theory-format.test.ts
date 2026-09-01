import { describe, expect, it } from "vitest"
import { formatTheorySubquestions } from "../../lib/theory-format"

describe("Theory question formatting", () => {
  it("places consecutive lettered sub-questions in separate paragraphs", () => {
    expect(formatTheorySubquestions("A. Explain each flag. B. Describe two hazards. C. State one prevention."))
      .toBe("A. Explain each flag.\n\nB. Describe two hazards.\n\nC. State one prevention.")
  })

  it("supports parenthesized labels without changing ordinary prose", () => {
    expect(formatTheorySubquestions("A) Explain the finding. B) Give the diagnosis."))
      .toBe("A) Explain the finding.\n\nB) Give the diagnosis.")
    expect(formatTheorySubquestions("Vitamin A. This sentence remains unchanged."))
      .toBe("Vitamin A. This sentence remains unchanged.")
  })

  it("turns Markdown-soft line breaks from structured imports into separate paragraphs", () => {
    expect(formatTheorySubquestions("A. State two advantages.\nB. Sketch the latrine.\nC. Explain why it is preferred."))
      .toBe("A. State two advantages.\n\nB. Sketch the latrine.\n\nC. Explain why it is preferred.")
  })
})
