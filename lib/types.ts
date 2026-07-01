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

/** Publication status for a module (stored on each question in the module). */
export type ModuleStatus = "live" | "draft" | "offline"

// ─── Context (Parent) ────────────────────────────────────────────────────────

/**
 * The type of shared clinical material a Context holds.
 *   TEXT  – a plain clinical vignette / passage shared across questions
 *   TABLE – a structured data table (e.g. lab results, vitals chart)
 *   IMAGE – a medical image (URL or base-64 data URI)
 *   MIXED – a combination of the above
 */
export type QuestionContextType = "TEXT" | "TABLE" | "IMAGE" | "MIXED"

/**
 * A Context is the *parent* record that holds shared clinical material
 * (a vignette, table, or image) that one or more child questions reference.
 * Stored in the `mednexus_question_contexts` database table.
 */
export interface QuestionContext {
  id: string // UUID primary key
  type: QuestionContextType
  /** Raw content: plain text, Markdown table, or image URL / base-64 URI. */
  content: string
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

// ─── Question (Child) ─────────────────────────────────────────────────────────

/**
 * The structural format of a question stem.
 *   STANDARD_MCQ    – a regular single-best-answer MCQ
 *   ASSERTION_REASON – an assertion + reason pair (both can be T/F, related or not)
 *   MATCHING        – a premise list matched to a response list
 */
export type QuestionType = "STANDARD_MCQ" | "ASSERTION_REASON" | "MATCHING"

/** A single Q-Bank question. */
export interface Question {
  id: string
  module?: string // Parent module grouping (e.g. "Level 400 Clinicals")
  moduleStatus?: ModuleStatus // Publication status of the parent module
  subject: string // Discipline tag (e.g. "Internal Medicine")
  vignette: string

  // ── Context link (optional) ───────────────────────────────────────────────
  /**
   * When set, this question is a *child* of a shared Context.
   * The referenced Context holds the clinical vignette / table / image that
   * is displayed above this question (and possibly siblings that share it).
   */
  contextId?: string | null // FK → mednexus_question_contexts.id

  /**
   * Denormalized content of the parent Context, populated at query time so
   * the UI can render the split-screen panel without a second fetch.
   * Plain text, Markdown, or HTML depending on the context type.
   */
  contextContent?: string | null

  // ── Question format ───────────────────────────────────────────────────────
  /** Defaults to STANDARD_MCQ when omitted (backward-compatible). */
  questionType?: QuestionType

  options: QuestionOption[]

  /**
   * The id of the correct option (matches a QuestionOption.id).
   * Nullable to support draft imports where the answer key is not yet set.
   */
  correctAnswer: string | null

  /**
   * Structured explanation shown after answering.
   * Nullable to support draft imports where the explanation is not yet written.
   */
  explanation: QuestionExplanation | null
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
  correctOption: string | null // null when question is a draft without an answer key
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

/** Per-question spaced-repetition scheduling state. */
export interface SrsEntry {
  interval: number  // days until next review
  ef: number        // ease factor (1.3 – 2.5)
  due: string       // YYYY-MM-DD next review date
  reps: number      // consecutive correct answers
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
  srsData: Record<string, SrsEntry> // questionId → SRS schedule
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
  adminOnly?: boolean
  createdAt: string // ISO string
}

/** A published live assessment (exam) created by admin. */
export interface LiveAssessment {
  id: string
  title: string
  moduleName: string
  questionIds: string[]
  questionCount: number
  timeLimitMins: number
  triesAllowed: number
  passMark: number // percentage 0-100
  status: "live" | "offline"
  shareToken: string
  createdAt: string
}

/** A single attempt at a LiveAssessment by a registered or guest user. */
export interface AssessmentAttempt {
  id: string
  assessmentId: string
  userId: string
  userName: string
  isGuest: boolean
  answers: Record<string, string | null>
  score: number
  total: number
  startedAt: string
  submittedAt: string | null
}

/** Aggregated analytics for a LiveAssessment. */
export interface AssessmentAnalytics {
  totalSubmitted: number
  averageScore: number
  passCount: number
  guestCount: number
  registeredCount: number
}
