import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("quiz session lifecycle wiring", () => {
  it("persists interactions without lifecycle-unmount cleanup", async () => {
    const quiz = await readFile("components/quiz-simulator.tsx", "utf8")
    expect(quiz).toContain("onSessionChange(sessionRef.current)")
    expect(quiz).toContain("sataLockedQuestionIds")
    expect(quiz).toContain("struckOptions")
    expect(quiz).not.toContain("beforeunload")
    expect(quiz).not.toContain("visibilitychange")
  })

  it("clears after completion and explicit confirmed abandonment", async () => {
    const app = await readFile("components/mednexus-app.tsx", "utf8")
    expect(app).toContain("clearQuizSession(user.uid)")
    expect(app).toContain('title="Discard this attempt?"')
    expect(app).toContain('primaryLabel="Resume"')
    expect(app).toContain('secondaryLabel="Discard"')
  })

  it("reuses the persisted scoring activity when resuming", async () => {
    const quiz = await readFile("components/quiz-simulator.tsx", "utf8")
    expect(quiz).toContain("sessionRef.current.scoringSessionId")
    expect(quiz).toContain("if (scoredSessionPromiseRef.current) return")
  })
})
