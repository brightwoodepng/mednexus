import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { BOUNTY_POOL, STORE_ITEMS } from "@/lib/economy"

describe("versioned economy configuration", () => {
  it("enables only the v1 MCQ earning families and daily login", () => {
    expect(ECONOMY_CONFIG.economyVersion).toBe("1.3.0")
    expect(Object.values(ECONOMY_CONFIG.enabledEarningModes).every(Boolean)).toBe(true)
    expect(ECONOMY_CONFIG.modeIds.trialTutor).toEqual(["trial", "tutor"])
    expect(ECONOMY_CONFIG.modeIds.exam).toEqual(["exam"])
  })

  it("configures capped Trial/Tutor rewards and repeat scaling", () => {
    expect(ECONOMY_CONFIG.questionRewards.trialTutor).toEqual({
      correct: 5,
      streakThresholds: [{ minimum: 5, bonus: 2 }, { minimum: 10, bonus: 3 }],
      completionThresholds: [{ minimumAnswered: 10, bonus: 15 }, { minimumAnswered: 25, bonus: 25 }],
      dailyCap: 200,
    })
    expect(ECONOMY_CONFIG.antiFarming.repeatRewardMultipliers).toEqual([1, 1, 0.5])
    expect(ECONOMY_CONFIG.antiFarming.masteryResetDays).toBeNull()
  })

  it("configures the exam minimum, base cap, daily cap, and accuracy bands", () => {
    expect(ECONOMY_CONFIG.examRewards).toEqual({
      minimumAnswered: 10,
      baseCap: 50,
      dailyCap: 250,
      accuracyMultipliers: [
        { minimumAccuracy: 0, band: "below 50%", multiplier: 1 },
        { minimumAccuracy: 50, band: "50%–69%", multiplier: 1.25 },
        { minimumAccuracy: 70, band: "70%–84%", multiplier: 1.5 },
        { minimumAccuracy: 85, band: "85%–94%", multiplier: 1.75 },
        { minimumAccuracy: 95, band: "95%–100%", multiplier: 2 },
      ],
    })
  })

  it("defines the finite daily-login reward program", () => {
    expect(ECONOMY_CONFIG.dailyLogin).toEqual({
      base: 10,
      milestones: [
        { day: 3, bonus: 20, name: "3-Day Streak" },
        { day: 7, bonus: 50, name: "7-Day Streak" },
        { day: 14, bonus: 100, name: "14-Day Streak" },
        { day: 30, bonus: 250, name: "30-Day Streak" },
      ],
    })
    expect(ECONOMY_CONFIG.dailyLogin.milestones.every((milestone) => !("repeatsEveryDays" in milestone))).toBe(true)
  })

  it("drives public bounty rewards and store prices", () => {
    for (const bounty of BOUNTY_POOL) {
      const configured = ECONOMY_CONFIG.bounties.find((entry) => entry.id === bounty.id)
      expect(bounty.reward).toBe(configured?.reward)
      expect(bounty.target).toBe(configured?.target)
    }
    for (const item of STORE_ITEMS) {
      expect(item.price).toBe((ECONOMY_CONFIG.storePrices as Record<string, number>)[item.id])
    }
  })

  it("adds the economy version to all current ledger insertion paths", () => {
    const ledger = readFileSync("lib/np-ledger.ts", "utf8")
    const store = readFileSync("app/api/economy/store/route.ts", "utf8")
    const wallet = readFileSync("app/api/economy/wallet/route.ts", "utf8")
    expect(ledger.match(/economyVersion/g)?.length).toBeGreaterThanOrEqual(2)
    expect(store).toContain("economyVersion")
    expect(wallet).toContain("economyVersion")
  })
})
