import { describe, expect, it } from "vitest"
import type { Question } from "@/lib/types"
import {
  clearQuizSession,
  createQuizSession,
  loadQuizSession,
  parseQuizSession,
  quizSessionStorageKey,
  restoreQuizSession,
  saveQuizSession,
} from "@/lib/quiz-session"

function question(id: string): Question {
  return { id, module: "Cardiology", subject: "Medicine", vignette: id, options: [], correctAnswer: null } as unknown as Question
}

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

function session(mode: "trial" | "exam" = "trial", startedAt = 1_000) {
  return createQuizSession({
    userId: "user-a",
    questions: [question("q3"), question("q1"), question("q2")],
    moduleName: "Cardiology",
    discipline: "Medicine",
    setupModule: "Clinical",
    mode,
    gamificationEnabled: false,
    startedAt,
  })
}

describe("persisted quiz sessions", () => {
  it("restores Trial state without a timer and preserves ordered questions", () => {
    const saved = { ...session(), currentQuestionIndex: 1, answers: { q3: "a" }, struckOptions: { q1: ["b"] } }
    const restored = restoreQuizSession(saved, [question("q1"), question("q2"), question("q3")], 99_000)
    expect(restored?.questions.map(q => q.id)).toEqual(["q3", "q1", "q2"])
    expect(restored?.remainingSeconds).toBeNull()
    expect(restored?.session.answers).toEqual({ q3: "a" })
  })

  it("counts wall-clock absence against Exam time", () => {
    const saved = session("exam", 10_000)
    const restored = restoreQuizSession(saved, [question("q1"), question("q2"), question("q3")], 100_000)
    expect(restored?.remainingSeconds).toBe(180)
    expect(restored?.expired).toBe(false)
  })

  it("marks an elapsed Exam as expired", () => {
    const saved = session("exam", 10_000)
    expect(restoreQuizSession(saved, [question("q1"), question("q2"), question("q3")], 400_000)?.expired).toBe(true)
  })

  it("rejects missing question IDs and malformed or stale versions", () => {
    expect(restoreQuizSession(session(), [question("q1"), question("q3")])).toBeNull()
    expect(parseQuizSession("not-json", "user-a")).toBeNull()
    expect(parseQuizSession(JSON.stringify({ ...session(), version: 99 }), "user-a")).toBeNull()
  })

  it("isolates storage and embedded ownership between users", () => {
    const storage = memoryStorage()
    saveQuizSession(session(), storage)
    expect(loadQuizSession("user-a", storage)?.userId).toBe("user-a")
    expect(loadQuizSession("user-b", storage)).toBeNull()
    expect(parseQuizSession(JSON.stringify(session()), "user-b")).toBeNull()
    expect(quizSessionStorageKey("user-a")).not.toBe(quizSessionStorageKey("user-b"))
  })

  it("cleans up only when completion or confirmed discard calls clear", () => {
    const storage = memoryStorage()
    saveQuizSession(session(), storage)
    expect(loadQuizSession("user-a", storage)).not.toBeNull()
    clearQuizSession("user-a", storage)
    expect(loadQuizSession("user-a", storage)).toBeNull()
  })
})
