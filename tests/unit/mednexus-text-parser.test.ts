import { describe, expect, it } from "vitest"
import { parseMednexusText } from "@/lib/mednexus-text-parser"

describe("MedNexus formatted text parser", () => {
  it("parses a complete tagged question without an AI provider", () => {
    const parsed = parseMednexusText(`
MODULE: Integument II
DISCIPLINE: Dermatology

1. Which option is correct?
A. First
B. Second
C. Third
D. Fourth
Answer: C
Explanation: The third option is correct.
`)

    expect(parsed).toEqual([{
      module: "Integument II",
      discipline: "Dermatology",
      vignette: "Which option is correct?",
      options: [
        { id: "A", text: "First" },
        { id: "B", text: "Second" },
        { id: "C", text: "Third" },
        { id: "D", text: "Fourth" },
      ],
      correctAnswer: "C",
      explanation: "The third option is correct.",
      sourceQuestionNumber: 1,
    }])
  })

  it("accepts an answer letter on the line after the Answer tag", () => {
    const [question] = parseMednexusText(`
1. A question with a Word-style split answer.
A. First
B. Second
C. Third
Answer:
C
Explanation:
This explanation was also split onto the next line.
`, "Integument II", "Dermatology")

    expect(question.correctAnswer).toBe("C")
    expect(question.explanation).toBe("This explanation was also split onto the next line.")
    expect(question.options[2]).toEqual({ id: "C", text: "Third" })
  })

  it("preserves image markers for later attachment", () => {
    const [question] = parseMednexusText(`
1. Identify the finding shown.
[IMAGE_4]
A. First
B. Second
Answer: A
`)

    expect(question.vignette).toContain("[IMAGE_4]")
  })

  it("carries explicit and fallback categorization without inference", () => {
    const questions = parseMednexusText(`
1. First question.
A. One
B. Two
Answer: A

DISCIPLINE: Pathology
2. Second question.
A. One
B. Two
Answer: B
`, "Integument II", "Dermatology")

    expect(questions.map((question) => question.discipline)).toEqual(["Dermatology", "Pathology"])
    expect(questions.every((question) => question.module === "Integument II")).toBe(true)
  })

  it("does not invent a default answer when the source answer is absent", () => {
    const [question] = parseMednexusText(`
1. An unanswered question.
A. One
B. Two
`)

    expect(question.correctAnswer).toBeNull()
  })
})
