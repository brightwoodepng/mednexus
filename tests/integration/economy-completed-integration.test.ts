import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { economyDate, economyWeekId } from "@/lib/economy"
import { analyzeStoreEconomy } from "@/lib/economy-analysis"
import { ECONOMY_CONFIG } from "@/lib/economy-config"

describe("completed economy integration invariants", () => {
  it("uses durable idempotency keys for retries and serializes concurrent cap decisions", async () => {
    const [ledger, payout, multiplayer, antiFarming] = await Promise.all([
      readFile("lib/np-ledger.ts", "utf8"),
      readFile("app/api/economy/payout/route.ts", "utf8"),
      readFile("app/api/game-rooms/[pin]/score/route.ts", "utf8"),
      readFile("lib/anti-farming.ts", "utf8"),
    ])

    expect(ledger).toContain("ON CONFLICT (user_id, source, source_id) DO NOTHING")
    expect(ledger).toContain("mednexus:repeatable-np:${userId}:${economyDate}")
    expect(antiFarming).toContain("mednexus:activity-integrity:${userId}")
    expect(payout).toContain("SELECT * FROM mednexus_exam_sessions")
    expect(payout).toContain("FOR UPDATE")
    expect(payout).toContain("if (session.payout)")
    expect(multiplayer).toContain("mednexus_multiplayer_payouts")
    expect(multiplayer).toContain("FOR UPDATE")
  })

  it("keeps category caps isolated and reports partial/global cap suppression", async () => {
    const [ledger, payout] = await Promise.all([
      readFile("lib/np-ledger.ts", "utf8"),
      readFile("app/api/economy/payout/route.ts", "utf8"),
    ])
    expect(ledger).toContain("Math.min(requestedAmount, remaining)")
    expect(ledger).toContain("suppressedAmount")
    expect(ledger).toContain("metadata->>'multiplayer'")
    expect(payout).toContain("entry.amount = Math.min(entry.amount, remaining)")
    expect(payout).toContain("earned: credit.credited + bountyCredit.credited + weekly.credited.credited")
    expect(payout).toContain("Daily repeatable NP ceiling")
  })

  it("automatically and exactly-once credits bounties and weekly goals", async () => {
    const [payout, bounties, goals] = await Promise.all([
      readFile("app/api/economy/payout/route.ts", "utf8"),
      readFile("app/api/economy/bounties/route.ts", "utf8"),
      readFile("lib/weekly-goals.ts", "utf8"),
    ])
    expect(payout).toContain('metadata: { bountyId: bounty.id, automatic: true }')
    expect(payout).toContain("claimed = EXCLUDED.claimed")
    expect(bounties).toContain("row.claimed")
    expect(bounties).toContain('sourceId: `${today}:${bounty.id}`')
    expect(goals).toContain('sourceId: `${weekId}:${id}`')
    expect(goals).toContain("automatic: true")
    expect(goals).toContain("credited_goal_ids")
  })

  it("uses consistent UTC midnight and Monday boundaries", () => {
    expect(economyDate(new Date("2026-07-27T23:59:59.999Z"))).toBe("2026-07-27")
    expect(economyDate(new Date("2026-07-28T00:00:00.000Z"))).toBe("2026-07-28")
    expect(economyWeekId(new Date("2026-07-26T23:59:59.999Z"))).toBe("2026-07-20")
    expect(economyWeekId(new Date("2026-07-27T00:00:00.000Z"))).toBe("2026-07-27")
  })

  it("keeps purchases out of earnings and refreshes all client economy state", async () => {
    const [store, leaderboard, context] = await Promise.all([
      readFile("app/api/economy/store/route.ts", "utf8"),
      readFile("app/api/leaderboard/route.ts", "utf8"),
      readFile("contexts/economy-context.tsx", "utf8"),
    ])
    expect(store).toContain("balance = balance - $2")
    expect(store).not.toContain("lifetime_earned = lifetime_earned -")
    expect(leaderboard).toContain("WHERE amount > 0")
    for (const endpoint of ["wallet", "bounties", "weekly-goals", "store"]) {
      expect(context).toContain(`/api/economy/${endpoint}`)
    }
    expect(context.match(/void refresh\(\)/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it("compares representative daily earnings to every configured purchase time", () => {
    const analysis = analyzeStoreEconomy(ECONOMY_CONFIG.store)
    expect(analysis).toHaveLength(Object.keys(ECONOMY_CONFIG.store.catalog).length)
    expect(analysis.every(item => item.casualDays === Number((item.price / 100).toFixed(2)))).toBe(true)
    expect(analysis.every(item => item.activeDays === Number((item.price / 400).toFixed(2)))).toBe(true)
    expect(analysis.flatMap(item => item.flags)).toEqual([])
  })
})
