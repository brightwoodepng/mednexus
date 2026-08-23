import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("MCQ workspace header", () => {
  it("shows the mode toggle only in study contexts", async () => {
    const source = await readFile(new URL("../../components/mednexus-app.tsx", import.meta.url), "utf8")

    expect(source).toContain('new Set<Screen>(["dashboard", "modules", "weak-areas"])')
    expect(source).toContain('MCQ_MODE_SCREENS.has(safeScreen)')
  })

  it("uses section titles for utility workspaces", async () => {
    const [source, game, store] = await Promise.all([
      readFile(new URL("../../components/mednexus-app.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../components/game-mode.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../components/game-store-modal.tsx", import.meta.url), "utf8"),
    ])

    expect(source).toContain('leaderboard: "Rankings"')
    expect(source).toContain('safeScreen === "leaderboard" ? <TrophyIcon')
    expect(source).toContain('game: "Game Mode"')
    expect(source).toContain('store: "Nexus Store"')
    expect(source).toContain('safeScreen === "game" ? <GamepadIcon')
    expect(source).toContain('safeScreen.startsWith("store") ? <StoreIcon')
    expect(source).toContain('MCQ_HEADER_TITLES[safeScreen]')
    const selector = game.slice(game.indexOf("function ModeSelectScreen"), game.indexOf("// ── RAPID FIRE"))
    expect(selector).not.toContain('>Game Mode</h1>')
    expect(store).not.toContain('>Nexus Store</h1>')
  })
})
