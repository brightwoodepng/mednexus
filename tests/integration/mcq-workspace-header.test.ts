import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("MCQ workspace header", () => {
  it("shows the mode toggle only in study contexts", async () => {
    const source = await readFile(new URL("../../components/mednexus-app.tsx", import.meta.url), "utf8")

    expect(source).toContain('new Set<Screen>(["dashboard", "modules", "weak-areas"])')
    expect(source).toContain('MCQ_MODE_SCREENS.has(safeScreen)')
  })

  it("uses section titles for utility workspaces", async () => {
    const source = await readFile(new URL("../../components/mednexus-app.tsx", import.meta.url), "utf8")

    expect(source).toContain('leaderboard: "Rankings"')
    expect(source).toContain('safeScreen === "leaderboard" ? <TrophyIcon')
    expect(source).toContain('game: "Game Mode"')
    expect(source).toContain('store: "Exam Store"')
    expect(source).toContain('MCQ_HEADER_TITLES[safeScreen]')
  })
})
