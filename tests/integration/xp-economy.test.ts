import { describe, expect, it } from "vitest"
import { XP_CONFIG } from "@/lib/xp-config"
import { accuracyXP, repeatMultiplier, sessionXPCredits } from "@/lib/xp-ledger"

describe("XP economy", () => {
  it("uses full, half, then zero rewards for repeated correct answers", () => {
    expect([0, 1, 2].map(repeatMultiplier)).toEqual([1, 0.5, 0])
  })

  it("keeps Trial rewards independent of visual gamification", () => {
    const input = { userId: "u", seasonId: "s", sessionId: "session", mode: "trial", attempts: Array.from({ length: 10 }, (_, index) => ({ isCorrect: true, currentStreak: index + 1 })), rewardMultipliers: Array(10).fill(1), meaningfulCompletion: true, accuracy: 100 }
    const rewards = sessionXPCredits(input)
    expect(rewards.reduce((sum, reward) => sum + reward.amount, 0)).toBe(133)
    expect(rewards.some(reward => reward.sourceId.endsWith("completion-10"))).toBe(true)
  })

  it("uses only the highest accuracy band", () => {
    expect(accuracyXP(96, XP_CONFIG.exam)).toBe(75)
    expect(accuracyXP(86, XP_CONFIG.exam)).toBe(50)
    expect(accuracyXP(71, XP_CONFIG.exam)).toBe(25)
  })

  it("keeps XP non-spendable by defining no conversion or store price", () => {
    expect("store" in XP_CONFIG).toBe(false)
  })
})
