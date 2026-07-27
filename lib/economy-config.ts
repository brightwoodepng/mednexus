/**
 * Versioned, server-authoritative Nexus Point economy.
 *
 * Change `economyVersion` whenever any value or eligibility rule changes. The
 * ledger attaches this value to every transaction, making historical payouts
 * reproducible and auditable.
 */
export type EarningMode =
  | "mcq_trial_tutor"
  | "mcq_exam"
  | "mcq_solo_game"
  | "mcq_multiplayer_game"
  | "mcq_bounty"
  | "daily_login"

export type StoreProductGroup =
  | "basic_consumable"
  | "strong_consumable"
  | "basic_cosmetic"
  | "premium_cosmetic"
  | "prestige_cosmetic"
  | "permanent_premium_mcq"

export type StoreCatalogEntry = {
  price: number
  productGroup: StoreProductGroup
}

export type EconomyConfig = {
  economyVersion: string
  /** Version of the item/price catalog, recorded on purchases for auditability. */
  catalogVersion: string
  /** IANA timezone used for every daily and weekly economy boundary. */
  timezone: string
  enabledEarningModes: Readonly<Record<EarningMode, boolean>>
  modeIds: {
    trialTutor: readonly string[]
    exam: readonly string[]
    soloGames: readonly string[]
    multiplayerGames: readonly string[]
  }
  dailyLogin: {
    base: number
    /** One-time bonuses within the initial 30-day streak program. */
    milestones: readonly { day: number; bonus: number; name: string }[]
  }
  questionRewards: { trialTutor: { correct: number; streakThresholds: readonly { minimum: number; bonus: number }[]; completionThresholds: readonly { minimumAnswered: number; bonus: number }[]; dailyCap: number } }
  examRewards: {
    minimumAnswered: number
    baseCap: number
    dailyCap: number
    accuracyMultipliers: readonly { minimumAccuracy: number; band: string; multiplier: number }[]
  }
  gameRewards: {
    solo: { completion: number; correctAnswer: number; accuracyBonuses: readonly { minimumAccuracy: number; bonus: number }[]; personalBest: number; firstDailyCompletion: number; dailyCap: number; minimumAnswers: number; suddenDeathMinimumAnswers: number }
    multiplayer: { participation: number; placeBonuses: readonly number[]; firstDailyWin: number; dailyCap: number; minimumAnswers: number; minimumPlayers: number }
  }
  earningCaps: { daily: number; weekly: number }
  /** Maximum NP created by repeatable MCQ activity per user/economy date. */
  repeatableDailyCeiling: number
  bounties: readonly { id: string; reward: number; target: number; type: string; mode?: string }[]
  weeklyGoals: readonly {
    id: string
    reward: number
    type: "answers" | "accuracy" | "exam_dates"
    minimumAnswers?: number
    minimumAccuracy?: number
    qualifyingExams?: number
    distinctExamDates?: number
  }[]
  rankUp: { reward: number; thresholds: readonly { name: string; minPoints: number }[] }
  store: {
    /** Maximum number of copies of a stackable item a user may hold. */
    inventoryQuantityLimit: number
    /** Expected sustainable earnings used to audit purchase earning-time. */
    dailyIncome: { casual: number; active: number }
    priceBands: Readonly<Record<StoreProductGroup, { minimum: number; maximum: number }>>
    catalog: Readonly<Record<string, StoreCatalogEntry>>
  }
  antiFarming: { repeatRewardMultipliers: readonly number[]; masteryResetDays: number | null; disciplineNPWindowLimit: number; disciplineWindowDays: number; abandonedExamMinutes: number }
}

