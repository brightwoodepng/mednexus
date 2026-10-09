import type { QuizMode, Question, HistoryEntry } from "@/lib/types"

export const QUIZ_SESSION_VERSION = 1 as const
export const TRIAL_TIMER_POLICY = "untimed" as const
const KEY_PREFIX = "mednexus:quiz-session:v1:"

export type QuizAnswer = string | string[] | null

export interface QuizSession {
  version: typeof QUIZ_SESSION_VERSION
  userId: string
  questionIds: string[]
  moduleName: string
  discipline: string | null
  setupModule: string
  mode: QuizMode
  gamificationEnabled: boolean
  lockAnswers: boolean
  currentQuestionIndex: number
  recordedQuestionIds?: string[]
  pendingSelections?: Record<string, string>
  answers: Record<string, QuizAnswer>
  struckOptions: Record<string, string[]>
  sataSelections: Record<string, string[]>
  sataLockedQuestionIds: string[]
  flaggedQuestionIds: string[]
  updatedAt?: number
  startedAt: number
  durationSeconds: number
  trialTimerPolicy: typeof TRIAL_TIMER_POLICY
  scoringSessionId?: string
}

export interface RestoredQuizSession {
  session: QuizSession
  questions: Question[]
  expired: boolean
  remainingSeconds: number | null
}

export function quizSessionStorageKey(userId: string) {
  return `${KEY_PREFIX}${encodeURIComponent(userId)}`
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string")
}

export function parseQuizSession(raw: string | null, expectedUserId: string): QuizSession | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<QuizSession>
    if (value.version !== QUIZ_SESSION_VERSION || value.userId !== expectedUserId) return null
    if (!isStringArray(value.questionIds) || value.questionIds.length === 0 || new Set(value.questionIds).size !== value.questionIds.length) return null
    if (typeof value.moduleName !== "string" || typeof value.setupModule !== "string") return null
    if (!(value.discipline === null || typeof value.discipline === "string")) return null
    if (value.mode !== "trial" && value.mode !== "exam") return null
    if (typeof value.gamificationEnabled !== "boolean" || !Number.isInteger(value.currentQuestionIndex)) return null
    if (value.currentQuestionIndex! < 0 || value.currentQuestionIndex! >= value.questionIds.length) return null
    if (!value.answers || typeof value.answers !== "object" || !value.struckOptions || typeof value.struckOptions !== "object") return null
    if (!value.sataSelections || typeof value.sataSelections !== "object" || !isStringArray(value.sataLockedQuestionIds) || !isStringArray(value.flaggedQuestionIds)) return null
    if (!Number.isFinite(value.startedAt) || value.startedAt! <= 0 || !Number.isFinite(value.durationSeconds) || value.durationSeconds! < 0) return null
    if (value.trialTimerPolicy !== TRIAL_TIMER_POLICY) return null
    if (value.recordedQuestionIds !== undefined && (!isStringArray(value.recordedQuestionIds) || value.recordedQuestionIds.some(id => !value.questionIds!.includes(id)))) return null
    if (value.updatedAt !== undefined && (!Number.isFinite(value.updatedAt) || value.updatedAt <= 0)) return null
    if (value.pendingSelections !== undefined && (!value.pendingSelections || typeof value.pendingSelections !== "object" || Array.isArray(value.pendingSelections) || Object.entries(value.pendingSelections).some(([id, option]) => !value.questionIds!.includes(id) || typeof option !== "string"))) return null
    if (Array.isArray(value.answers) || Object.entries(value.answers).some(([id, answer]) => !value.questionIds!.includes(id) || !(answer === null || typeof answer === "string" || isStringArray(answer)))) return null
    return { ...value, lockAnswers: value.lockAnswers === true } as QuizSession
  } catch {
    return null
  }
}

export function saveQuizSession(session: QuizSession, storage: Pick<Storage, "setItem"> = localStorage) {
  storage.setItem(quizSessionStorageKey(session.userId), JSON.stringify(session))
}

export function loadQuizSession(userId: string, storage: Pick<Storage, "getItem"> = localStorage) {
  return parseQuizSession(storage.getItem(quizSessionStorageKey(userId)), userId)
}

export function clearQuizSession(userId: string, storage: Pick<Storage, "removeItem"> = localStorage) {
  storage.removeItem(quizSessionStorageKey(userId))
}

export function restoreQuizSession(session: QuizSession, availableQuestions: Question[], now = Date.now()): RestoredQuizSession | null {
  const byId = new Map(availableQuestions.map(question => [question.id, question]))
  const questions = session.questionIds.map(id => byId.get(id))
  if (questions.some(question => !question)) return null
  const remainingSeconds = session.mode === "exam"
    ? Math.max(0, session.durationSeconds - Math.floor((now - session.startedAt) / 1000))
    : null
  return {
    session,
    questions: questions as Question[],
    expired: session.mode === "exam" && remainingSeconds === 0,
    remainingSeconds,
  }
}

export function createQuizSession(input: Pick<QuizSession, "userId" | "moduleName" | "discipline" | "setupModule" | "mode" | "gamificationEnabled"> & { questions: Question[]; lockAnswers?: boolean; startedAt?: number }): QuizSession {
  return {
    version: QUIZ_SESSION_VERSION,
    userId: input.userId,
    questionIds: input.questions.map(question => question.id),
    moduleName: input.moduleName,
    discipline: input.discipline,
    setupModule: input.setupModule,
    mode: input.mode,
    gamificationEnabled: input.gamificationEnabled,
    lockAnswers: input.lockAnswers ?? false,
    currentQuestionIndex: 0,
    answers: {},
    struckOptions: {},
    sataSelections: {},
    sataLockedQuestionIds: [],
    flaggedQuestionIds: [],
    startedAt: input.startedAt ?? Date.now(),
    durationSeconds: input.mode === "exam" ? input.questions.length * 90 : 0,
    trialTimerPolicy: TRIAL_TIMER_POLICY,
  }
}

export function unrecordedQuizHistory(session: QuizSession, history: HistoryEntry[]) {
  const recorded = new Set(session.recordedQuestionIds ?? [])
  return history.filter(entry => !recorded.has(entry.questionId))
}

/** Count completed Tutor answers on pause, once, without finalizing rewards. */
export function checkpointQuizSession(session: QuizSession, questions: Question[], now = Date.now()): { session: QuizSession; history: HistoryEntry[] } {
  if (session.mode !== "trial") return { session, history: [] }
  const recorded = new Set(session.recordedQuestionIds ?? [])
  const completed = questions.filter(question => session.answers[question.id] != null && !recorded.has(question.id))
  const history: HistoryEntry[] = completed.map(question => {
    const answer = session.answers[question.id]
    const correct = question.correctAnswer
    const isCorrect = Array.isArray(correct) && Array.isArray(answer)
      ? correct.length === answer.length && answer.every(option => correct.includes(option))
      : correct != null && answer === correct
    return { id: `quiz-${session.startedAt}-${question.id}`, questionId: question.id, module: question.module, subject: question.subject, vignetteSnippet: question.vignette.slice(0, 120), mode: session.mode, selectedOption: answer, correctOption: correct, isCorrect, timestamp: now }
  })
  return { session: { ...session, recordedQuestionIds: [...recorded, ...completed.map(question => question.id)], updatedAt: now }, history }
}
