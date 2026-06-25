// ============================================================================
// MedNexus - Shared Type Definitions
// ============================================================================

/** A single answer choice for a question. */
export interface QuestionOption {
  id: string // e.g. "A", "B", "C"
  text: string
}

/** The structured explanation shown after answering. */
export interface QuestionExplanation {
  objective: string // High-level learning objective
  details: string // Why the correct answer is correct
  incorrectReasoning: string // Why common distractors are wrong
}

/** A single Q-Bank question. */
export interface Question {
  id: string
  module?: string // Parent module grouping (e.g. "Level 400 Clinicals")
  subject: string // Discipline tag (e.g. "Internal Medicine")
  vignette: string
  options: QuestionOption[]
  correctAnswer: string // matches a QuestionOption.id
  explanation: QuestionExplanation
}

/** Quiz delivery modes. */
export type QuizMode = "trial" | "exam"

/** A persisted record of a single answered question (history log). */
export interface HistoryEntry {
  id: string // unique id for the attempt
  questionId: string
  module?: string // parent module
  subject: string // discipline
  vignetteSnippet: string
  mode: QuizMode
  selectedOption: string | null // null = omitted
  correctOption: string
  isCorrect: boolean
  timestamp: number // epoch ms
}

/** A saved exam session score. */
export interface ExamScore {
  id: string
  moduleName: string
  discipline: string | null
  score: number // 0-100 percentage
  total: number
  correct: number
  timeTakenMs: number
  date: string // ISO date string
}

/** Aggregated user progress / global stats. */
export interface UserProgress {
  totalAnswered: number
  totalCorrect: number
  flaggedQuestionIds: string[]
  streak: number
  lastStudyDate: string | null // ISO date string (YYYY-MM-DD)
  history: HistoryEntry[]
  examScores: ExamScore[]
  notificationsLastRead: number // epoch ms; 0 = never read
  mutedNotificationTypes: string[] // e.g. ["info", "update", "alert"]
  favoriteModules: string[] // starred module names
}

/** In-session state for a single quiz block. */
export interface QuizSession {
  mode: QuizMode
  moduleName: string
  discipline: string | null
  questions: Question[]
  currentIndex: number
  answers: Record<string, string | null> // questionId -> selected option
  flagged: Set<string> // flagged question ids (in-session)
  struck: Record<string, Set<string>> // questionId -> set of struck option ids
  submitted: boolean
  startedAt: number
}

/** Result summary after a block is submitted. */
export interface BlockResult {
  total: number
  correct: number
  incorrect: number
  omitted: number
  percentage: number
  rank: ProficiencyRank
  timeTakenMs?: number
}

export type ProficiencyRank = "Expert" | "Proficient" | "Competent" | "Novice"

/** A normal reference range entry for the Lab Values modal. */
export interface LabValue {
  name: string
  range: string
  units?: string
}

export interface LabCategory {
  category: string
  values: LabValue[]
}

/** An admin-broadcast notification message. */
export interface AppNotification {
  id: string
  title: string
  body: string
  type: "info" | "update" | "alert"
  createdAt: string // ISO string
}
