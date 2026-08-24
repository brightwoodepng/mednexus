import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { BOUNTY_POOL, STORE_ITEMS } from "@/lib/economy"

describe("versioned economy configuration", () => {
  it("enables only the v1 MCQ earning families and daily login", () => {
    expect(ECONOMY_CONFIG.economyVersion).toBe("3.0.0")
    expect(Object.values(ECONOMY_CONFIG.enabledEarningModes).every(Boolean)).toBe(true)
    expect(ECONOMY_CONFIG.modeIds.trialTutor).toEqual(["trial", "tutor"])
    expect(ECONOMY_CONFIG.modeIds.exam).toEqual(["exam"])
  })

  it("defines the shared weekly goal policy", () => {
    expect(ECONOMY_CONFIG.timezone).toBe("UTC")
    expect(ECONOMY_CONFIG.weeklyGoals).toEqual([
      { id: "answer_100", type: "answers", minimumAnswers: 100, reward: 100 },
      { id: "accuracy_70", type: "accuracy", minimumAnswers: 100, minimumAccuracy: 70, reward: 75 },
      { id: "exam_dates_3", type: "exam_dates", qualifyingExams: 3, distinctExamDates: 3, reward: 75 },
    ])
  })

  it("configures capped Trial/Tutor rewards and repeat scaling", () => {
    expect(ECONOMY_CONFIG.questionRewards.trialTutor).toEqual({
      correct: 5,
      streakThresholds: [{ minimum: 5, bonus: 2 }, { minimum: 10, bonus: 3 }],
      completionThresholds: [{ minimumAnswered: 10, bonus: 15 }, { minimumAnswered: 25, bonus: 25 }],
      dailyCap: 300,
    })
    expect(ECONOMY_CONFIG.antiFarming.repeatRewardMultipliers).toEqual([1, 0.5])
    expect(ECONOMY_CONFIG.antiFarming.masteryResetDays).toBeNull()
  })

  it("configures the exam minimum, base cap, daily cap, and accuracy bands", () => {
    expect(ECONOMY_CONFIG.examRewards).toEqual({
      minimumAnswered: 10,
      baseCap: 50,
      dailyCap: 350,
      accuracyMultipliers: [
        { minimumAccuracy: 0, band: "below 50%", multiplier: 1 },
        { minimumAccuracy: 50, band: "50%–69%", multiplier: 1.25 },
        { minimumAccuracy: 70, band: "70%–84%", multiplier: 1.5 },
        { minimumAccuracy: 85, band: "85%–94%", multiplier: 1.75 },
        { minimumAccuracy: 95, band: "95%–100%", multiplier: 2 },
      ],
    })
  })

  it("centralizes the solo and multiplayer game payout policy", () => {
    expect(ECONOMY_CONFIG.gameRewards.solo).toMatchObject({
      completion: 10, correctAnswer: 3, personalBest: 25,
      firstDailyCompletion: 15, dailyCap: 300,
    })
    expect(ECONOMY_CONFIG.gameRewards.solo.accuracyBonuses).toEqual([
      { minimumAccuracy: 70, bonus: 10 },
      { minimumAccuracy: 85, bonus: 20 },
      { minimumAccuracy: 95, bonus: 30 },
    ])
    expect(ECONOMY_CONFIG.gameRewards.multiplayer).toMatchObject({
      correctAnswer: 5, participation: 15, placeBonuses: [60, 40, 25],
      firstDailyWin: 30, dailyCap: 250,
    })
    expect(ECONOMY_CONFIG.gameRewards.groupStudy).toEqual({
      correctAnswer: 5, completion: 20, accuracy80: 15,
      dailyCap: 250, minimumAnswers: 3, minimumPlayers: 2,
    })
    expect(ECONOMY_CONFIG.gameRewards.multiplayer).not.toHaveProperty("studyGroupPerPlayer")
    expect(ECONOMY_CONFIG.repeatableDailyCeiling).toBe(1_500)
    expect(300 + 350 + 300 + 250 + 250).toBeLessThanOrEqual(ECONOMY_CONFIG.repeatableDailyCeiling)
  })

  it("isolates repeat history and daily caps by activity family", () => {
    const antiFarming = readFileSync("lib/anti-farming.ts", "utf8")
    const groupStudy = readFileSync("app/api/group-study/[pin]/route.ts", "utf8")
    const multiplayer = readFileSync("app/api/game-rooms/[pin]/score/route.ts", "utf8")
    const migration = readFileSync("migrations/2026-08-24-economy-v3-scoped-repeats.sql", "utf8")
    expect(antiFarming).toContain('type QuestionRewardScope = "trial" | "exam" | "solo_game" | "group_study" | "multiplayer"')
    expect(antiFarming).toContain("AND reward_scope = $4")
    expect(groupStudy).toContain('reward_scope=\'group_study\'')
    expect(multiplayer).toContain('reward_scope=\'multiplayer\'')
    expect(groupStudy).toContain('dailyRewardRemaining(client, member.user_id, "group_study", season.id)')
    expect(multiplayer).toContain('dailyRewardRemaining(client, playerId, "multiplayer", season.id)')
    expect(migration).toContain("PRIMARY KEY (season_id, user_id, question_id, reward_scope)")
  })

  it("defines the finite daily-login reward program", () => {
    expect(ECONOMY_CONFIG.dailyLogin).toEqual({
      base: 10,
      milestones: [
        { day: 3, bonus: 20, name: "3-Day Streak" },
        { day: 7, bonus: 50, name: "7-Day Streak" },
        { day: 14, bonus: 100, name: "14-Day Streak" },
        { day: 30, bonus: 250, name: "30-Day Streak" },
      ],
    })
    expect(ECONOMY_CONFIG.dailyLogin.milestones.every((milestone) => !("repeatsEveryDays" in milestone))).toBe(true)
  })

  it("drives public bounty rewards and store prices", () => {
    for (const bounty of BOUNTY_POOL) {
      const configured = ECONOMY_CONFIG.bounties.find((entry) => entry.id === bounty.id)
      expect(bounty.reward).toBe(configured?.reward)
      expect(bounty.target).toBe(configured?.target)
    }
    for (const item of STORE_ITEMS) {
      expect(item).toMatchObject(ECONOMY_CONFIG.store.catalog[item.id as keyof typeof ECONOMY_CONFIG.store.catalog])
    }
    expect(STORE_ITEMS.filter(item => item.category === "lifeline").map(item => item.id)).toEqual([
      "lifeline_50_50", "lifeline_freeze", "lifeline_second_opinion",
    ])
    expect(Object.keys(ECONOMY_CONFIG.store.catalog).sort()).toEqual(STORE_ITEMS.map(item => item.id).sort())
  })

  it("defines mode-specific Supply Closet effects", () => {
    const consult = STORE_ITEMS.find(item => item.id === "lifeline_50_50")?.supply
    const labs = STORE_ITEMS.find(item => item.id === "lifeline_freeze")?.supply

    expect(consult).toMatchObject({
      effectType: "eliminate_wrong_answers",
      supportedModes: ["rapid", "sudden", "timeatk", "streak", "double"],
      perQuestionUsageLimit: 1,
      effectAmount: 2,
      effectUnit: "answer_choices",
    })
    expect(labs).toMatchObject({
      effectType: "add_time",
      supportedModes: ["rapid", "sudden", "timeatk"],
      perQuestionUsageLimit: 1,
      effectAmount: 10,
      effectUnit: "seconds",
    })
    expect(consult?.stackLimit).toBe(10)
    expect(labs?.stackLimit).toBe(10)
  })

  it("registers a content destination for every sellable permanent-content item", () => {
    const permanentContent = STORE_ITEMS.filter(item => item.productGroup === "permanent_premium_mcq")

    expect(permanentContent.filter(item => item.sellable !== false).every(item =>
      typeof item.contentDestination === "string" && item.contentDestination.startsWith("/"),
    )).toBe(true)
    expect(permanentContent.filter(item => item.id.startsWith("vault_")).every(item => item.sellable === false)).toBe(true)
  })

  it("defines complete, price-aligned presentation metadata for cosmetics", () => {
    for (const item of STORE_ITEMS.filter(candidate => candidate.category === "cosmetic")) {
      expect(["active", "remastered", "retired", "legacy"], item.id).toContain(item.status)
      const band = ECONOMY_CONFIG.store.priceBands[item.productGroup]
      expect(item.price, item.id).toBeGreaterThanOrEqual(band.minimum)
      expect(item.price, item.id).toBeLessThanOrEqual(band.maximum)
      expect(["common", "rare", "epic", "legendary", "mythic"], item.id).toContain(item.rarity)
      expect(item.sortOrder, item.id).toEqual(expect.any(Number))
      expect(item.previewTheme, item.id).toEqual(expect.any(String))
    }
    expect(STORE_ITEMS.find(item => item.id === "frame_gold")).toMatchObject({
      status: "remastered", legacyRenderer: "frame_gold",
    })
    expect(STORE_ITEMS.find(item => item.id === "frame_neon")).toMatchObject({
      status: "remastered", upgradeAnnouncement: expect.any(String),
    })
  })

  it("adds the economy version to all current ledger insertion paths", () => {
    const ledger = readFileSync("lib/np-ledger.ts", "utf8")
    const store = readFileSync("app/api/economy/store/route.ts", "utf8")
    const wallet = readFileSync("app/api/economy/wallet/route.ts", "utf8")
    expect(ledger.match(/economyVersion/g)?.length).toBeGreaterThanOrEqual(2)
    expect(store).toContain("economyVersion")
    expect(store).toContain("catalogVersion")
    expect(store).toContain("catalogPrice")
    expect(wallet).toContain("economyVersion")
  })
})
