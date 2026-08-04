import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("Game Mode utility buttons", () => {
  it("uses one stable responsive control system in both menu headers", async () => {
    const source = await readFile("components/game-mode.tsx", "utf8")
    const hero = source.slice(source.indexOf("function HeroSplitScreen"), source.indexOf("function ModeCard"))
    const selector = source.slice(source.indexOf("function ModeSelectScreen"), source.indexOf("// ── RAPID FIRE"))

    expect(source).toContain("const GAME_UTILITY_BUTTON")
    expect(source).toContain("ClipboardList, ShoppingBag")
    expect(hero).toContain("grid w-full grid-cols-2")
    expect(selector).toContain("grid w-full grid-cols-3")
    expect(hero).toContain("GAME_UTILITY_BUTTON")
    expect(selector).toContain("GAME_UTILITY_BUTTON")
    expect(hero).not.toContain("🏪")
    expect(selector).not.toContain("🏪")
    expect(selector).not.toContain("📋")
  })

  it("keeps store, quests, and wallet actions accessible and visually stable", async () => {
    const [game, economy] = await Promise.all([
      readFile("components/game-mode.tsx", "utf8"),
      readFile("components/economy-panel.tsx", "utf8"),
    ])
    const selector = game.slice(game.indexOf("function ModeSelectScreen"), game.indexOf("// ── RAPID FIRE"))
    const wallet = economy.slice(economy.indexOf("export function WalletBadge"), economy.indexOf("// ── Payout Toast"))

    expect(game).toContain("h-11 min-w-0")
    expect(game).toContain("transition-[background-color,border-color,box-shadow]")
    expect(selector).toContain("onClick={onOpenStore}")
    expect(selector).toContain("onClick={() => setQuestsOpen(true)}")
    expect(selector).toContain("rewards ready")
    expect(wallet).toContain("Open Nexus Store")
    expect(wallet).toContain("Coins size={15}")
    expect(wallet).toContain("truncate text-xs font-extrabold tabular-nums")
    expect(wallet).not.toContain("bg-gradient-to-r")
    expect(wallet).not.toMatch(/(?:hover|active):scale-/)
  })
})
