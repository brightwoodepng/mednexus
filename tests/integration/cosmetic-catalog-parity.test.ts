import { access } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import nextConfig from "../../next.config.mjs"
import { COSMETIC_RENDERER_REGISTRY, getCosmeticPresentation } from "@/components/cosmetics/registry"
import { AVATAR_MANIFEST } from "@/lib/avatar-manifest"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { COSMETIC_CATALOG_METADATA, SELLABLE_STORE_ITEMS, STORE_ITEMS, isStoreItemPurchasable } from "@/lib/economy"

describe("cosmetic catalog contract", () => {
  it("keeps catalog, presentation metadata, prices, and renderers in parity", () => {
    const cosmetics = STORE_ITEMS.filter(item => item.category === "cosmetic")
    for (const item of cosmetics) {
      expect(COSMETIC_CATALOG_METADATA).toHaveProperty(item.id)
      expect(ECONOMY_CONFIG.store.catalog).toHaveProperty(item.id)
      expect(COSMETIC_RENDERER_REGISTRY).toHaveProperty(item.id)
      expect(item.price).toBeGreaterThan(0)
      expect(item.rarity).toBeTruthy()
      expect(item.status).toBeTruthy()
    }
  })

  it("publishes all eight clinical highlights and delists their overlapping predecessors", () => {
    const clinical = SELLABLE_STORE_ITEMS.filter(item => item.id.startsWith("highlight_") && !item.legacyRenderer)
    expect(clinical.map(item => item.id)).toEqual(expect.arrayContaining([
      "highlight_monitor_sweep", "highlight_radiology_lightbox", "highlight_triage_priority",
      "highlight_prescription_label", "highlight_anatomy_plate", "highlight_blood_flow",
      "highlight_neural_field", "highlight_sterile_field",
    ]))
    for (const id of ["highlight_neon", "highlight_gold", "highlight_amethyst", "highlight_legendary_crimson", "highlight_legendary_emerald", "highlight_mythic_lightning", "highlight_mythic_void_walker"]) {
      const item = STORE_ITEMS.find(candidate => candidate.id === id)!
      expect(item.status).toBe("retired")
      expect(isStoreItemPurchasable(item)).toBe(false)
      expect(COSMETIC_RENDERER_REGISTRY[id]).toBeTruthy() // ownership/equip rendering is preserved
    }
  })

  it("falls back safely for unknown and wrong-kind IDs", () => {
    expect(getCosmeticPresentation("unknown-avatar", "avatar").label).toBe("Default cosmetic")
    expect(getCosmeticPresentation("frame_vital_ring", "avatar").label).toBe("Default cosmetic")
  })

  it("backs every active avatar with canonical source metadata for Next Image", async () => {
    expect(nextConfig.images).toMatchObject({
      formats: ["image/avif", "image/webp"],
      qualities: [82],
    })
    expect(nextConfig.images).not.toHaveProperty("unoptimized")

    const activeAvatars = STORE_ITEMS.filter(item => item.cosmeticType === "avatar" && item.status === "active")
    for (const item of activeAvatars) {
      const manifest = AVATAR_MANIFEST[item.id as keyof typeof AVATAR_MANIFEST]
      expect(manifest).toBeTruthy()
      expect([manifest.width, manifest.height]).toEqual([1024, 1024])
      expect(manifest.quality).toBe(82)
      expect(manifest.altLabel.length).toBeGreaterThan(8)
      await expect(access(`public${manifest.sourceAsset}`)).resolves.toBeUndefined()
    }
  })

  it("records the finalized membership and prices under the new catalog version", () => {
    expect(ECONOMY_CONFIG.catalogVersion).toBe("2.5.0")
  })
})