export const ECONOMY_CONFIG = {
  economyVersion: "1.8.0",
  catalogVersion: "2.0.0",
  timezone: "UTC",
  enabledEarningModes: {
    mcq_trial_tutor: true, mcq_exam: true, mcq_solo_game: true,
    mcq_multiplayer_game: true, mcq_bounty: true, daily_login: true,
  },
  modeIds: {
    trialTutor: ["trial", "tutor"], exam: ["exam"],
    soloGames: ["rapid", "sudden", "timeatk", "double", "streak"],
    multiplayerGames: ["clash", "cohort", "wager", "djmulti"],
  },
  dailyLogin: { base: 10, milestones: [
    { day: 3, bonus: 20, name: "3-Day Streak" },
    { day: 7, bonus: 50, name: "7-Day Streak" },
    { day: 14, bonus: 100, name: "14-Day Streak" },
    // The initial streak program ends at day 30. Do not repeat this bonus at
    // day 60+ until product defines a recurring cycle or named monthly rewards.
    { day: 30, bonus: 250, name: "30-Day Streak" },
  ] },
  questionRewards: { trialTutor: { correct: 5, streakThresholds: [{ minimum: 5, bonus: 2 }, { minimum: 10, bonus: 3 }], completionThresholds: [{ minimumAnswered: 10, bonus: 15 }, { minimumAnswered: 25, bonus: 25 }], dailyCap: 200 } },
  examRewards: {
    minimumAnswered: 10,
    baseCap: 50,
    dailyCap: 250,
    accuracyMultipliers: [
      { minimumAccuracy: 0, band: "below 50%", multiplier: 1 },
      { minimumAccuracy: 50, band: "50%–69%", multiplier: 1.25 },
      { minimumAccuracy: 70, band: "70%–84%", multiplier: 1.5 },
      { minimumAccuracy: 85, band: "85%–94%", multiplier: 1.75 },
      { minimumAccuracy: 95, band: "95%–100%", multiplier: 2 },
    ],
  },
  gameRewards: {
    solo: {
      completion: 10, correctAnswer: 3,
      accuracyBonuses: [{ minimumAccuracy: 70, bonus: 10 }, { minimumAccuracy: 85, bonus: 20 }, { minimumAccuracy: 95, bonus: 30 }],
      personalBest: 25, firstDailyCompletion: 15, dailyCap: 200,
      minimumAnswers: 3,
      // Sudden Death legitimately finishes on the first incorrect answer.
      suddenDeathMinimumAnswers: 1,
    },
    multiplayer: {
      participation: 10, placeBonuses: [40, 25, 15], firstDailyWin: 25,
      dailyCap: 150, minimumAnswers: 3, minimumPlayers: 2,
    },
  },
  earningCaps: { daily: 5_000, weekly: 20_000 },
  repeatableDailyCeiling: 750,
  bounties: [
    { id: "practice_correct10", target: 10, reward: 35, type: "practice" },
    { id: "practice_correct20", target: 20, reward: 35, type: "practice" },
    { id: "exam_complete", target: 1, reward: 45, type: "exam" },
    { id: "any_accuracy80", target: 1, reward: 40, type: "accuracy" },
    { id: "discipline_variety3", target: 3, reward: 45, type: "discipline_variety" },
    { id: "any_play3", target: 3, reward: 40, type: "game" },
    { id: "streak_8", target: 8, reward: 45, type: "streak" },
    { id: "game_variety2", target: 2, reward: 40, type: "game_variety" },
    { id: "rapid_newbest", target: 1, reward: 45, type: "game", mode: "rapid" },
  ],
  weeklyGoals: [
    { id: "answer_100", type: "answers", minimumAnswers: 100, reward: 100 },
    { id: "accuracy_70", type: "accuracy", minimumAnswers: 100, minimumAccuracy: 70, reward: 75 },
    { id: "exam_dates_3", type: "exam_dates", qualifyingExams: 3, distinctExamDates: 3, reward: 75 },
  ],
  rankUp: { reward: 1_000, thresholds: [
    { name: "Medical Student", minPoints: 0 }, { name: "Clerkship", minPoints: 500 },
    { name: "Intern", minPoints: 1_500 }, { name: "Resident", minPoints: 3_500 },
    { name: "Fellow", minPoints: 7_000 }, { name: "Attending", minPoints: 12_000 },
  ] },
  store: {
    inventoryQuantityLimit: 999,
    dailyIncome: { casual: 100, active: 400 },
    priceBands: {
      basic_consumable: { minimum: 50, maximum: 100 },
      strong_consumable: { minimum: 125, maximum: 200 },
      basic_cosmetic: { minimum: 300, maximum: 600 },
      premium_cosmetic: { minimum: 1_000, maximum: 2_500 },
      prestige_cosmetic: { minimum: 4_000, maximum: 8_000 },
      permanent_premium_mcq: { minimum: 1_500, maximum: 3_000 },
    },
    // Only consumables with authenticated inventory consumption and implemented
    // gameplay behavior belong in this sellable catalog.
    catalog: {
      lifeline_50_50: { price: 150, productGroup: "strong_consumable" },
      lifeline_freeze: { price: 100, productGroup: "basic_consumable" },
      vault_sepsis_cascade: { price: 2_000, productGroup: "permanent_premium_mcq" },
      vault_stemi_2am: { price: 1_750, productGroup: "permanent_premium_mcq" },
      vault_dka_peds: { price: 2_500, productGroup: "permanent_premium_mcq" },
      vault_bacterial_meningitis: { price: 1_500, productGroup: "permanent_premium_mcq" },
      vault_hepatic_failure: { price: 3_000, productGroup: "permanent_premium_mcq" },
      title_pre_med: { price: 300, productGroup: "basic_cosmetic" }, title_intern: { price: 350, productGroup: "basic_cosmetic" },
      title_fellow: { price: 400, productGroup: "basic_cosmetic" }, title_attending: { price: 500, productGroup: "basic_cosmetic" },
      title_chief_resident: { price: 600, productGroup: "basic_cosmetic" }, title_the_gunner: { price: 1_000, productGroup: "premium_cosmetic" },
      title_department_chair: { price: 2_000, productGroup: "premium_cosmetic" }, title_chief_of_surgery: { price: 4_000, productGroup: "prestige_cosmetic" },
      title_dean_of_medicine: { price: 8_000, productGroup: "prestige_cosmetic" }, title_caffeine_dependent: { price: 300, productGroup: "basic_cosmetic" },
      frame_gold: { price: 400, productGroup: "basic_cosmetic" }, frame_neon: { price: 600, productGroup: "basic_cosmetic" },
      frame_fire: { price: 2_500, productGroup: "premium_cosmetic" }, frame_legendary_diamond: { price: 1_500, productGroup: "premium_cosmetic" },
      frame_legendary_biohazard: { price: 1_800, productGroup: "premium_cosmetic" }, frame_mythic_nebula: { price: 4_000, productGroup: "prestige_cosmetic" },
      frame_mythic_heartbeat: { price: 5_000, productGroup: "prestige_cosmetic" }, frame_lightning: { price: 4_500, productGroup: "prestige_cosmetic" },
      frame_toxic_drip: { price: 4_000, productGroup: "prestige_cosmetic" }, highlight_neon: { price: 300, productGroup: "basic_cosmetic" },
      highlight_gold: { price: 350, productGroup: "basic_cosmetic" }, highlight_amethyst: { price: 600, productGroup: "basic_cosmetic" },
      highlight_legendary_crimson: { price: 1_500, productGroup: "premium_cosmetic" }, highlight_legendary_emerald: { price: 1_800, productGroup: "premium_cosmetic" },
      highlight_mythic_lightning: { price: 4_000, productGroup: "prestige_cosmetic" }, highlight_mythic_void_walker: { price: 5_000, productGroup: "prestige_cosmetic" },
      avatar_scrub_tech: { price: 500, productGroup: "basic_cosmetic" }, avatar_coffee_drip: { price: 500, productGroup: "basic_cosmetic" },
      avatar_lab_rat: { price: 600, productGroup: "basic_cosmetic" }, avatar_night_shift: { price: 600, productGroup: "basic_cosmetic" },
      avatar_gold_steth: { price: 2_000, productGroup: "premium_cosmetic" }, avatar_plague_doctor: { price: 2_500, productGroup: "premium_cosmetic" },
      avatar_cyber_surgeon: { price: 2_500, productGroup: "premium_cosmetic" }, avatar_ascended: { price: 5_000, productGroup: "prestige_cosmetic" },
      avatar_marble: { price: 5_000, productGroup: "prestige_cosmetic" }, avatar_vital_sign: { price: 7_500, productGroup: "prestige_cosmetic" },
    },
  },
  // Reset stays disabled until a mastery-reset period and timestamp storage are approved.
  antiFarming: { repeatRewardMultipliers: [1, 1, 0.5], masteryResetDays: null, disciplineNPWindowLimit: 1_000, disciplineWindowDays: 7, abandonedExamMinutes: 480 },
} as const satisfies EconomyConfig

export const economyVersion = ECONOMY_CONFIG.economyVersion

export function isEarningModeEnabled(mode: EarningMode): boolean {
  return ECONOMY_CONFIG.enabledEarningModes[mode]
}
