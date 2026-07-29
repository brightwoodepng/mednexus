import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  BOUNTY_POOL,
  calculatePayout,
  computeBountyProgress,
  mergeBountyProgress,
  type GameResult,
} from "@/lib/economy"

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

  it("matches categorized game and personal-best bounties against server data", () => {
    const personalBest = BOUNTY_POOL.find((bounty) => bounty.id === "rapid_newbest")!
    const anyPlay = BOUNTY_POOL.find((bounty) => bounty.id === "any_play3")!
    expect(computeBountyProgress(personalBest, result({ mode: "rapid", correct: 1, isNewHigh: false }))).toBe(0)
    expect(computeBountyProgress(personalBest, result({ mode: "rapid", correct: 0, isNewHigh: true }))).toBe(1)
    expect(computeBountyProgress(anyPlay, result({ mode: "double" }))).toBe(1)
    expect(computeBountyProgress(anyPlay, result({ mode: "trial" }))).toBe(0)
    expect(computeBountyProgress(anyPlay, result({ mode: "tutor" }))).toBe(0)
    expect(computeBountyProgress(anyPlay, result({ mode: "exam" }))).toBe(0)
    expect(computeBountyProgress(anyPlay, result({ mode: "clash" }))).toBe(1)
  })

  it("does not combine separate sessions for single-activity bounties", () => {
    const streak = BOUNTY_POOL.find((bounty) => bounty.id === "streak_8")!
    const disciplines = BOUNTY_POOL.find((bounty) => bounty.id === "discipline_variety3")!
    const games = BOUNTY_POOL.find((bounty) => bounty.id === "any_play3")!

    expect(mergeBountyProgress(streak, 4, 4)).toBe(4)
    expect(mergeBountyProgress(streak, 4, 8)).toBe(8)
    expect(mergeBountyProgress(disciplines, 2, 1)).toBe(2)
    expect(mergeBountyProgress(disciplines, 2, 3)).toBe(3)
    expect(mergeBountyProgress(games, 1, 1)).toBe(2)
  })

  it("uses the same bounty progress merge policy in solo and multiplayer payouts", async () => {
    const [solo, multiplayer] = await Promise.all([
      readFile("app/api/economy/payout/route.ts", "utf8"),
      readFile("app/api/game-rooms/[pin]/score/route.ts", "utf8"),
    ])
    expect(solo).toContain("mergeBountyProgress(bounty, oldProgress, delta)")
    expect(multiplayer).toContain("mergeBountyProgress(bounty, oldProgress, delta)")
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
    expect(sessionRoute).toContain("jsonb_array_elements")
    expect(sessionRoute).toContain("ANY($1::text[])")
    expect(sessionRoute).not.toContain("SELECT data FROM mednexus_questions")
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
    expect(schema).toMatch(/INSERT INTO mednexus_np_transactions\s+\(id, user_id, season_id, source, source_id, amount, metadata, created_at\)\s+SELECT\s+'np-legacy-'[\s\S]+?user_id,\s+'legacy',\s+'legacy_discipline'/)
    expect(store).toContain("balance = balance - $2")
    expect(store).not.toContain("lifetime_earned = lifetime_earned -")
    expect(store).toContain("'store_purchase'")
    expect(registration).toContain("provisionActiveSeasonWallet")
    expect(registration).not.toContain('source: "registration_bonus"')
  })
})
