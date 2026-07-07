// ── Economy constants shared between API and frontend ──────────────────────────

export interface BountyDef {
  id: string
  label: string
  desc: string
  icon: string
  target: number
  reward: number
  type: "mode_correct" | "mode_score" | "mode_streak" | "mode_survive" | "accuracy_game" | "any_play" | "streak_cashout" | "any_newbest"
  mode?: string
}

export const BOUNTY_POOL: BountyDef[] = [
  { id: "rapid_5correct",    label: "Rapid Fire Marksman",    desc: "Answer 5 questions correctly in Rapid Fire",        icon: "⚡", target: 5,   reward: 200, type: "mode_correct",   mode: "rapid"   },
  { id: "timeatk_score800",  label: "Time Bandit",            desc: "Score 800+ points in Time Attack",                 icon: "⏱️", target: 800, reward: 250, type: "mode_score",     mode: "timeatk" },
  { id: "streak_8",          label: "On A Roll",              desc: "Build an 8× streak in Streak Master",              icon: "🔥", target: 8,   reward: 200, type: "mode_streak",    mode: "streak"  },
  { id: "sudden_survive15",  label: "Untouchable",            desc: "Survive 15 questions in Sudden Death",             icon: "💀", target: 15,  reward: 300, type: "mode_survive",   mode: "sudden"  },
  { id: "any_accuracy80",    label: "Clinical Precision",     desc: "Finish any game with 80%+ accuracy",               icon: "🎯", target: 1,   reward: 175, type: "accuracy_game"                  },
  { id: "any_play3",         label: "Daily Rounds",           desc: "Play 3 games of any mode",                        icon: "🏥", target: 3,   reward: 150, type: "any_play"                       },
  { id: "double_correct3",   label: "High Roller",            desc: "Answer 3 Double Jeopardy questions correctly",     icon: "🎲", target: 3,   reward: 200, type: "mode_correct",   mode: "double"  },
  { id: "streak_cashout5",   label: "Cash Out King",          desc: "Finish Streak Master with a 5+ streak",            icon: "💰", target: 5,   reward: 175, type: "streak_cashout", mode: "streak"  },
  { id: "rapid_newbest",     label: "Personal Best",          desc: "Set a new high score in Rapid Fire",               icon: "🏆", target: 1,   reward: 250, type: "mode_correct",   mode: "rapid"   },
  { id: "timeatk_play2",     label: "Beat The Clock",         desc: "Complete 2 Time Attack games",                     icon: "🕐", target: 2,   reward: 150, type: "any_play"                       },
]

/** Pick 3 bounties for today, deterministically based on date */
export function getTodaysBounties(): BountyDef[] {
  const dayNum = Math.floor(Date.now() / 86_400_000)
  const indices: number[] = []
  let seed = dayNum
  while (indices.length < 3) {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff
    const idx = seed % BOUNTY_POOL.length
    if (!indices.includes(idx)) indices.push(idx)
  }
  return indices.map(i => BOUNTY_POOL[i])
}

export const TODAY_DATE = () => new Date().toISOString().slice(0, 10)

// ── Store catalog ──────────────────────────────────────────────────────────────

export interface StoreItem {
  id: string
  name: string
  desc: string
  icon: string
  price: number
  category: "lifeline" | "cosmetic" | "vault"
  maxQuantity?: number // undefined = unlimited stacking; 1 = one-time purchase
  gradient: string
  cosmeticType?: "title" | "frame" | "highlight"
}

// ── Vault metadata for rich case-study display ──────────────────────────────
export interface VaultMeta {
  difficulty: "Intermediate" | "Advanced" | "Expert"
  steps: number
  discipline: string
  preview: string
}

