import type { StoreCatalogEntry, StoreProductGroup } from "@/lib/economy-config"

export type EconomyAnalysis = StoreCatalogEntry & {
  id: string
  casualDays: number
  activeDays: number
  intendedCasualDays: readonly [number, number]
  intendedActiveDays: readonly [number, number]
  flags: string[]
}

type AnalysisConfig = {
  dailyIncome: { casual: number; active: number }
  priceBands: Readonly<Record<StoreProductGroup, { minimum: number; maximum: number }>>
  catalog: Readonly<Record<string, StoreCatalogEntry>>
}

const days = (price: number, income: number) => Number((price / income).toFixed(2))

/** Audits every configured product against its price and earning-time band. */
export function analyzeStoreEconomy(store: AnalysisConfig): EconomyAnalysis[] {
  return Object.entries(store.catalog).map(([id, entry]) => {
    const band = store.priceBands[entry.productGroup]
    const flags: string[] = []
    if (entry.price < band.minimum || entry.price > band.maximum) {
      flags.push(`price ${entry.price} NP is outside ${band.minimum}–${band.maximum} NP`)
    }
    const casualDays = days(entry.price, store.dailyIncome.casual)
    const activeDays = days(entry.price, store.dailyIncome.active)
    const intendedCasualDays = [days(band.minimum, store.dailyIncome.casual), days(band.maximum, store.dailyIncome.casual)] as const
    const intendedActiveDays = [days(band.minimum, store.dailyIncome.active), days(band.maximum, store.dailyIncome.active)] as const
    if (casualDays < intendedCasualDays[0] || casualDays > intendedCasualDays[1]) flags.push("casual earning-time is outside range")
    if (activeDays < intendedActiveDays[0] || activeDays > intendedActiveDays[1]) flags.push("active earning-time is outside range")
    return { id, ...entry, casualDays, activeDays, intendedCasualDays, intendedActiveDays, flags }
  })
}
