import type { Question, QuestionExplanation, QuestionMedia, QuestionOption } from "@/lib/types"

export const GROUP_STUDY_CAPACITY = 10
export const GROUP_STUDY_EXPIRY_HOURS = 4
export const GROUP_STUDY_HOST_RECONNECT_SECONDS = 45
export const GROUP_STUDY_TIMER_OPTIONS = [30, 45, 60, 90] as const
export const GROUP_STUDY_DIFFICULTIES = ["mixed", "easy", "medium", "hard"] as const

export type GroupStudyDifficulty = typeof GROUP_STUDY_DIFFICULTIES[number]
export type GroupStudyPhase = "lobby" | "question_open" | "answer_closed" | "reveal" | "discussion" | "completed" | "ended" | "expired"

export type GroupStudyQuestionSnapshot = {
  id: string
  module: string | null
  subject: string
  vignette: string
  questionType?: Question["questionType"]
  contextContent?: string | null
  options: QuestionOption[]
  media?: QuestionMedia[]
  mediaBase64?: string | null
  multiple: boolean
  correctAnswer: string | string[]
  explanation: QuestionExplanation | null
}

export type GroupStudyLeaderboardMember = {
  userId: string
  name: string
  avatar?: string | null
  role: "host" | "member"
  isGuest: boolean
  firstEligibleQuestion: number | null
  questionsAttempted: number
  correctAnswers: number
  incorrectAnswers: number
  eligibleUnanswered: number
  currentStreak: number
  highestStreak: number
  roomScore: number
  sessionNpEarned: number
  connectionStatus: "online" | "disconnected" | "left"
}

export type RankedGroupStudyMember = GroupStudyLeaderboardMember & {
  rank: number
  accuracy: number
  eligibleQuestions: number
}

export function isGroupStudyDifficulty(value: unknown): value is GroupStudyDifficulty {
  return typeof value === "string" && GROUP_STUDY_DIFFICULTIES.includes(value as GroupStudyDifficulty)
}

export function isGroupStudyTimer(value: unknown): value is null | typeof GROUP_STUDY_TIMER_OPTIONS[number] {
  return value === null || GROUP_STUDY_TIMER_OPTIONS.includes(value as typeof GROUP_STUDY_TIMER_OPTIONS[number])
}

export function sameGroupStudyAnswer(actual: unknown, expected: unknown) {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    const left = actual.filter((value): value is string => typeof value === "string").sort()
    const right = expected.filter((value): value is string => typeof value === "string").sort()
    return left.length === right.length && left.every((value, index) => value === right[index])
  }
  return typeof actual === "string" && actual === expected
}

export function isValidGroupStudyAnswer(answer: unknown, question: Pick<GroupStudyQuestionSnapshot, "options" | "correctAnswer">) {
  const allowed = new Set(question.options.map(option => option.id))
  if (Array.isArray(question.correctAnswer)) {
    return Array.isArray(answer) && answer.length > 0 && answer.every(value => typeof value === "string" && allowed.has(value))
  }
  return typeof answer === "string" && allowed.has(answer)
}

/** Before reveal, never serialize the key or explanation to any participant, including the host. */
export function publicGroupStudyQuestion(question: GroupStudyQuestionSnapshot, reveal: boolean) {
  const { correctAnswer, explanation, ...safe } = question
  return reveal ? { ...safe, correctAnswer, explanation } : safe
}

/** A late joiner is eligible now only while the current question is still open. */
export function firstEligibleQuestionIndex(currentIndex: number, phase: GroupStudyPhase) {
  return phase === "question_open" ? currentIndex : currentIndex + 1
}

export function rankGroupStudyMembers(members: GroupStudyLeaderboardMember[]): RankedGroupStudyMember[] {
  const sorted = [...members].sort((left, right) =>
    right.correctAnswers - left.correctAnswers
    || right.questionsAttempted - left.questionsAttempted
    || right.currentStreak - left.currentStreak
    || left.name.localeCompare(right.name),
  )
  let rank = 0
  let previous: GroupStudyLeaderboardMember | undefined
  return sorted.map((member, index) => {
    const tied = previous
      && previous.correctAnswers === member.correctAnswers
      && previous.questionsAttempted === member.questionsAttempted
      && previous.currentStreak === member.currentStreak
    if (!tied) rank = index + 1
    previous = member
    const eligibleQuestions = member.questionsAttempted + member.eligibleUnanswered
    return {
      ...member,
      rank,
      eligibleQuestions,
      accuracy: member.questionsAttempted ? Math.round(member.correctAnswers * 100 / member.questionsAttempted) : 0,
    }
  })
}

export function groupStudyRoomScore(correct: boolean) {
  return correct ? 100 : 0
}

/** Unseen questions are shuffled first; repeats are oldest-selected first only after that pool is exhausted. */
export function prioritizeGroupStudyQuestions<T extends { id: string }>(
  questions: T[],
  lastSelected: ReadonlyMap<string, number>,
  random: () => number = Math.random,
) {
  const unseen = questions.filter(question => !lastSelected.has(question.id))
  for (let index = unseen.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    ;[unseen[index], unseen[swap]] = [unseen[swap], unseen[index]]
  }
  const seen = questions.filter(question => lastSelected.has(question.id)).sort((left, right) =>
    (lastSelected.get(left.id) ?? 0) - (lastSelected.get(right.id) ?? 0) || left.id.localeCompare(right.id),
  )
  return [...unseen, ...seen]
}
