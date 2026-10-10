import { economyDate, SELLABLE_STORE_ITEMS, type StoreItem } from "@/lib/economy"

export function getDailyCosmetics(date = economyDate()): StoreItem[] {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000)
  const kinds = ["avatar", "frame", day % 2 ? "title" : "highlight"]
  return kinds.flatMap((kind, index) => {
    const items = SELLABLE_STORE_ITEMS.filter(item => item.category === "cosmetic" && item.cosmeticType === kind
      && item.status !== "retired" && item.status !== "legacy").sort((a, b) => a.id.localeCompare(b.id))
    return items.length ? [items[(day + index * 7) % items.length]] : []
  })
}
