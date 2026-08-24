import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("active economy season write contract", () => {
  it("attaches scoring sessions and question reward state to the active season", async () => {
    const [sessionRoute, antiFarming, schema] = await Promise.all([
      readFile("app/api/economy/session/route.ts", "utf8"),
      readFile("lib/anti-farming.ts", "utf8"),
      readFile("lib/db.ts", "utf8"),
    ])

    expect(sessionRoute).toContain("(id, user_id, season_id, mode")
    expect(antiFarming).toContain("(season_id, user_id, question_id, reward_scope, correct_count, discipline)")
    expect(antiFarming).toContain("ON CONFLICT (season_id, user_id, question_id, reward_scope)")
    expect(antiFarming).toContain("(season_id, user_id, discipline, earned_date, np_earned)")
    expect(antiFarming).toContain("ON CONFLICT (season_id, user_id, discipline, earned_date)")
    expect(schema).toContain("ALTER TABLE mednexus_exam_sessions ALTER COLUMN season_id SET NOT NULL")
    expect(schema).toContain("session.season_id IS NULL OR session.season_id = 'legacy'")
    expect(schema).toContain("session.started_at >= active.starts_at")
  })

  it("scopes quiz payouts, personal bests, bounties, and weekly goals to a season", async () => {
    const [payout, weekly] = await Promise.all([
      readFile("app/api/economy/payout/route.ts", "utf8"),
      readFile("lib/weekly-goals.ts", "utf8"),
    ])

    expect(payout).toContain("getActiveSeason(client, true)")
    expect(payout).toContain("ON CONFLICT (season_id, user_id, mode)")
    expect(payout).toContain("ON CONFLICT (season_id, uid, bounty_id, bounty_date)")
    expect(payout).toContain("calculateSessionNP(")
    expect(payout).toContain("seasonId,")
    expect(weekly).toContain("ON CONFLICT (season_id, uid, week_id)")
    expect(weekly).toContain("WHERE season_id = $1 AND uid = $2 AND week_id = $3")
  })

  it("scopes multiplayer payouts and progress to the same active season", async () => {
    const scoreRoute = await readFile("app/api/game-rooms/[pin]/score/route.ts", "utf8")

    expect(scoreRoute).toContain("const season = await getActiveSeason(client, true)")
    expect(scoreRoute).toContain("ON CONFLICT (season_id, room_pin, user_id)")
    expect(scoreRoute).toContain("ON CONFLICT (season_id, uid, bounty_id, bounty_date)")
    expect(scoreRoute).toContain("recordWeeklyGoalActivity(client, playerId, season.id")
  })

  it("reads member-facing goals and bounties from the active season", async () => {
    const [bounties, weeklyGoals, leaderboard, notifications] = await Promise.all([
      readFile("app/api/economy/bounties/route.ts", "utf8"),
      readFile("app/api/economy/weekly-goals/route.ts", "utf8"),
      readFile("app/api/leaderboard/route.ts", "utf8"),
      readFile("lib/progression-notifications.ts", "utf8"),
    ])

    expect(bounties).toContain("season_id = $1")
    expect(weeklyGoals).toContain("season_id = $1")
    expect(leaderboard).toContain("WHERE season_id = $1")
    expect(notifications).toContain("FROM mednexus_season_wallets WHERE season_id = $1")
    expect(notifications).not.toContain("FROM mednexus_wallet ")
  })
})
