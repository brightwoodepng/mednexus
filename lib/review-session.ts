export interface ReviewSession {
  version: 1
  userId: string
  module: string
  discipline: string | null
  questionIds: string[]
  currentIndex: number
  viewedIds: string[]
  gamificationEnabled: boolean
  updatedAt: number
}

export function parseReviewSession(raw: string | null, userId: string): ReviewSession | null {
  try {
    const s = JSON.parse(raw ?? "null")
    const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string" && x.length > 0)
    if (!s || s.version !== 1 || s.userId !== userId || typeof s.module !== "string" ||
        !(s.discipline === null || typeof s.discipline === "string") ||
        !strings(s.questionIds) || !s.questionIds.length || s.questionIds.length > 5000 ||
        new Set(s.questionIds).size !== s.questionIds.length ||
        !Number.isInteger(s.currentIndex) || s.currentIndex < 0 || s.currentIndex >= s.questionIds.length ||
        !strings(s.viewedIds) || new Set(s.viewedIds).size !== s.viewedIds.length ||
        s.viewedIds.some((id: string) => !s.questionIds.includes(id)) ||
        typeof s.gamificationEnabled !== "boolean" || !Number.isFinite(s.updatedAt) || s.updatedAt <= 0) return null
    return { version: 1, userId, module: s.module, discipline: s.discipline,
      questionIds: s.questionIds, currentIndex: s.currentIndex, viewedIds: s.viewedIds,
      gamificationEnabled: s.gamificationEnabled, updatedAt: s.updatedAt }
  } catch { return null }
}

export function visitReviewQuestion(session: ReviewSession, index: number): ReviewSession {
  if (!Number.isInteger(index) || index < 0 || index >= session.questionIds.length) return session
  return { ...session, currentIndex: index,
    viewedIds: [...new Set([...session.viewedIds, session.questionIds[index]])], updatedAt: Date.now() }
}
