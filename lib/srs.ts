// ============================================================================
// MedNexus — Spaced Repetition System (SM-2 inspired)
// Tracks per-question review schedules so the most overdue weak questions
// surface first when studying Weak Areas.
// ============================================================================

import type { HistoryEntry } from "./types"

export interface SrsEntry {
  interval: number  // days until next review
  ef: number        // ease factor (1.3 – 2.5)
  due: string       // YYYY-MM-DD, next scheduled review date
  reps: number      // consecutive correct answers streak
}

const DEFAULT_EF = 2.5
const MIN_EF = 1.3
const MAX_EF = 2.5

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(base: string, days: number): string {
  const d = new Date(base + "T12:00:00")
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Compute an updated SrsEntry after a question is answered.
 *
 * Correct answers grow the interval exponentially (×ef).
 * Wrong answers reset interval to 1 day and reduce the ease factor.
 */
export function updateEntry(entry: SrsEntry | undefined, correct: boolean): SrsEntry {
  const today = todayStr()
  const prev: SrsEntry = entry ?? { interval: 1, ef: DEFAULT_EF, due: today, reps: 0 }

  if (correct) {
    const reps = prev.reps + 1
    let interval: number
    if (reps === 1) interval = 1
    else if (reps === 2) interval = 4
    else interval = Math.max(1, Math.round(prev.interval * prev.ef))

    const ef = Math.min(MAX_EF, prev.ef + 0.08)

    return { interval, ef, due: addDays(today, interval), reps }
  } else {
    return {
      interval: 1,
      ef: Math.max(MIN_EF, prev.ef - 0.2),
      due: addDays(today, 1),
      reps: 0,
    }
  }
}

/**
 * Bulk-update an srsData map from a set of completed quiz history entries.
 * Omitted questions (selectedOption === null) are skipped — no schedule change.
 */
export function updateSrsFromHistory(
  srsData: Record<string, SrsEntry>,
  entries: HistoryEntry[],
): Record<string, SrsEntry> {
  const next = { ...srsData }
  for (const e of entries) {
    if (e.selectedOption === null) continue
    next[e.questionId] = updateEntry(next[e.questionId], e.isCorrect)
  }
  return next
}

/**
 * How many days overdue is a question.
 * Positive  → overdue (past due date).
 * 0         → due today.
 * Negative  → not yet due (upcoming).
 * No entry  → 0 (unscheduled; treated as due-today for quiz sorting only —
 *              but NOT shown as "due now" in the UI, see isDue).
 */
export function daysOverdue(entry: SrsEntry | undefined): number {
  if (!entry) return 0
  const today = todayStr()
  return Math.round(
    (new Date(today + "T12:00:00").getTime() - new Date(entry.due + "T12:00:00").getTime()) /
      86_400_000,
  )
}

/**
 * True when a question has been SRS-reviewed at least once AND is due today or overdue.
 * Questions with no SRS entry (never reviewed via SRS) are NOT counted as due —
 * they are "unscheduled" and shown simply as "to review".
 */
export function isDue(entry: SrsEntry | undefined): boolean {
  if (!entry) return false
  return entry.due <= todayStr()
}

/** Count due questions from a list of question IDs. */
export function countDue(questionIds: string[], srsData: Record<string, SrsEntry>): number {
  return questionIds.filter((id) => isDue(srsData[id])).length
}

/**
 * Sort questions by urgency (most overdue first, then due today, then soonest future).
 * Questions with no SRS entry are treated as most urgent (never studied).
 */
export function sortByUrgency<T extends { id: string }>(
  questions: T[],
  srsData: Record<string, SrsEntry>,
): T[] {
  return [...questions].sort((a, b) => daysOverdue(srsData[b.id]) - daysOverdue(srsData[a.id]))
}

/**
 * Human-readable label for a due date relative to today.
 * e.g. "Due now", "Due in 3 days", "3 days overdue"
 */
export function dueLabel(entry: SrsEntry | undefined): string {
  if (!entry) return "New"
  const d = daysOverdue(entry)
  if (d >= 1) return d === 1 ? "1 day overdue" : `${d} days overdue`
  if (d === 0) return "Due today"
  const ahead = Math.abs(d)
  return ahead === 1 ? "Due tomorrow" : `Due in ${ahead} days`
}