export const VAULT_META: Record<string, VaultMeta> = {
  vault_sepsis_cascade: {
    difficulty: "Advanced", steps: 6, discipline: "Critical Care",
    preview: "Hour 1 in the ED: lactate 4.2 mmol/L, BP 82/54…",
  },
  vault_stemi_2am: {
    difficulty: "Advanced", steps: 5, discipline: "Cardiology",
    preview: "ST elevation II, III, aVF — door-to-balloon clock ticking…",
  },
  vault_dka_peds: {
    difficulty: "Expert", steps: 7, discipline: "Pediatrics",
    preview: "pH 7.08, glucose 480 mg/dL, altered 12-year-old…",
  },
  vault_bacterial_meningitis: {
    difficulty: "Intermediate", steps: 5, discipline: "Neurology",
    preview: "Neck stiffness, petechiae, GCS 13 and falling…",
  },
  vault_hepatic_failure: {
    difficulty: "Expert", steps: 8, discipline: "Gastroenterology",
    preview: "INR 3.8, encephalopathy grade II, transplant center on hold…",
  },
}

// ── Cosmetic display helpers ──────────────────────────────────────────────────

/** Short display label for title cosmetics shown in-game */
export const TITLE_LABELS: Record<string, string> = {
  title_pre_med:           "Pre-Med",
  title_intern:            "The Intern",
  title_fellow:            "Fellow",
  title_attending:         "Attending",
  title_chief_resident:    "Chief Resident",
  title_the_gunner:        "The Gunner",
  title_caffeine_dependent:"Caffeine Dependent",
  title_department_chair:  "Department Chair",
  title_chief_of_surgery:  "Chief of Surgery",
  title_dean_of_medicine:  "Dean of Medicine",
}

/** Tailwind ring classes for avatar frame cosmetics */
export const FRAME_RING_CLASSES: Record<string, string> = {
  frame_gold:               "ring-4 ring-yellow-400",
  frame_neon:               "ring-4 ring-cyan-400 animate-pulse",
  frame_fire:               "ring-4 ring-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.8)]",
  frame_legendary_diamond:  "ring-4 ring-white animate-pulse shadow-[0_0_20px_rgba(255,255,255,1)]",
  frame_legendary_biohazard:"ring-4 ring-green-500 shadow-[0_0_20px_rgba(34,197,94,0.9)]",
  frame_mythic_nebula:      "ring-4 ring-fuchsia-500 animate-pulse shadow-[0_0_25px_rgba(217,70,239,0.9)]",
  frame_mythic_heartbeat:   "ring-4 ring-red-600 animate-ping shadow-[0_0_25px_rgba(220,38,38,1)]",
}

/** Tailwind border+bg classes for leaderboard highlight cosmetics */
export const HIGHLIGHT_ROW_CLASSES: Record<string, string> = {
  highlight_neon:                    "bg-green-900/40 border-l-4 border-green-400",
  highlight_gold:                    "bg-yellow-900/40 border-l-4 border-yellow-400",
  highlight_amethyst:                "bg-purple-900/50 border-l-4 border-purple-400",
  highlight_legendary_crimson:       "bg-gradient-to-r from-red-950 to-red-900 border-l-4 border-red-500 animate-pulse",
  highlight_legendary_emerald:       "bg-gradient-to-r from-emerald-950 to-green-900 border-l-4 border-emerald-400 shadow-[inset_0_0_10px_rgba(52,211,153,0.5)]",
  highlight_mythic_lightning:        "bg-gradient-to-r from-blue-950 via-cyan-900 to-blue-950 border-l-4 border-cyan-400 animate-pulse",
  highlight_mythic_void_walker:      "bg-black border-l-4 border-gray-100 shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]",
}

