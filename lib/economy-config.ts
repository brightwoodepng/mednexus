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
  storePrices: Readonly<Record<string, number>>
  antiFarming: { repeatRewardMultipliers: readonly number[]; masteryResetDays: number | null; disciplineNPWindowLimit: number; disciplineWindowDays: number; abandonedExamMinutes: number }
}

export const ECONOMY_CONFIG = {
  economyVersion: "1.6.0",
  catalogVersion: "1.0.0",
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
  storePrices: {
    lifeline_50_50:150,lifeline_freeze:100,lifeline_second_opinion:200,lifeline_beeper_page:250,lifeline_bolus_dose:125,lifeline_chart_review:75,
    vault_sepsis_cascade:800,vault_stemi_2am:750,vault_dka_peds:700,vault_bacterial_meningitis:650,vault_hepatic_failure:900,
    title_pre_med:50,title_intern:75,title_fellow:200,title_attending:300,title_chief_resident:500,title_the_gunner:750,title_department_chair:1500,title_chief_of_surgery:3500,title_dean_of_medicine:10000,title_caffeine_dependent:100,
    frame_gold:400,frame_neon:600,frame_fire:2500,frame_legendary_diamond:1500,frame_legendary_biohazard:1800,frame_mythic_nebula:3000,frame_mythic_heartbeat:4000,frame_lightning:3500,frame_toxic_drip:3000,
    highlight_neon:300,highlight_gold:350,highlight_amethyst:800,highlight_legendary_crimson:1500,highlight_legendary_emerald:1800,highlight_mythic_lightning:3000,highlight_mythic_void_walker:5000,
    avatar_scrub_tech:500,avatar_coffee_drip:500,avatar_lab_rat:800,avatar_night_shift:800,avatar_gold_steth:2000,avatar_plague_doctor:2500,avatar_cyber_surgeon:2500,avatar_ascended:5000,avatar_marble:5000,avatar_vital_sign:7500,
  },
  // Reset stays disabled until a mastery-reset period and timestamp storage are approved.
  antiFarming: { repeatRewardMultipliers: [1, 1, 0.5], masteryResetDays: null, disciplineNPWindowLimit: 1_000, disciplineWindowDays: 7, abandonedExamMinutes: 480 },
} as const satisfies EconomyConfig

export const economyVersion = ECONOMY_CONFIG.economyVersion

export function isEarningModeEnabled(mode: EarningMode): boolean {
  return ECONOMY_CONFIG.enabledEarningModes[mode]
}
