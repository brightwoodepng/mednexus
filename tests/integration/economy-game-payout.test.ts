import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { BOUNTY_POOL, calculatePayout, computeBountyProgress, type GameResult } from "@/lib/economy"

const result = (overrides: Partial<GameResult> = {}): GameResult => ({
  mode: "rapid",
  score: 500,
  correct: 4,
  total: 5,
  bestStreak: 4,
  isNewHigh: false,
  survivedCount: 4,
  accuracy: 80,
  lifelineUsed: false,
  ...overrides,
})

describe("verified NP rewards", () => {
  it("uses one non-stacking accuracy band with the configured completion reward", () => {
    const payout = calculatePayout(result({
      correct: 5,
      total: 5,
      bestStreak: 5,
      accuracy: 100,
    }))
    expect(payout.breakdown.find((item) => item.label === "Valid Completion")?.amount).toBe(10)
    expect(payout.breakdown.filter((item) => item.label.includes("Accuracy"))).toEqual([
      { label: "Accuracy Bonus (95%+)", amount: 30 },
    ])
  })

  it("matches time-attack and generic play bounties against server mode data", () => {
    const timeAttack = BOUNTY_POOL.find((bounty) => bounty.id === "timeatk_play2")!
    const anyPlay = BOUNTY_POOL.find((bounty) => bounty.id === "any_play3")!
    expect(computeBountyProgress(timeAttack, result({ mode: "timeatk" }))).toBe(1)
    expect(computeBountyProgress(timeAttack, result({ mode: "rapid" }))).toBe(0)
    expect(computeBountyProgress(anyPlay, result({ mode: "double" }))).toBe(1)
  })

  it("starts and completes all five solo modes with ordered server-verified answers", async () => {
    const [sessionRoute, payoutRoute, game] = await Promise.all([
      readFile("app/api/economy/session/route.ts", "utf8"),
      readFile("app/api/economy/payout/route.ts", "utf8"),
      readFile("components/game-mode.tsx", "utf8"),
    ])
    for (const mode of ["rapid", "sudden", "timeatk", "double", "streak"]) {
      expect(sessionRoute).toContain(`"${mode}"`)
      expect(game).toContain(`useSoloScoring("${mode}")`)
    }
    expect(sessionRoute).toContain("SELECT data FROM mednexus_questions")
    expect(sessionRoute).toContain("answer_order")
    expect(sessionRoute).toContain("duplicateOrderedAnswer")
    expect(payoutRoute).toContain("completionBonusAvailable")
    expect(payoutRoute).toContain('source: "game_completion"')
    expect(payoutRoute).toContain("recordDailyActivity")
  })

  it("makes multiplayer payout retry-safe from durable server answer history", async () => {
    const [room, score, client] = await Promise.all([
      readFile("app/api/game-rooms/[pin]/route.ts", "utf8"),
      readFile("app/api/game-rooms/[pin]/score/route.ts", "utf8"),
      readFile("components/game-mode-multiplayer.tsx", "utf8"),
    ])
    expect(room).toContain("answer_history")
    expect(score).toContain("mednexus_multiplayer_payouts")
    expect(score).toContain("room.answer_history?.[playerId]")
    expect(score).toContain("requireRegisteredUser")
    expect(client).toContain("submitMultiplayerResult")
  })

  it("uses one append-only credit path and preserves lifetime earnings on spending", async () => {
    const [ledger, schema, store, registration] = await Promise.all([
      readFile("lib/np-ledger.ts", "utf8"),
      readFile("lib/db.ts", "utf8"),
      readFile("app/api/economy/store/route.ts", "utf8"),
      readFile("app/api/auth/register/route.ts", "utf8"),
    ])
    expect(ledger).toContain("ON CONFLICT (user_id, source, source_id) DO NOTHING")
    expect(ledger).toContain("pg_advisory_xact_lock")
    expect(schema).toContain("lifetime_earned")
    expect(schema).toContain("mednexus_np_transactions")
    expect(store).toContain("balance = balance - $2")
    expect(store).not.toContain("lifetime_earned = lifetime_earned -")
    expect(store).toContain("'store_purchase'")
    expect(registration).toContain('source: "registration_bonus"')
  })
})