export const STORE_ITEMS: StoreItem[] = [
  // ── Supply Closet — Consumable lifelines ─────────────────────────────────
  {
    id: "lifeline_50_50",
    name: "Consult Attending",
    desc: "Eliminates 2 wrong answer choices instantly (50/50).",
    icon: "🩺",
    price: 150,
    category: "lifeline",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "lifeline_freeze",
    name: "Stat Labs",
    desc: "Pauses the question timer for 10 seconds.",
    icon: "🧪",
    price: 100,
    category: "lifeline",
    gradient: "from-blue-500 to-cyan-600",
  },
  {
    id: "lifeline_second_opinion",
    name: "Second Opinion",
    desc: "Grants a second attempt if you get the question wrong.",
    icon: "👥",
    price: 200,
    category: "lifeline",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    id: "lifeline_beeper_page",
    name: "Beeper Page",
    desc: "Emergency! Instantly skips the current question without breaking your streak.",
    icon: "📟",
    price: 250,
    category: "lifeline",
    gradient: "from-rose-500 to-pink-600",
  },
  {
    id: "lifeline_bolus_dose",
    name: "Bolus Dose",
    desc: "Applies a 2x Nexus Point multiplier to the next question you answer correctly.",
    icon: "💉",
    price: 125,
    category: "lifeline",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    id: "lifeline_chart_review",
    name: "Chart Review",
    desc: "Highlights the single most critical diagnostic keyword in the clinical vignette.",
    icon: "📋",
    price: 75,
    category: "lifeline",
    gradient: "from-sky-500 to-blue-600",
  },

  // ── The Vault — Premium clinical simulations ─────────────────────────────
  {
    id: "vault_sepsis_cascade",
    name: "The Sepsis Cascade",
    desc: "6-step sepsis management simulation. Fluid resuscitation, cultures, and antibiotic escalation under time pressure.",
    icon: "🧬",
    price: 800,
    category: "vault",
    maxQuantity: 1,
    gradient: "from-rose-500 to-orange-600",
  },
  {
    id: "vault_stemi_2am",
    name: "STEMI at 2 AM",
    desc: "5-step STEMI pathway. Navigate cath lab decision, anticoagulation choice, and post-PCI management.",
    icon: "❤️",
    price: 750,
    category: "vault",
    maxQuantity: 1,
    gradient: "from-red-500 to-rose-600",
  },
  {
    id: "vault_dka_peds",
    name: "Pediatric DKA",
    desc: "7-step new-onset DKA with cerebral edema risk. Insulin dosing, fluid rate, and neuro monitoring.",
    icon: "🩸",
    price: 700,
    category: "vault",
    maxQuantity: 1,
    gradient: "from-violet-500 to-indigo-600",
  },
  {
    id: "vault_bacterial_meningitis",
    name: "Bacterial Meningitis",
    desc: "5-step meningitis emergency. LP timing, empiric antibiotics, steroid decision, and ICP management.",
    icon: "🧠",
    price: 650,
    category: "vault",
    maxQuantity: 1,
    gradient: "from-amber-500 to-yellow-600",
  },
  {
    id: "vault_hepatic_failure",
    name: "Acute Liver Failure",
    desc: "8-step acute-on-chronic liver failure. Encephalopathy grading, coagulopathy management, and transplant criteria.",
    icon: "🫀",
    price: 900,
    category: "vault",
    maxQuantity: 1,
    gradient: "from-green-500 to-emerald-600",
  },

  // ── Cosmetics — Custom Titles (Clinical Ladder) ───────────────────────────
  {
    id: "title_pre_med",
    name: '"Pre-Med"',
    desc: "The starting line.",
    icon: "📖",
    price: 50,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-slate-400 to-slate-500",
    cosmeticType: "title",
  },
  {
    id: "title_intern",
    name: '"The Intern"',
    desc: "A badge of honor for surviving the first year.",
    icon: "😊",
    price: 75,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-sky-400 to-blue-500",
    cosmeticType: "title",
  },
  {
    id: "title_fellow",
    name: '"Fellow"',
    desc: "Display the Fellow title next to your name.",
    icon: "🔬",
    price: 200,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-fuchsia-500 to-pink-600",
    cosmeticType: "title",
  },
  {
    id: "title_attending",
    name: '"Attending"',
    desc: "Display the Attending title next to your name.",
    icon: "🎓",
    price: 300,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-violet-500 to-purple-600",
    cosmeticType: "title",
  },
  {
    id: "title_chief_resident",
    name: '"Chief Resident"',
    desc: "Displayed as a badge next to your name during reveals.",
    icon: "⭐",
    price: 500,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-amber-500 to-orange-500",
    cosmeticType: "title",
  },
  {
    id: "title_the_gunner",
    name: '"The Gunner"',
    desc: "For the ones who live in the library.",
    icon: "🔥",
    price: 750,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-orange-500 to-red-500",
    cosmeticType: "title",
  },
  {
    id: "title_department_chair",
    name: '"Department Chair"',
    desc: "Running the floor. A badge of high competence.",
    icon: "💼",
    price: 1500,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-indigo-500 to-blue-600",
    cosmeticType: "title",
  },
  {
    id: "title_chief_of_surgery",
    name: '"Chief of Surgery"',
    desc: "Legendary Title. You own the OR.",
    icon: "⚡",
    price: 3500,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-rose-500 via-orange-500 to-amber-400",
    cosmeticType: "title",
  },
  {
    id: "title_dean_of_medicine",
    name: '"Dean of Medicine"',
    desc: "Mythic Title. The ultimate MedNexus flex.",
    icon: "👑",
    price: 10000,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-yellow-400 via-amber-500 to-orange-600",
    cosmeticType: "title",
  },
  {
    id: "title_caffeine_dependent",
    name: '"Caffeine Dependent"',
    desc: "Running purely on espresso and stress.",
    icon: "☕",
    price: 100,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-amber-700 to-yellow-600",
    cosmeticType: "title",
  },

  // ── Cosmetics — Avatar Frames ─────────────────────────────────────────────
  {
    id: "frame_gold",
    name: "Gold Frame",
    desc: "Glowing golden ring around your player avatar.",
    icon: "🏅",
    price: 400,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-yellow-400 to-amber-500",
    cosmeticType: "frame",
  },
  {
    id: "frame_neon",
    name: "Neon Pulse",
    desc: "Animated cyan neon ring that pulses.",
    icon: "💫",
    price: 600,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-cyan-400 to-teal-500",
    cosmeticType: "frame",
  },
  {
    id: "frame_fire",
    name: "On Fire",
    desc: "Flickering red-orange flame ring.",
    icon: "🔥",
    price: 700,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-orange-500 to-red-600",
    cosmeticType: "frame",
  },
  {
    id: "frame_legendary_diamond",
    name: "Legendary Diamond",
    desc: "A shimmering, ice-white crystalline frame.",
    icon: "💎",
    price: 1500,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-slate-200 via-white to-slate-300",
    cosmeticType: "frame",
  },
  {
    id: "frame_legendary_biohazard",
    name: "Legendary Biohazard",
    desc: "Glowing, toxic green radioactive aura.",
    icon: "☢️",
    price: 1800,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-green-400 to-emerald-600",
    cosmeticType: "frame",
  },
  {
    id: "frame_mythic_nebula",
    name: "Mythic Nebula",
    desc: "Deep space animated purple glow. The rarest frame.",
    icon: "🌌",
    price: 3000,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-fuchsia-500 via-purple-600 to-indigo-700",
    cosmeticType: "frame",
  },
  {
    id: "frame_mythic_heartbeat",
    name: "Mythic Heartbeat",
    desc: "Intense, deep crimson pulsing ring.",
    icon: "❤️‍🔥",
    price: 4000,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-red-600 via-rose-500 to-red-800",
    cosmeticType: "frame",
  },

  // ── Cosmetics — Leaderboard Highlights ───────────────────────────────────
  {
    id: "highlight_neon",
    name: "Neon Row",
    desc: "Neon green highlight on your leaderboard entry.",
    icon: "🟢",
    price: 300,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-emerald-400 to-green-500",
    cosmeticType: "highlight",
  },
  {
    id: "highlight_gold",
    name: "Gold Row",
    desc: "Your leaderboard row glows gold.",
    icon: "✨",
    price: 350,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-yellow-400 to-orange-400",
    cosmeticType: "highlight",
  },
  {
    id: "highlight_amethyst",
    name: "Amethyst Glow",
    desc: "A smooth, royal purple highlight.",
    icon: "🟣",
    price: 800,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-purple-500 to-violet-600",
    cosmeticType: "highlight",
  },
  {
    id: "highlight_legendary_crimson",
    name: "Legendary Crimson Surge",
    desc: "Pulses with a deep, intimidating red gradient.",
    icon: "🔴",
    price: 1500,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-red-700 to-rose-900",
    cosmeticType: "highlight",
  },
  {
    id: "highlight_legendary_emerald",
    name: "Legendary Emerald Life-Force",
    desc: "Vibrant, glowing green medical energy.",
    icon: "💚",
    price: 1800,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-emerald-600 to-green-900",
    cosmeticType: "highlight",
  },
  {
    id: "highlight_mythic_lightning",
    name: "Mythic Lightning",
    desc: "Electric blue spark gradient.",
    icon: "⚡",
    price: 3000,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-blue-600 via-cyan-500 to-blue-800",
    cosmeticType: "highlight",
  },
  {
    id: "highlight_mythic_void_walker",
    name: "Mythic Void Walker",
    desc: "Absorbs light. Pure pitch-black row with starlight borders.",
    icon: "🌑",
    price: 5000,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-gray-950 to-black",
    cosmeticType: "highlight",
  },
]

