import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { ECONOMY_CONFIG } from "@/lib/economy-config"

describe("global repeatable NP ceiling", () => {
  it("is configured at 1,500 NP and enforced under a per-user/date lock", async () => {
    const ledger = await readFile("lib/np-ledger.ts", "utf8")
    expect(ECONOMY_CONFIG.repeatableDailyCeiling).toBe(1_500)
    expect(ledger).toContain("pg_advisory_xact_lock")
    expect(ledger).toContain("suppressedAmount")
    expect(ledger).toContain('ceilingPolicy: repeatable ? "repeatable_mcq" : "exempt"')
  })

  it("documents rank bonuses as exempt and exposes all requested report measures", async () => {
    const [ledger, report] = await Promise.all([
      readFile("lib/np-ledger.ts", "utf8"),
      readFile("lib/economy-report.ts", "utf8"),
    ])
    expect(ledger).toContain("Rank bonuses are deliberately exempt")
    for (const metric of [
      "npCreatedPerSource", "npSpentPerStoreCategory", "dailyRepeatableEarnings",
      "usersHittingCaps", "outstandingWalletSupply", "topRepeatedQuestions",
      "topSessions", "bountyCompletionRates",
    ]) expect(report).toContain(metric)
  })
})
