import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import {
  formatNexusPoints,
  getMultiplayerRewardPresentation,
  getMultiplayerRewardRules,
} from "@/lib/multiplayer-reward-presentation"

describe("multiplayer reward presentation", () => {
  it("derives every player-facing payout value from the economy configuration", () => {
    const config = ECONOMY_CONFIG.gameRewards.multiplayer
    const presentation = getMultiplayerRewardPresentation()

    expect(presentation.participation).toContain(formatNexusPoints(config.participation))
    config.placeBonuses.forEach((bonus) => expect(presentation.placeBonuses).toContain(`+${formatNexusPoints(bonus)}`))
    expect(presentation.firstDailyWin).toContain(`+${formatNexusPoints(config.firstDailyWin)}`)
    expect(presentation.dailyCap).toContain(formatNexusPoints(config.dailyCap))
    expect(getMultiplayerRewardRules()).toEqual(Object.values(presentation))
  })

  it("keeps payout literals out of multiplayer component copy", async () => {
    const sources = await Promise.all([
      readFile("components/game-mode.tsx", "utf8"),
      readFile("components/game-mode-multiplayer.tsx", "utf8"),
    ])

    for (const source of sources) {
      expect(source).not.toMatch(/(?:\+?\d[\d,]*\s*NP|NP\s*\+?\d[\d,]*)/i)
    }
    expect(sources.every(source => source.includes("getMultiplayerRewardRules"))).toBe(true)
  })

  it("labels Wager Wars currency as match-only rather than wallet NP", async () => {
    const modeDefinitions = await readFile("components/game-mode.tsx", "utf8")
    expect(modeDefinitions).toContain("Chips affect this match only and are not spendable NP")
  })
})
