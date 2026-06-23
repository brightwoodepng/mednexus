import { getActiveQuestions } from "./custom-questions"
import type { Question, BlockResult, ProficiencyRank, HistoryEntry } from "./types"

export const ALL_SUBJECTS = "All Subjects"
export const WEAK_AREAS = "Weak Areas"

/** Unique subject tags found in the active question bank (sorted). */
export function getSubjects(): string[] {
  return Array.from(new Set(getActiveQuestions().map((q) => q.subject))).sort()
}

/** Number of questions for a given subject (or the entire bank). */
export function getQuestionCount(subject: string, history?: HistoryEntry[]): number {
  if (subject === WEAK_AREAS) return history ? getWeakAreaQuestions(history).length : 0
  const qs = getActiveQuestions()
  if (subject === ALL_SUBJECTS) return qs.length
  return qs.filter((q) => q.subject === subject).length
}

/** Return the questions for a module. Always returns a new array. */
export function getQuestionsForModule(subject: string): Question[] {
  const qs = getActiveQuestions()
  const list = subject === ALL_SUBJECTS ? qs : qs.filter((q) => q.subject === subject)
  return [...list]
}

/**
 * Return questions where the user's most recent attempt was incorrect.
 * Deduped by questionId — only the latest attempt counts.
 */
export function getWeakAreaQuestions(history: HistoryEntry[]): Question[] {
  const qs = getActiveQuestions()
  const latestByQuestion = new Map<string, HistoryEntry>()
  for (const entry of history) {
    const existing = latestByQuestion.get(entry.questionId)
    if (!existing || entry.timestamp > existing.timestamp) {
      latestByQuestion.set(entry.questionId, entry)
    }
  }
  const weakIds = new Set<string>()
  for (const [qId, entry] of latestByQuestion) {
    if (!entry.isCorrect) weakIds.add(qId)
  }
  return qs.filter((q) => weakIds.has(q.id))
}

/** Assign a proficiency rank from a percentage score. */
export function rankFor(percentage: number): ProficiencyRank {
  if (percentage >= 85) return "Expert"
  if (percentage >= 70) return "Proficient"
  if (percentage >= 50) return "Competent"
  return "Novice"
}

/** Compute the result summary for a finished block. */
export function computeResult(questions: Question[], answers: Record<string, string | null>): BlockResult {
  let correct = 0
  let incorrect = 0
  let omitted = 0
  for (const q of questions) {
    const a = answers[q.id]
    if (a == null) omitted++
    else if (a === q.correctAnswer) correct++
    else incorrect++
  }
  const total = questions.length
  const percentage = total ? Math.round((correct / total) * 100) : 0
  return { total, correct, incorrect, omitted, percentage, rank: rankFor(percentage) }
}
