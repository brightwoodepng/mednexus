// ============================================================================
// MedNexus - Shared Type Definitions
// ============================================================================

// ─── User Roles ──────────────────────────────────────────────────────────────

/**
 * Platform-wide role assigned to every user account.
 *   ADMIN       – full administrative access (enforced by server-side session checks)
 *   REGISTERED  – a verified student account in mednexus_registered_users
 *   GUEST       – a temporary, password-free session in mednexus_guest_users
 */
export type UserRole = "ADMIN" | "REGISTERED" | "GUEST"

/**
 * The shape of a registered student as returned by the auth API.
 * Passwords and hashes are never included in API responses.
 */
export interface RegisteredUser {
  uid: string
  name: string
  /** The student's academic class level, e.g. "Level 400". */
  classLevel: string
  /** Backward-compat alias for classLevel — same value, kept for old clients. */
  level: string
  indexNumber: string
  role: "REGISTERED"
  status: "pending" | "approved" | "rejected"
  requiresPasswordUpdate: boolean
}

/**
 * Persistent record for a guest user (stored in mednexus_guest_users).
 * Does not include the raw session token — that is returned only once at
 * creation via GuestAuthResponse.
 */
export interface GuestUser {
  uid: string
  name: string
  classLevel: string
  role: "GUEST"
  /** ISO timestamp — when this guest session expires (7 days from creation). */
  expiresAt: string
  createdAt: string
}

/**
 * Response shape returned by POST /api/auth/guest.
 * Extends GuestUser with the one-time session token.
 */
export interface GuestAuthResponse extends GuestUser {
  /**
   * Signed HMAC session token.  Store on the client (localStorage / cookie)
   * and send as the `x-guest-token` header on subsequent API requests.
   * This is the only time the raw token is ever transmitted — it is never
   * stored in plain text on the server.
   */
  sessionToken: string
}

/**
 * Discriminated union of every authenticated user type.
 * Use the `role` discriminant to narrow to the specific shape.
 */
export type AuthUser = RegisteredUser | GuestUser

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
   * The id(s) of the correct option(s) (matches QuestionOption.id).
   * - string:   single-best-answer (standard MCQ)
   * - string[]: multiple correct answers (SATA — Select All That Apply)
   * - null:     draft/unset
   */
  correctAnswer: string | string[] | null

  /**
   * Structured explanation shown after answering.
   * Nullable to support draft imports where the explanation is not yet written.
   */
  explanation: QuestionExplanation | null

  /**
   * Optional base-64 encoded image extracted from the source document
   * (e.g. a diagram embedded in a Word/PDF file).
   * Stored as a data URI string (e.g. "data:image/png;base64,…") or null.
   */
  mediaBase64?: string | null
}

// ─── Theory Vault (kept separate from the MCQ Question bank) ────────────────

/** Publication workflow shared by Theory content. */
export type TheoryStatus = "draft" | "review" | "published" | "archived"

/** A top-level Theory curriculum collection, such as End of Rotation. */
export interface TheoryCollection {
  id: string
  slug: "end-of-module" | "end-of-year" | string
  title: string
  kind: "end_of_module" | "end_of_year"
  status: TheoryStatus
  sortOrder: number
}

export interface TheoryModule {
  id: string
  collectionId: string
  name: string
  description: string
  sortOrder: number
}

/** A discipline is scoped to a Theory collection, preserving the Theory hierarchy. */
export interface TheoryDiscipline {
  id: string
  collectionId: string
  name: string
  sortOrder: number
}

/** An optional grouping below a Theory discipline. */
export interface TheorySet {
  id: string
  collectionId: string
  moduleId: string | null
  disciplineId: string | null
  name: string
  description: string
  status: TheoryStatus
  questionLimit: number
  sortOrder: number
}

export interface TheorySourceMetadata {
  sourceTitle?: string
  sourceUrl?: string
  pastPaper?: string
  year?: number
  reference?: string
}

/** A free-response Theory item. It intentionally has no MCQ options or answer key. */
export interface TheoryQuestion {
  id: string
  collectionId: string
  moduleId: string | null
  disciplineId: string | null
  setId: string | null
  title: string
  prompt: string
  modelAnswer: string
  keyMarkingPoints: string[]
  marks: number | null
  media: Array<{ type: "image" | "diagram"; url: string; alt?: string }>
  tags: string[]
  sourceMetadata: TheorySourceMetadata
  difficulty: number
  estimatedStudyMinutes: number
  status: TheoryStatus
  sortOrder: number
}

export type TheoryConfidence = "high" | "medium" | "low"
export type TheorySelfRating = "excellent" | "partial" | "needs_revision"
export type TheoryStudyMode = "review" | "practice"

export interface TheoryQuestionState {
  openedAt: string | null
  reviewedAt: string | null
  completedAt: string | null
  confidence: TheoryConfidence | null
  bookmark: boolean
  revision: boolean
  note: string
  draft: { id: string; answerMd: string; updatedAt: string } | null
}

export interface TheoryQuestionDetail extends TheoryQuestion {
  collectionTitle: string
  moduleName: string | null
  disciplineName: string | null
  setTitle: string | null
  setNumber: number | null
  setLabel: string | null
  position: number
  setTotal: number
  previousId: string | null
  nextId: string | null
  state: TheoryQuestionState | null
}

// ─── OSCE Hub (contract only; no learner or editor workspace is exposed) ────

/** Publication workflow for OSCE stations; deliberately independent of Theory. */
export type OsceStationStatus = "draft" | "review" | "published" | "archived"

/** A timed phase presented to a candidate during a station attempt. */
export interface OsceTimingPhase {
  id: string
  kind: "preparation" | "performance"
  durationSeconds: number
  instructions: string
}

export interface OsceChecklistItem {
  id: string
  text: string
  domain?: string
  required: boolean
}

export interface OsceRubricCriterion {
  id: string
  title: string
  description: string
  maxScore: number
  anchors: Array<{ score: number; description: string }>
}

export interface OsceMediaAsset {
  id: string
  kind: "image" | "audio" | "video" | "document"
  url: string
  altText: string
  placement: "candidate" | "examiner" | "both"
}

/** Authorable station content. It never shares a table or editor with MCQs or Theory. */
export interface OsceStation {
  id: string
  title: string
  specialty: string
  tags: string[]
  competencies: string[]
  candidateInstructions: string
  examinerInstructions: string
  timingPhases: OsceTimingPhase[]
  checklist: OsceChecklistItem[]
  scoringRubric: OsceRubricCriterion[]
  media: OsceMediaAsset[]
  status: OsceStationStatus
  createdAt: string
  updatedAt: string
}

/** Learner-owned evidence captured after a station has been made available. */
export interface OsceStationAttempt {
  id: string
  stationId: string
  userId: string
  checklistResponses: Record<string, boolean>
  rubricScores: Record<string, number>
  selfAssessment: string
  examinerFeedback: string
  totalScore: number | null
  startedAt: string
  completedAt: string | null
}

export interface OsceCompetencyProgress {
  competency: string
  attemptCount: number
  latestScore: number | null
  averageScore: number | null
  lastAssessedAt: string | null
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
  selectedOption: string | string[] | null // null = omitted; string[] for SATA
  correctOption: string | string[] | null // null when question is a draft without an answer key
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
  /** NP credited this session (set after payout resolves; undefined until then) */
  earnedNP?: number
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
  isRead: boolean
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
