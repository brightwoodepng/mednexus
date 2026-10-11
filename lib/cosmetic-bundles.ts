import type { StoreItem } from "@/lib/economy"

export function getCosmeticParts(item: StoreItem, catalog: readonly StoreItem[]): StoreItem[] {
  if (!item.bundleItemIds) return [item]
  return item.bundleItemIds.map(id => {
    const part = catalog.find(candidate => candidate.id === id)
    if (!part || part.category !== "cosmetic" || !part.cosmeticType || part.bundleItemIds) throw new Error("Invalid cosmetic bundle component")
    return part
  })
}

export function ownsCosmetic(item: StoreItem, inventory: Readonly<Record<string, number>>, catalog: readonly StoreItem[]): boolean {
  return getCosmeticParts(item, catalog).every(part => (inventory[part.id] ?? 0) > 0)
}

export function quoteCosmeticBundle(item: StoreItem, inventory: Readonly<Record<string, number>>, catalog: readonly StoreItem[]) {
  const parts = getCosmeticParts(item, catalog)
  const missing = parts.filter(part => !(inventory[part.id] > 0))
  const subtotal = missing.reduce((sum, part) => sum + part.price, 0)
  const discount = item.bundleItemIds ? item.bundleDiscountPercent ?? 0 : 0
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error("Invalid bundle discount")
  return { parts, missing, subtotal, price: Math.ceil(subtotal * (100 - discount) / 100) }
}
