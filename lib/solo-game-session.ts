import type { Question } from "@/lib/types"

export const SOLO_GAME_SESSION_VERSION = 1 as const
const KEY_PREFIX = "mednexus:solo-game-session:v1:"
const MODES = new Set(["rapid", "sudden", "timeatk", "streak", "double"])

export type SoloGameMode = "rapid" | "sudden" | "timeatk" | "streak" | "double"

export interface SoloGameSession {
  version: typeof SOLO_GAME_SESSION_VERSION
  userId: string
  mode: SoloGameMode
  questionIds: string[]
  module: string | null
  discipline: string | null
  eligiblePoolSize: number
  startedAt: string
  currentQuestionIndex: number
  answeredQuestionIds: string[]
  scoringSessionId?: string
  timerDeadline?: number
  state: Record<string, unknown>
  savedAt: number
}

export interface HydratedSoloGameSession extends SoloGameSession {
  questions: Question[]
}

export function soloGameSessionKey(userId: string) {
  return `${KEY_PREFIX}${encodeURIComponent(userId)}`
}

export function parseSoloGameSession(raw: string | null, userId: string): SoloGameSession | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as SoloGameSession
    if (value.version !== SOLO_GAME_SESSION_VERSION || value.userId !== userId || !MODES.has(value.mode)) return null
    if (!Array.isArray(value.questionIds) || value.questionIds.length < 1 || value.questionIds.length > 100
      || value.questionIds.some(id => typeof id !== "string") || new Set(value.questionIds).size !== value.questionIds.length) return null
    if (!Number.isInteger(value.currentQuestionIndex) || value.currentQuestionIndex < 0 || value.currentQuestionIndex >= value.questionIds.length) return null
    if (!Array.isArray(value.answeredQuestionIds) || !value.state || typeof value.state !== "object") return null
    if (!(value.module === null || typeof value.module === "string") || !(value.discipline === null || typeof value.discipline === "string")) return null
    if (!Number.isFinite(value.savedAt) || typeof value.startedAt !== "string") return null
    return value
  } catch {
    return null
  }
}

export function loadSoloGameSession(userId: string, storage: Pick<Storage, "getItem"> = localStorage) {
  return parseSoloGameSession(storage.getItem(soloGameSessionKey(userId)), userId)
}

export function saveSoloGameSession(session: Omit<SoloGameSession, "version" | "savedAt">, storage: Pick<Storage, "setItem"> = localStorage) {
  try {
    storage.setItem(soloGameSessionKey(session.userId), JSON.stringify({ ...session, version: SOLO_GAME_SESSION_VERSION, savedAt: Date.now() }))
  } catch {
    // Recovery is best-effort when browser storage is unavailable.
  }
}

export function clearSoloGameSession(userId: string, storage: Pick<Storage, "removeItem"> = localStorage) {
  try { storage.removeItem(soloGameSessionKey(userId)) } catch {}
}
