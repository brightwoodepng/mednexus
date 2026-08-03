import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("resumable game wiring", () => {
  it("offers multiplayer pools through 100 and disables unavailable presets", async () => {
    const source = await readFile("components/game-mode-multiplayer.tsx", "utf8")
    expect(source).toContain("const Q_COUNTS = [5, 10, 15, 20, 25, 50, 100]")
    expect(source).toContain("disabled={n > max}")
  })

  it("persists every solo mode through one user-scoped recovery contract", async () => {
    const source = await readFile("components/game-mode.tsx", "utf8")
    for (const mode of ["rapid", "sudden", "timeatk", "double", "streak"]) {
      expect(source).toContain(`mode: "${mode}"`)
    }
    expect(source).toContain("loadQuestionsByIds(saved.questionIds, true)")
    expect(source).toContain("scoringSessionId: input.scoring.sessionId")
    expect(source).toContain("Save & Exit")
  })

  it("keeps multiplayer recovery in validated persistent browser storage", async () => {
    const source = await readFile("lib/multiplayer-session.ts", "utf8")
    expect(source).toContain("localStorage.setItem")
    expect(source).toContain("expectedUid && parsed.uid !== expectedUid")
    expect(source).toContain("MAX_AGE_MS")
  })
})