// ── Payout calculator (run server-side) ───────────────────────────────────────

export interface GameResult {
  mode: string
  score: number
  correct: number
  total: number
  bestStreak: number
  isNewHigh: boolean
  survivedCount?: number
  accuracy: number
}

export interface PayoutBreakdown {
  label: string
  amount: number
}

export function calculatePayout(result: GameResult): { total: number; breakdown: PayoutBreakdown[] } {
  const breakdown: PayoutBreakdown[] = []

  breakdown.push({ label: "Participation", amount: 50 })

  if (result.accuracy >= 80) breakdown.push({ label: "Accuracy Bonus (80%+)", amount: 50 })
  if (result.accuracy >= 90) breakdown.push({ label: "Accuracy Bonus (90%+)", amount: 50 })
  if (result.accuracy === 100 && result.total >= 3) breakdown.push({ label: "Perfect Round!", amount: 100 })

  if (result.bestStreak >= 5)  breakdown.push({ label: `Streak Bonus (${result.bestStreak}×)`, amount: Math.min(Math.floor(result.bestStreak / 5) * 25, 150) })
  if (result.isNewHigh)        breakdown.push({ label: "New Personal Best!", amount: 75 })

  const total = breakdown.reduce((s, b) => s + b.amount, 0)
  return { total, breakdown }
}

/** Compute bounty progress delta for a completed game */
export function computeBountyProgress(
  bounty: BountyDef,
  result: GameResult
): number {
  switch (bounty.type) {
    case "mode_correct":
      if (bounty.mode && bounty.mode !== result.mode) return 0
      if (bounty.id === "rapid_newbest") return result.isNewHigh ? 1 : 0
      return result.correct
    case "mode_score":
      if (bounty.mode && bounty.mode !== result.mode) return 0
      return result.score >= bounty.target ? bounty.target : 0
    case "mode_streak":
      if (bounty.mode && bounty.mode !== result.mode) return 0
      return result.bestStreak
    case "mode_survive":
      if (bounty.mode && bounty.mode !== result.mode) return 0
      return result.survivedCount ?? result.total
    case "accuracy_game":
      return result.accuracy >= 80 ? 1 : 0
    case "any_play":
      return 1
    case "streak_cashout":
      if (bounty.mode && bounty.mode !== result.mode) return 0
      return result.bestStreak
    default:
      return 0
  }
}
