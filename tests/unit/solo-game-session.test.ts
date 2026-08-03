import { describe, expect, it } from "vitest"
import { clearSoloGameSession, loadSoloGameSession, parseSoloGameSession, saveSoloGameSession } from "@/lib/solo-game-session"

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

const session = {
  userId: "learner-1",
  mode: "rapid" as const,
  questionIds: ["q2", "q1"],
  module: "Integument",
  discipline: "Dermatology",
  eligiblePoolSize: 20,
  startedAt: new Date(1_000).toISOString(),
  currentQuestionIndex: 1,
  answeredQuestionIds: ["q2"],
  scoringSessionId: "score-1",
  timerDeadline: 50_000,
  state: { lives: 2, score: 100 },
}

describe("solo game recovery storage", () => {
  it("round-trips user-scoped mode state", () => {
    const storage = memoryStorage()
    saveSoloGameSession(session, storage)
    expect(loadSoloGameSession("learner-1", storage)).toMatchObject(session)
    expect(loadSoloGameSession("learner-2", storage)).toBeNull()
    clearSoloGameSession("learner-1", storage)
    expect(loadSoloGameSession("learner-1", storage)).toBeNull()
  })

  it("rejects duplicate, oversized, and malformed pools", () => {
    const base = { ...session, version: 1, savedAt: Date.now() }
    expect(parseSoloGameSession(JSON.stringify({ ...base, questionIds: ["q1", "q1"] }), session.userId)).toBeNull()
    expect(parseSoloGameSession(JSON.stringify({ ...base, questionIds: Array.from({ length: 101 }, (_, i) => `q${i}`) }), session.userId)).toBeNull()
    expect(parseSoloGameSession("not-json", session.userId)).toBeNull()
  })
})
