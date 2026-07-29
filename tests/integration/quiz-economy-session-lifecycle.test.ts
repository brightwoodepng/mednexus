import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("quiz economy session lifecycle", () => {
  it("waits for the scoring session before every quiz payout", async () => {
    const quiz = await readFile("components/quiz-simulator.tsx", "utf8")

    expect(quiz).toContain("scoredSessionPromiseRef")
    expect(quiz).toContain("const sessionId = await scoredSessionPromiseRef.current")
    expect(quiz).not.toContain("scoredSessionIdRef")
  })

  it("awards focus-mode Trial completions through Submit Block", async () => {
    const quiz = await readFile("components/quiz-simulator.tsx", "utf8")

    expect(quiz).toContain('mode === "trial" && !gamificationEnabled')
    expect(quiz).toContain("earnedNP = data?.earned ?? 0")
    expect(quiz).toContain("onComplete(result, history, earnedNP)")
  })

  it("creates a fresh server scoring session when replaying Trial Mode", async () => {
    const quiz = await readFile("components/quiz-simulator.tsx", "utf8")
    const retryHandler = quiz.slice(
      quiz.indexOf("function handleRetry()"),
      quiz.indexOf("\n  return (", quiz.indexOf("function handleRetry()")),
    )

    expect(retryHandler).toContain("payoutCalledRef.current")
    expect(retryHandler).toContain("beginScoredSession()")
  })
})
