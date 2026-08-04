export const ASSESSMENT_GRADING_MODES = ["standard", "negative"] as const

export type AssessmentGradingMode = typeof ASSESSMENT_GRADING_MODES[number]

export type AssessmentGrade = {
  score: number
  total: number
  percentage: number
  passed: boolean
  correct: number
  wrong: number
  unanswered: number
}

export function isAssessmentGradingMode(value: unknown): value is AssessmentGradingMode {
  return typeof value === "string" && ASSESSMENT_GRADING_MODES.includes(value as AssessmentGradingMode)
}

export function assessmentPercentage(score: number, total: number) {
  return total > 0 ? Math.round(score / total * 100) : 0
}

export function gradingModeLabel(mode: AssessmentGradingMode) {
  return mode === "negative" ? "Negative (+1 / −1 / 0)" : "Standard (+1 / 0 / 0)"
}

export function gradeAssessment(
  questionIds: string[],
  correctAnswers: ReadonlyMap<string, string>,
  answers: Record<string, string | null>,
  mode: AssessmentGradingMode,
  passMark: number,
): AssessmentGrade {
  let correct = 0
  let wrong = 0
  let unanswered = 0

  for (const questionId of questionIds) {
    const answer = answers[questionId]
    if (typeof answer !== "string" || answer.trim() === "") {
      unanswered += 1
    } else if (answer === correctAnswers.get(questionId)) {
      correct += 1
    } else {
      wrong += 1
    }
  }

  const score = correct - (mode === "negative" ? wrong : 0)
  const total = questionIds.length
  const percentage = assessmentPercentage(score, total)
  return { score, total, percentage, passed: percentage >= passMark, correct, wrong, unanswered }
}
