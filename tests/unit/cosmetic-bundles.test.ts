import { describe, expect, it } from "vitest"
import { ARTIST_AVATARS } from "@/lib/artist-avatars"
import { getAvatarManifestEntry } from "@/lib/avatar-manifest"
import { STORE_ITEMS } from "@/lib/economy"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { ownsCosmetic, quoteCosmeticBundle } from "@/lib/cosmetic-bundles"

const bundle = STORE_ITEMS.find(item => item.id === "bundle_peeps_amani_gold")!
describe("artist collections and cosmetic bundles", () => {
  it("registers 24 unique local portraits in the sellable catalog and manifest", () => {
    expect(ARTIST_AVATARS).toHaveLength(24)
    expect(new Set(ARTIST_AVATARS.map(item => item.id)).size).toBe(24)
    for (const avatar of ARTIST_AVATARS) {
      const item = STORE_ITEMS.find(item => item.id === avatar.id)!
      expect(item.status).toBe("active")
      expect(item.imagePath).toBe(getAvatarManifestEntry(item.id)?.sourceAsset)
      expect(item.imagePath).toMatch(/^\/avatars\/artists\/.*\.svg$/)
      expect(item.price).toBeGreaterThan(0)
    }
  })
  it("charges the configured full bundle price when neither part is owned", () => {
    const quote = quoteCosmeticBundle(bundle, {}, STORE_ITEMS)
    expect(quote.price).toBe(2210)
    expect(quote.price).toBe(bundle.price)
    expect(quote.missing.map(item => item.id)).toEqual(["avatar_peeps_amani", "frame_gold"])
  })
  it("discounts only the missing frame when the avatar is owned", () => {
    const quote = quoteCosmeticBundle(bundle, { avatar_peeps_amani: 1 }, STORE_ITEMS)
    expect(quote.price).toBe(1190)
    expect(quote.missing.map(item => item.id)).toEqual(["frame_gold"])
    expect(ownsCosmetic(bundle, { avatar_peeps_amani: 1 }, STORE_ITEMS)).toBe(false)
  })
  it("does not charge for a complete look already owned through individual purchases", () => {
    const inventory = { avatar_peeps_amani: 1, frame_gold: 1 }
    expect(quoteCosmeticBundle(bundle, inventory, STORE_ITEMS).price).toBe(0)
    expect(ownsCosmetic(bundle, inventory, STORE_ITEMS)).toBe(true)
  })
  it("keeps every bundle component and full price consistent with the catalog", () => {
    for (const item of STORE_ITEMS.filter(item => item.bundleItemIds)) {
      const quote = quoteCosmeticBundle(item, {}, STORE_ITEMS)
      expect(quote.parts).toHaveLength(2)
      expect(quote.parts.map(part => part.cosmeticType).sort()).toEqual(["avatar", "frame"])
      expect(quote.price).toBe(item.price)
      const band = ECONOMY_CONFIG.store.priceBands[item.productGroup]
      expect(item.price).toBeGreaterThanOrEqual(band.minimum)
      expect(item.price).toBeLessThanOrEqual(band.maximum)
    }
  })
  it("rejects invalid components rather than granting arbitrary inventory", () => {
    expect(() => quoteCosmeticBundle({ ...bundle, bundleItemIds: ["missing"] }, {}, STORE_ITEMS)).toThrow()
  })
})
