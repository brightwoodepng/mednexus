export type ScoredAnswer = string | string[] | null

export function sameAnswer(answer: ScoredAnswer, correct: ScoredAnswer) {
  return Array.isArray(answer) && Array.isArray(correct)
    ? answer.length === correct.length && [...answer].sort().every((value, index) => value === [...correct].sort()[index])
    : answer === correct
}
