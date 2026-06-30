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
  const today = new Date().toISOString().slice(0, 10)
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
  category: "lifeline" | "cosmetic"
  maxQuantity?: number // undefined = unlimited stacking
  gradient: string
}

export const STORE_ITEMS: StoreItem[] = [
  {
    id: "lifeline_50_50",
    name: "Consult Attending",
    desc: "Eliminates 2 wrong answer choices instantly (50/50)",
    icon: "🩺",
    price: 150,
    category: "lifeline",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "lifeline_freeze",
    name: "Stat Labs",
    desc: "Pauses the question timer for 10 seconds",
    icon: "🧪",
    price: 100,
    category: "lifeline",
    gradient: "from-blue-500 to-cyan-600",
  },
  {
    id: "title_chief_resident",
    name: "\"Chief Resident\"",
    desc: "Display the Chief Resident title on your profile",
    icon: "⭐",
    price: 500,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-amber-500 to-orange-500",
  },
  {
    id: "title_attending",
    name: "\"Attending\"",
    desc: "Display the Attending title on your profile",
    icon: "🎓",
    price: 300,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    id: "title_fellow",
    name: "\"Fellow\"",
    desc: "Display the Fellow title on your profile",
    icon: "🔬",
    price: 200,
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-fuchsia-500 to-pink-600",
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
