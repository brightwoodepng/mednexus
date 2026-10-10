import { describe, expect, it } from "vitest"
import { getDailyCosmetics } from "@/lib/daily-cosmetics"
import { SELLABLE_STORE_ITEMS } from "@/lib/economy"

describe("daily dashboard cosmetics", () => {
  it("offers three different purchasable cosmetics including an avatar and frame", () => {
    const items = getDailyCosmetics("2026-10-10")
    expect(items).toHaveLength(3)
    expect(new Set(items.map(item => item.id)).size).toBe(3)
    expect(items.map(item => item.cosmeticType)).toContain("avatar")
    expect(items.map(item => item.cosmeticType)).toContain("frame")
    for (const item of items) {
      expect(SELLABLE_STORE_ITEMS).toContain(item)
      expect(item.category).toBe("cosmetic")
      expect(["retired", "legacy"]).not.toContain(item.status)
    }
  })
  it("keeps today's picks stable and changes them the following day", () => {
    expect(getDailyCosmetics("2026-10-10")).toEqual(getDailyCosmetics("2026-10-10"))
    expect(getDailyCosmetics("2026-10-11").map(item => item.id)).not.toEqual(getDailyCosmetics("2026-10-10").map(item => item.id))
  })
  it("always provides three eligible items across a month", () => {
    for (let day = 1; day <= 31; day++) expect(getDailyCosmetics(`2026-10-${String(day).padStart(2, "0")}`)).toHaveLength(3)
  })
})
