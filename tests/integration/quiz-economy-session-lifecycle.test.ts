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
    expect(quiz).toContain("if (data) earnedNP = data.earned")
    expect(quiz).toContain("onComplete(result, history, earnedNP, payoutError)")
    expect(quiz).not.toContain("earnedNP = data?.earned ?? 0")
  })

  it("shows a confirmed Trial award or a visible payout failure on results", async () => {
    const [app, results] = await Promise.all([
      readFile("components/mednexus-app.tsx", "utf8"),
      readFile("components/results-screen.tsx", "utf8"),
    ])

    expect(app).toContain("payoutError={lastResult.payoutError}")
    expect(results).toContain("Verified Nexus Points")
    expect(results).toContain("NP credit was not confirmed")
    expect(results).not.toContain('mode === "exam" && earnedNP !== undefined')
  })

  it("uses the economy configuration for Trial NP feedback", async () => {
    const quiz = await readFile("components/quiz-simulator.tsx", "utf8")

    expect(quiz).toContain("ECONOMY_CONFIG.questionRewards.trialTutor.correct")
    expect(quiz).toContain("ECONOMY_CONFIG.antiFarming.repeatRewardMultipliers")
    expect(quiz).not.toContain("10 + bonus")
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
