import { getActiveQuestions } from "./custom-questions"
import type { Question, BlockResult, ProficiencyRank, HistoryEntry } from "./types"

export const ALL_SUBJECTS = "All Subjects"
export const WEAK_AREAS = "Weak Areas"

// ---------------------------------------------------------------------------
// Module helpers (top-level grouping above disciplines)
// If a question has no `module` set, its module = its subject (backward compat)
// ---------------------------------------------------------------------------

function getModuleKey(q: Question): string {
  return q.module?.trim() || q.subject
}

/** All unique module names in the active question bank (sorted). Includes all statuses — used by admin views. */
export function getModules(): string[] {
  return Array.from(new Set(getActiveQuestions().map(getModuleKey))).sort()
}

/**
 * Only modules whose status is "live" (or unset, for backward compatibility).
 * Used by student-facing views — draft and offline modules are hidden.
 */
export function getLiveModules(): string[] {
  const qs = getActiveQuestions().filter((q) => !q.moduleStatus || q.moduleStatus === "live")
  return Array.from(new Set(qs.map(getModuleKey))).sort()
}

/** Disciplines (subjects) that belong to a given module (sorted). */
export function getDisciplinesForModule(module: string): string[] {
  const qs = getActiveQuestions().filter((q) => getModuleKey(q) === module)
  return Array.from(new Set(qs.map((q) => q.subject))).sort()
}

/** Total question count for a module. */
export function getModuleQuestionCount(module: string): number {
  return getActiveQuestions().filter((q) => getModuleKey(q) === module).length
}

/** Questions for a module, optionally filtered by discipline. */
export function getQuestionsForModuleAndDiscipline(
  module: string,
  discipline: string | null,
): Question[] {
  const qs = getActiveQuestions().filter((q) => getModuleKey(q) === module)
  if (discipline) return [...qs.filter((q) => q.subject === discipline)]
  return [...qs]
}

// ---------------------------------------------------------------------------
// Shuffle
// ---------------------------------------------------------------------------

/** Fisher-Yates in-place shuffle — returns the same array. */
export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Return a shuffled, optionally truncated copy of the given question list. */
export function buildCocktail(questions: Question[], quantity: number | null): Question[] {
  const shuffled = shuffleArray([...questions])
  if (quantity !== null && quantity > 0 && quantity < shuffled.length) {
    return shuffled.slice(0, quantity)
  }
  return shuffled
}

// ---------------------------------------------------------------------------
// Legacy subject helpers (used by quiz-simulator and other existing code)
// ---------------------------------------------------------------------------

/** Unique subject/discipline tags found in the active question bank (sorted). */
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

/** Unique module names that have weak questions for a given mode. */
export function getWeakModulesForMode(history: HistoryEntry[], mode: "trial" | "exam"): string[] {
  const modeHistory = history.filter((e) => e.mode === mode)
  const weakQs = getWeakAreaQuestions(modeHistory)
  return Array.from(new Set(weakQs.map((q) => q.module?.trim() || q.subject))).sort()
}

/** Disciplines within a module that have weak questions for a given mode. */
export function getWeakDisciplinesForModule(history: HistoryEntry[], mode: "trial" | "exam", moduleName: string): string[] {
  const modeHistory = history.filter((e) => e.mode === mode)
  const weakQs = getWeakAreaQuestions(modeHistory)
  const modQs = weakQs.filter((q) => (q.module?.trim() || q.subject) === moduleName)
  return Array.from(new Set(modQs.map((q) => q.subject))).sort()
}

/** Count of weak questions for a module/discipline in a given mode. */
export function getWeakCountForModule(history: HistoryEntry[], mode: "trial" | "exam", moduleName: string, discipline?: string): number {
  const modeHistory = history.filter((e) => e.mode === mode)
  const weakQs = getWeakAreaQuestions(modeHistory)
  let modQs = weakQs.filter((q) => (q.module?.trim() || q.subject) === moduleName)
  if (discipline) modQs = modQs.filter((q) => q.subject === discipline)
  return modQs.length
}

/**
 * Return weak questions filtered by mode, grouped by module name.
 * Returns a map of { moduleName → weakQuestionCount }.
 */
export function getWeakModuleBreakdown(
  history: HistoryEntry[],
  mode: "trial" | "exam",
): Record<string, number> {
  const modeHistory = history.filter((e) => e.mode === mode)
  const weakQs = getWeakAreaQuestions(modeHistory)
  const breakdown: Record<string, number> = {}
  for (const q of weakQs) {
    const mod = q.module?.trim() || q.subject
    breakdown[mod] = (breakdown[mod] ?? 0) + 1
  }
  return breakdown
}

/**
 * Weak questions filtered by mode and optional module/discipline.
 * Returns the actual Question objects — used by SRS sorting and due-count logic.
 */
export function getWeakQuestionsForMode(
  history: HistoryEntry[],
  mode: "trial" | "exam",
  moduleName?: string,
  discipline?: string,
): Question[] {
  const modeHistory = history.filter((e) => e.mode === mode)
  let qs = getWeakAreaQuestions(modeHistory)
  if (moduleName) qs = qs.filter((q) => (q.module?.trim() || q.subject) === moduleName)
  if (discipline) qs = qs.filter((q) => q.subject === discipline)
  return qs
}

/** Assign a proficiency rank from a percentage score. */
export function rankFor(percentage: number): ProficiencyRank {
  if (percentage >= 85) return "Expert"
  if (percentage >= 70) return "Proficient"
  if (percentage >= 50) return "Competent"
  return "Novice"
}

/** Compute the result summary for a finished block. */
export function computeResult(questions: Question[], answers: Record<string, string | null>, timeTakenMs?: number): BlockResult {
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
  return { total, correct, incorrect, omitted, percentage, rank: rankFor(percentage), timeTakenMs }
}

// ---------------------------------------------------------------------------
// Coverage statistics (Trial mode — per-discipline)
// ---------------------------------------------------------------------------

/** Discipline coverage: attempted unique question IDs per discipline vs total. */
export function getDisciplineCoverage(
  history: HistoryEntry[],
): Record<string, { attempted: number; total: number; correct: number }> {
  const qs = getActiveQuestions()
  // Group total question counts by discipline
  const totals: Record<string, number> = {}
  for (const q of qs) {
    totals[q.subject] = (totals[q.subject] ?? 0) + 1
  }
  // Compute attempted unique IDs per discipline from history (trial mode)
  const trialHistory = history.filter((e) => e.mode === "trial")
  const attemptedByDiscipline: Record<string, Set<string>> = {}
  const correctByDiscipline: Record<string, number> = {}
  for (const e of trialHistory) {
    if (!attemptedByDiscipline[e.subject]) attemptedByDiscipline[e.subject] = new Set()
    attemptedByDiscipline[e.subject].add(e.questionId)
    if (e.isCorrect) correctByDiscipline[e.subject] = (correctByDiscipline[e.subject] ?? 0) + 1
  }
  const result: Record<string, { attempted: number; total: number; correct: number }> = {}
  for (const [disc, total] of Object.entries(totals)) {
    result[disc] = {
      attempted: attemptedByDiscipline[disc]?.size ?? 0,
      total,
      correct: correctByDiscipline[disc] ?? 0,
    }
  }
  return result
}
