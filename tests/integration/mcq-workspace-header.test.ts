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
    expect(source).toContain('screen === "leaderboard" && <TrophyIcon')
    expect(source).toContain('game: "Game Mode"')
    expect(source).toContain('store: "Nexus Store"')
    expect(source).toContain('screen === "game"')
    expect(source).toContain('screen.startsWith("store")')
    expect(source).toContain("md:hidden")
    expect(source).toContain('MCQ_HEADER_TITLES[safeScreen]')
    const selector = game.slice(game.indexOf("function ModeSelectScreen"), game.indexOf("// ── RAPID FIRE"))
    expect(selector).toContain('hidden min-w-0 items-center gap-2.5 md:flex')
    expect(selector).toContain('>Game Mode</h1>')
    expect(store).toContain('mb-6 hidden min-h-16 items-center justify-between gap-3 md:flex')
    expect(store).toContain('>Nexus Store</h1>')
  })
})
