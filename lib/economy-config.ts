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
  /** Server-authoritative purchase availability. Omitted entries are sellable. */
  sellable?: boolean
  /** Registered in-app route for permanent content after ownership is verified. */
  contentDestination?: string
  /** Maximum copies that may be held at once. Defaults to the global limit. */
  maxInventory?: number
  /** Server-priced purchase choices. The base price remains the one-unit display price. */
  purchaseOptions?: readonly { id: string; quantity: number; price: number }[]
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
    groupStudy: { correctAnswer: number; completion: number; accuracy80: number; dailyCap: number; minimumAnswers: number; minimumPlayers: number }
    multiplayer: { correctAnswer: number; participation: number; placeBonuses: readonly number[]; firstDailyWin: number; dailyCap: number; minimumAnswers: number; minimumPlayers: number }
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
    /** Per-question consumption caps keyed by consumable item id. */
    perQuestionLimits: Readonly<Record<string, number>>
    /** Expected sustainable earnings used to audit purchase earning-time. */
    dailyIncome: { casual: number; active: number }
    priceBands: Readonly<Record<StoreProductGroup, { minimum: number; maximum: number }>>
    catalog: Readonly<Record<string, StoreCatalogEntry>>
  }
  antiFarming: { repeatRewardMultipliers: readonly number[]; masteryResetDays: number | null; disciplineNPWindowLimit: number; disciplineWindowDays: number; abandonedExamMinutes: number }
}

