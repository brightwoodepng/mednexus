import { analyzeStoreEconomy } from "@/lib/economy-analysis"
import { ECONOMY_CONFIG } from "@/lib/economy-config"

const results = analyzeStoreEconomy(ECONOMY_CONFIG.store)

console.log(`Catalog ${ECONOMY_CONFIG.catalogVersion}; assumed income: ${ECONOMY_CONFIG.store.dailyIncome.casual} NP casual / ${ECONOMY_CONFIG.store.dailyIncome.active} NP active`)
console.table(results.map(result => ({
  item: result.id,
  group: result.productGroup,
  priceNP: result.price,
  casualDays: result.casualDays,
  activeDays: result.activeDays,
  status: result.flags.length ? result.flags.join("; ") : "OK",
})))

const flagged = results.filter(result => result.flags.length)
console.log(`Audited ${results.length} items: ${flagged.length} flagged.`)
if (flagged.length) process.exitCode = 1
