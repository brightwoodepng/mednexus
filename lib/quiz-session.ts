import type { QuizMode, Question } from "@/lib/types"

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
  currentQuestionIndex: number
  answers: Record<string, QuizAnswer>
  struckOptions: Record<string, string[]>
  sataSelections: Record<string, string[]>
  sataLockedQuestionIds: string[]
  flaggedQuestionIds: string[]
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
    return value as QuizSession
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

export function createQuizSession(input: Pick<QuizSession, "userId" | "moduleName" | "discipline" | "setupModule" | "mode" | "gamificationEnabled"> & { questions: Question[]; startedAt?: number }): QuizSession {
  return {
    version: QUIZ_SESSION_VERSION,
    userId: input.userId,
    questionIds: input.questions.map(question => question.id),
    moduleName: input.moduleName,
    discipline: input.discipline,
    setupModule: input.setupModule,
    mode: input.mode,
    gamificationEnabled: input.gamificationEnabled,
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