export const ECONOMY_CONFIG = {
  economyVersion: "3.0.0",
  catalogVersion: "3.0.0",
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
  questionRewards: { trialTutor: { correct: 5, streakThresholds: [{ minimum: 5, bonus: 2 }, { minimum: 10, bonus: 3 }], completionThresholds: [{ minimumAnswered: 10, bonus: 15 }, { minimumAnswered: 25, bonus: 25 }], dailyCap: 300 } },
  examRewards: {
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
  },
  gameRewards: {
    solo: {
      completion: 10, correctAnswer: 3,
      accuracyBonuses: [{ minimumAccuracy: 70, bonus: 10 }, { minimumAccuracy: 85, bonus: 20 }, { minimumAccuracy: 95, bonus: 30 }],
      personalBest: 25, firstDailyCompletion: 15, dailyCap: 300,
      minimumAnswers: 3,
      // Sudden Death legitimately finishes on the first incorrect answer.
      suddenDeathMinimumAnswers: 1,
    },
    groupStudy: {
      correctAnswer: 5, completion: 20, accuracy80: 15,
      dailyCap: 250, minimumAnswers: 3, minimumPlayers: 2,
    },
    multiplayer: {
      correctAnswer: 5, participation: 15, placeBonuses: [60, 40, 25], firstDailyWin: 30,
      dailyCap: 250, minimumAnswers: 3, minimumPlayers: 2,
    },
  },
  earningCaps: { daily: 5_000, weekly: 20_000 },
  repeatableDailyCeiling: 1_500,
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
  // Kept for legacy report compatibility. Clinical rank now comes exclusively
  // from the non-spendable lifetime-XP ladder in XP_CONFIG.
  rankUp: { reward: 0, thresholds: [{ name: "Medical Student", minPoints: 0 }] },
  store: {
    inventoryQuantityLimit: 999,
    perQuestionLimits: {
      lifeline_50_50: 1,
      lifeline_freeze: 1,
      lifeline_second_opinion: 1,
    },
    dailyIncome: { casual: 300, active: 900 },
    priceBands: {
      basic_consumable: { minimum: 150, maximum: 300 },
      strong_consumable: { minimum: 400, maximum: 600 },
      basic_cosmetic: { minimum: 1_000, maximum: 2_500 },
      premium_cosmetic: { minimum: 4_000, maximum: 9_000 },
      prestige_cosmetic: { minimum: 12_000, maximum: 30_000 },
      permanent_premium_mcq: { minimum: 1_500, maximum: 3_000 },
    },
    // Only consumables with authenticated inventory consumption and implemented
    // gameplay behavior belong in this sellable catalog.
    catalog: {
      lifeline_50_50: {
        price: 450, productGroup: "strong_consumable", maxInventory: 10,
        purchaseOptions: [{ id: "single", quantity: 1, price: 450 }, { id: "bundle_3", quantity: 3, price: 1_200 }],
      },
      lifeline_freeze: {
        price: 250, productGroup: "basic_consumable", maxInventory: 10,
        purchaseOptions: [{ id: "single", quantity: 1, price: 250 }, { id: "bundle_3", quantity: 3, price: 675 }],
      },
      lifeline_second_opinion: {
        price: 600, productGroup: "strong_consumable", maxInventory: 5,
        purchaseOptions: [{ id: "single", quantity: 1, price: 600 }],
      },
      // Vault simulations remain unavailable until their content, launch route,
      // ownership checks, resume/completion flow, and member-facing entry exist.
      vault_sepsis_cascade: { price: 2_000, productGroup: "permanent_premium_mcq", sellable: false },
      vault_stemi_2am: { price: 1_750, productGroup: "permanent_premium_mcq", sellable: false },
      vault_dka_peds: { price: 2_500, productGroup: "permanent_premium_mcq", sellable: false },
      vault_bacterial_meningitis: { price: 1_500, productGroup: "permanent_premium_mcq", sellable: false },
      vault_hepatic_failure: { price: 3_000, productGroup: "permanent_premium_mcq", sellable: false },
      title_pre_med: { price: 1_000, productGroup: "basic_cosmetic" }, title_intern: { price: 1_200, productGroup: "basic_cosmetic" },
      title_fellow: { price: 1_400, productGroup: "basic_cosmetic" }, title_attending: { price: 1_800, productGroup: "basic_cosmetic" },
      title_chief_resident: { price: 2_500, productGroup: "basic_cosmetic" }, title_the_gunner: { price: 4_000, productGroup: "premium_cosmetic" },
      title_department_chair: { price: 8_000, productGroup: "premium_cosmetic" }, title_chief_of_surgery: { price: 12_000, productGroup: "prestige_cosmetic" },
      title_dean_of_medicine: { price: 30_000, productGroup: "prestige_cosmetic" }, title_caffeine_dependent: { price: 1_000, productGroup: "basic_cosmetic" },
      frame_gold: { price: 1_400, productGroup: "basic_cosmetic" }, frame_neon: { price: 2_500, productGroup: "basic_cosmetic" },
      frame_fire: { price: 9_000, productGroup: "premium_cosmetic" }, frame_legendary_diamond: { price: 5_500, productGroup: "premium_cosmetic" },
      frame_legendary_biohazard: { price: 7_000, productGroup: "premium_cosmetic" }, frame_mythic_nebula: { price: 12_000, productGroup: "prestige_cosmetic" },
      frame_mythic_heartbeat: { price: 18_000, productGroup: "prestige_cosmetic" }, frame_lightning: { price: 16_000, productGroup: "prestige_cosmetic" },
      frame_toxic_drip: { price: 12_000, productGroup: "prestige_cosmetic" }, highlight_neon: { price: 1_000, productGroup: "basic_cosmetic" },
      frame_vital_ring: { price: 2_500, productGroup: "basic_cosmetic" }, frame_surgical_steel: { price: 5_500, productGroup: "premium_cosmetic" },
      frame_chart_grid: { price: 2_500, productGroup: "basic_cosmetic" }, frame_ct_gantry: { price: 6_500, productGroup: "premium_cosmetic" },
      frame_microscope_iris: { price: 4_000, productGroup: "premium_cosmetic" }, frame_neural_synapse: { price: 12_000, productGroup: "prestige_cosmetic" },
      frame_code_blue: { price: 7_000, productGroup: "premium_cosmetic" }, frame_operating_theatre: { price: 4_000, productGroup: "premium_cosmetic" },
      frame_cell_culture: { price: 4_000, productGroup: "premium_cosmetic" }, frame_cardiac_conduction: { price: 14_000, productGroup: "prestige_cosmetic" },
      frame_radiology_contrast: { price: 8_000, productGroup: "premium_cosmetic" }, frame_the_resuscitator: { price: 18_000, productGroup: "prestige_cosmetic" },
      highlight_gold: { price: 1_200, productGroup: "basic_cosmetic" }, highlight_amethyst: { price: 2_500, productGroup: "basic_cosmetic" },
      highlight_legendary_crimson: { price: 5_500, productGroup: "premium_cosmetic" }, highlight_legendary_emerald: { price: 7_000, productGroup: "premium_cosmetic" },
      highlight_mythic_lightning: { price: 12_000, productGroup: "prestige_cosmetic" }, highlight_mythic_void_walker: { price: 18_000, productGroup: "prestige_cosmetic" },
      highlight_monitor_sweep: { price: 1_600, productGroup: "basic_cosmetic" }, highlight_prescription_label: { price: 1_800, productGroup: "basic_cosmetic" },
      highlight_anatomy_plate: { price: 2_500, productGroup: "basic_cosmetic" }, highlight_triage_priority: { price: 5_000, productGroup: "premium_cosmetic" },
      highlight_sterile_field: { price: 6_000, productGroup: "premium_cosmetic" }, highlight_blood_flow: { price: 7_500, productGroup: "premium_cosmetic" },
      highlight_neural_field: { price: 14_000, productGroup: "prestige_cosmetic" }, highlight_radiology_lightbox: { price: 16_000, productGroup: "prestige_cosmetic" },
      avatar_scrub_tech: { price: 1_800, productGroup: "basic_cosmetic" }, avatar_coffee_drip: { price: 1_800, productGroup: "basic_cosmetic" },
      avatar_lab_rat: { price: 2_500, productGroup: "basic_cosmetic" }, avatar_night_shift: { price: 2_500, productGroup: "basic_cosmetic" },
      avatar_gold_steth: { price: 8_000, productGroup: "premium_cosmetic" }, avatar_plague_doctor: { price: 9_000, productGroup: "premium_cosmetic" },
      avatar_cyber_surgeon: { price: 9_000, productGroup: "premium_cosmetic" }, avatar_ascended: { price: 18_000, productGroup: "prestige_cosmetic" },
      avatar_marble: { price: 18_000, productGroup: "prestige_cosmetic" }, avatar_vital_sign: { price: 28_000, productGroup: "prestige_cosmetic" },
      frame_dna_sequencer: { price: 1_800, productGroup: "basic_cosmetic" },
      frame_pharmacology_orbit: { price: 4_000, productGroup: "premium_cosmetic" },
      frame_surgical_drone: { price: 8_500, productGroup: "premium_cosmetic" },
      frame_holo_anatomy: { price: 18_000, productGroup: "prestige_cosmetic" },
      avatar_pulse_runner: { price: 2_500, productGroup: "basic_cosmetic" },
      avatar_neurocartographer: { price: 4_000, productGroup: "premium_cosmetic" },
      avatar_robotic_surgery_fellow: { price: 9_000, productGroup: "premium_cosmetic" },
      avatar_nexus_laureate: { price: 22_000, productGroup: "prestige_cosmetic" },
      title_night_consult: { price: 1_400, productGroup: "basic_cosmetic" },
      title_diagnostician: { price: 2_000, productGroup: "basic_cosmetic" },
      title_anatomy_architect: { price: 4_000, productGroup: "premium_cosmetic" },
      title_code_commander: { price: 8_000, productGroup: "premium_cosmetic" },
      title_synapse_specialist: { price: 14_000, productGroup: "prestige_cosmetic" },
      title_nexus_laureate: { price: 24_000, productGroup: "prestige_cosmetic" },
    },
  },
  // Reset stays disabled until a mastery-reset period and timestamp storage are approved.
  antiFarming: { repeatRewardMultipliers: [1, 0.5], masteryResetDays: null, disciplineNPWindowLimit: 1_000, disciplineWindowDays: 7, abandonedExamMinutes: 480 },
} as const satisfies EconomyConfig

export const economyVersion = ECONOMY_CONFIG.economyVersion

export function isEarningModeEnabled(mode: EarningMode): boolean {
  return ECONOMY_CONFIG.enabledEarningModes[mode]
}
