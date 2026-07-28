import { ECONOMY_CONFIG, type StoreProductGroup } from "@/lib/economy-config"
// ── Economy constants shared between API and frontend ──────────────────────────

export interface BountyDef {
  id: string
  label: string
  desc: string
  icon: string
  target: number
  reward: number
  type: "practice" | "exam" | "accuracy" | "game" | "streak" | "discipline_variety" | "game_variety"
  mode?: string
  modes?: readonly string[]
  category: "practice" | "exam_accuracy" | "game_variety"
}

const BOUNTY_DEFINITIONS: BountyDef[] = [
  { id: "practice_correct10", label: "Practice Makes Progress", desc: "Answer 10 practice questions correctly", icon: "📚", target: 10, reward: 35, type: "practice", category: "practice" },
  { id: "practice_correct20", label: "Focused Practice", desc: "Answer 20 practice questions correctly", icon: "🩺", target: 20, reward: 35, type: "practice", category: "practice" },
  { id: "exam_complete", label: "Exam Day", desc: "Complete an exam", icon: "📝", target: 1, reward: 45, type: "exam", category: "exam_accuracy" },
  { id: "any_accuracy80", label: "Clinical Precision", desc: "Finish an activity with 80%+ accuracy", icon: "🎯", target: 1, reward: 40, type: "accuracy", category: "exam_accuracy" },
  { id: "discipline_variety3", label: "Clinical Rotation", desc: "Practice across 3 disciplines in one activity", icon: "🧭", target: 3, reward: 45, type: "discipline_variety", category: "exam_accuracy" },
  { id: "any_play3", label: "Daily Rounds", desc: "Play 3 games", icon: "🏥", target: 3, reward: 40, type: "game", category: "game_variety" },
  { id: "streak_8", label: "On A Roll", desc: "Build an 8× streak", icon: "🔥", target: 8, reward: 45, type: "streak", category: "game_variety" },
  { id: "game_variety2", label: "Change of Pace", desc: "Complete 2 eligible game rounds", icon: "🎮", target: 2, reward: 40, type: "game_variety", modes: ["rapid", "sudden", "timeatk", "double", "streak", "clash", "cohort", "wager", "djmulti"], category: "game_variety" },
  { id: "rapid_newbest", label: "Personal Best", desc: "Set a new high score in Rapid Fire", icon: "🏆", target: 1, reward: 45, type: "game", mode: "rapid", category: "game_variety" },
]

export const BOUNTY_POOL: BountyDef[] = BOUNTY_DEFINITIONS.map((definition) => {
  const configured = ECONOMY_CONFIG.bounties.find((bounty) => bounty.id === definition.id)
  if (!configured) throw new Error(`Missing economy bounty configuration: ${definition.id}`)
  return { ...definition, target: configured.target, reward: configured.reward }
})

/** Pick one bounty from each daily category, deterministically by economy date. */
export function getTodaysBounties(date = TODAY_DATE()): BountyDef[] {
  const dayNum = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000)
  const categories: BountyDef["category"][] = ["practice", "exam_accuracy", "game_variety"]
  let seed = dayNum
  return categories.map(category => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff
    const pool = BOUNTY_POOL.filter(bounty => bounty.category === category)
    return pool[seed % pool.length]
  })
}

/** Calendar date in the shared economy timezone. */
export function economyDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ECONOMY_CONFIG.timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date)
}

export const TODAY_DATE = () => economyDate()

/** Canonical Monday date (YYYY-MM-DD) identifying an economy week. */
export function economyWeekId(date = new Date()): string {
  const calendarDate = economyDate(date)
  const midnight = new Date(`${calendarDate}T00:00:00Z`)
  const daysSinceMonday = (midnight.getUTCDay() + 6) % 7
  midnight.setUTCDate(midnight.getUTCDate() - daysSinceMonday)
  return midnight.toISOString().slice(0, 10)
}

// ── Store catalog ──────────────────────────────────────────────────────────────

export type CosmeticRarity = "common" | "rare" | "epic" | "legendary" | "mythic"
export type CosmeticCatalogStatus = "active" | "remastered" | "retired" | "legacy"

/** Human-readable rarity names for visible badges and assistive descriptions. */
export const COSMETIC_RARITY_LABELS: Readonly<Record<CosmeticRarity, string>> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
}

export interface CosmeticCatalogMetadata {
  /** Lifecycle state. Retired and legacy IDs remain resolvable for their owners. */
  status: CosmeticCatalogStatus
  rarity: CosmeticRarity
  sortOrder: number
  previewTheme: string
  limitedUntil?: string
  featured?: boolean
  replacedBy?: string
  /** Renderer registry key retained for an owner of an older product. */
  legacyRenderer?: string
  releasedAt?: string
  collection?: string
  /** Customer-facing copy required when a stable ID receives new visuals. */
  upgradeAnnouncement?: string
}

export interface StoreItem {
  id: string
  name: string
  desc: string
  icon: string
  price: number
  productGroup: StoreProductGroup
  sellable?: boolean
  contentDestination?: string
  maxInventory?: number
  purchaseOptions?: readonly { id: string; quantity: number; price: number }[]
  category: "lifeline" | "cosmetic" | "vault"
  maxQuantity?: number // undefined = unlimited stacking; 1 = one-time purchase
  gradient: string
  cosmeticType?: "title" | "frame" | "highlight" | "avatar"
  /** Display-only cosmetic metadata. Purchase authorization remains server-side. */
  rarity?: CosmeticRarity
  sortOrder?: number
  previewTheme?: string
  limitedUntil?: string
  featured?: boolean
  status?: CosmeticCatalogStatus
  replacedBy?: string
  legacyRenderer?: string
  releasedAt?: string
  collection?: string
  upgradeAnnouncement?: string
  imagePath?: string
  /** Server-authoritative behavior and availability for Supply Closet items. */
  supply?: {
    effectType: "eliminate_wrong_answers" | "add_time" | "second_attempt"
    supportedModes: readonly SoloSupplyMode[]
    perQuestionUsageLimit: number
    stackLimit: number
    effectAmount: number
    effectUnit: "answer_choices" | "seconds"
  }
}

/**
 * Presentation metadata for every cosmetic in the sellable catalog. Rarity
 * follows configured price bands and must never be used as an ownership or
 * purchase-permission signal.
 */
export const COSMETIC_CATALOG_METADATA = {
  title_pre_med: { status: "active", rarity: "common", sortOrder: 10, previewTheme: "clinical-slate" },
  title_intern: { status: "active", rarity: "common", sortOrder: 20, previewTheme: "clinical-blue" },
  title_fellow: { status: "active", rarity: "rare", sortOrder: 30, previewTheme: "research-fuchsia" },
  title_attending: { status: "active", rarity: "rare", sortOrder: 40, previewTheme: "academic-violet" },
  title_chief_resident: { status: "active", rarity: "epic", sortOrder: 50, previewTheme: "leadership-amber" },
  title_the_gunner: { status: "active", rarity: "legendary", sortOrder: 60, previewTheme: "library-fire" },
  title_department_chair: { status: "active", rarity: "legendary", sortOrder: 70, previewTheme: "executive-indigo" },
  title_chief_of_surgery: { status: "active", rarity: "mythic", sortOrder: 80, previewTheme: "surgical-flare", featured: true },
  title_dean_of_medicine: { status: "active", rarity: "mythic", sortOrder: 90, previewTheme: "dean-gold", featured: true },
  title_caffeine_dependent: { status: "active", rarity: "common", sortOrder: 15, previewTheme: "coffee-amber" },
  frame_gold: { status: "retired", rarity: "rare", sortOrder: 10, previewTheme: "gold-ring", legacyRenderer: "frame_gold", releasedAt: "2025-01-15", collection: "Founders Wardrobe" },
  frame_neon: { status: "remastered", rarity: "epic", sortOrder: 20, previewTheme: "neon-pulse", releasedAt: "2025-02-01", collection: "Night Shift", upgradeAnnouncement: "Neon Frame has been visually upgraded with a sharper clinical glow while preserving its signature neon ring." },
  frame_fire: { status: "retired", rarity: "legendary", sortOrder: 30, previewTheme: "live-hellfire", legacyRenderer: "frame_fire" },
  frame_legendary_diamond: { status: "remastered", rarity: "legendary", sortOrder: 40, previewTheme: "surgical-steel", legacyRenderer: "frame_legendary_diamond", upgradeAnnouncement: "Legendary Diamond is now Surgical Steel. Existing owners keep access through the original product ID." },
  frame_legendary_biohazard: { status: "active", rarity: "legendary", sortOrder: 50, previewTheme: "biohazard" },
  frame_mythic_nebula: { status: "retired", rarity: "mythic", sortOrder: 60, previewTheme: "deep-nebula", legacyRenderer: "frame_mythic_nebula" },
  frame_mythic_heartbeat: { status: "retired", rarity: "mythic", sortOrder: 70, previewTheme: "heartbeat", legacyRenderer: "frame_mythic_heartbeat" },
  frame_lightning: { status: "retired", rarity: "mythic", sortOrder: 80, previewTheme: "high-voltage", legacyRenderer: "frame_lightning" },
  frame_toxic_drip: { status: "retired", rarity: "mythic", sortOrder: 90, previewTheme: "toxic-ooze", legacyRenderer: "frame_toxic_drip" },
  frame_vital_ring: { status: "active", rarity: "epic", sortOrder: 100, previewTheme: "vital-ring", collection: "Clinical Instruments" },
  frame_surgical_steel: { status: "active", rarity: "legendary", sortOrder: 110, previewTheme: "surgical-steel", collection: "Clinical Instruments" },
  frame_chart_grid: { status: "active", rarity: "epic", sortOrder: 120, previewTheme: "chart-grid", collection: "Clinical Instruments" },
  frame_ct_gantry: { status: "active", rarity: "legendary", sortOrder: 130, previewTheme: "ct-gantry", collection: "Imaging Suite" },
  frame_microscope_iris: { status: "active", rarity: "legendary", sortOrder: 140, previewTheme: "microscope-iris", collection: "Laboratory" },
  frame_neural_synapse: { status: "active", rarity: "mythic", sortOrder: 150, previewTheme: "neural-synapse", collection: "Neurosciences", featured: true },
  frame_code_blue: { status: "active", rarity: "legendary", sortOrder: 160, previewTheme: "code-blue", collection: "Emergency Medicine" },
  frame_operating_theatre: { status: "active", rarity: "legendary", sortOrder: 170, previewTheme: "operating-theatre", collection: "Surgery" },
  frame_cell_culture: { status: "active", rarity: "legendary", sortOrder: 180, previewTheme: "cell-culture", collection: "Laboratory" },
  frame_cardiac_conduction: { status: "active", rarity: "mythic", sortOrder: 190, previewTheme: "cardiac-conduction", collection: "Cardiology", featured: true },
  frame_radiology_contrast: { status: "active", rarity: "legendary", sortOrder: 200, previewTheme: "radiology-contrast", collection: "Imaging Suite" },
  frame_the_resuscitator: { status: "active", rarity: "mythic", sortOrder: 210, previewTheme: "resuscitator", collection: "Emergency Medicine", featured: true },
  highlight_neon: { status: "retired", rarity: "common", sortOrder: 10, previewTheme: "neon-row", replacedBy: "highlight_monitor_sweep", legacyRenderer: "highlight_neon" },
  highlight_gold: { status: "retired", rarity: "common", sortOrder: 20, previewTheme: "gold-row", replacedBy: "highlight_prescription_label", legacyRenderer: "highlight_gold" },
  highlight_amethyst: { status: "retired", rarity: "epic", sortOrder: 30, previewTheme: "amethyst-row", replacedBy: "highlight_anatomy_plate", legacyRenderer: "highlight_amethyst" },
  highlight_legendary_crimson: { status: "retired", rarity: "legendary", sortOrder: 40, previewTheme: "crimson-surge", replacedBy: "highlight_triage_priority", legacyRenderer: "highlight_legendary_crimson" },
  highlight_legendary_emerald: { status: "retired", rarity: "legendary", sortOrder: 50, previewTheme: "emerald-force", replacedBy: "highlight_sterile_field", legacyRenderer: "highlight_legendary_emerald" },
  highlight_mythic_lightning: { status: "retired", rarity: "mythic", sortOrder: 60, previewTheme: "electric-row", replacedBy: "highlight_neural_field", legacyRenderer: "highlight_mythic_lightning" },
  highlight_mythic_void_walker: { status: "retired", rarity: "mythic", sortOrder: 70, previewTheme: "void-row", replacedBy: "highlight_radiology_lightbox", legacyRenderer: "highlight_mythic_void_walker" },
  highlight_monitor_sweep: { status: "active", rarity: "rare", sortOrder: 100, previewTheme: "monitor-sweep", collection: "Clinical Rounds" },
  highlight_prescription_label: { status: "active", rarity: "rare", sortOrder: 110, previewTheme: "prescription-label", collection: "Clinical Rounds" },
  highlight_anatomy_plate: { status: "active", rarity: "epic", sortOrder: 120, previewTheme: "anatomy-plate", collection: "Clinical Rounds" },
  highlight_triage_priority: { status: "active", rarity: "legendary", sortOrder: 130, previewTheme: "triage-priority", collection: "Emergency Medicine" },
  highlight_sterile_field: { status: "active", rarity: "legendary", sortOrder: 140, previewTheme: "sterile-field", collection: "Surgery" },
  highlight_blood_flow: { status: "active", rarity: "legendary", sortOrder: 150, previewTheme: "blood-flow", collection: "Cardiology" },
  highlight_neural_field: { status: "active", rarity: "mythic", sortOrder: 160, previewTheme: "neural-field", collection: "Neurosciences", featured: true },
  highlight_radiology_lightbox: { status: "active", rarity: "mythic", sortOrder: 170, previewTheme: "radiology-lightbox", collection: "Imaging Suite", featured: true },
  avatar_scrub_tech: { status: "active", rarity: "rare", sortOrder: 10, previewTheme: "blue-scrubs" },
  avatar_coffee_drip: { status: "active", rarity: "rare", sortOrder: 20, previewTheme: "coffee-iv" },
  avatar_lab_rat: { status: "active", rarity: "epic", sortOrder: 30, previewTheme: "research-lab" },
  avatar_night_shift: { status: "active", rarity: "epic", sortOrder: 40, previewTheme: "night-shift" },
  avatar_gold_steth: { status: "active", rarity: "legendary", sortOrder: 50, previewTheme: "gold-stethoscope" },
  avatar_plague_doctor: { status: "active", rarity: "legendary", sortOrder: 60, previewTheme: "plague-mask" },
  avatar_cyber_surgeon: { status: "active", rarity: "legendary", sortOrder: 70, previewTheme: "cyber-surgeon" },
  avatar_ascended: { status: "active", rarity: "mythic", sortOrder: 80, previewTheme: "ascended-healer", featured: true },
  avatar_marble: { status: "active", rarity: "mythic", sortOrder: 90, previewTheme: "marble-statue" },
  avatar_vital_sign: { status: "active", rarity: "mythic", sortOrder: 100, previewTheme: "living-ekg", featured: true },
} as const satisfies Record<string, CosmeticCatalogMetadata>

export type SoloSupplyMode = "rapid" | "sudden" | "timeatk" | "streak" | "double"

export const SOLO_SUPPLY_MODE_LABELS: Readonly<Record<SoloSupplyMode, string>> = {
  rapid: "Rapid Fire",
  sudden: "Sudden Death",
  timeatk: "Time Attack",
  streak: "Streak Master",
  double: "Double Jeopardy",
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

/** Dedicated frame classes keep motion on decorative pseudo-elements. */
export const FRAME_RING_CLASSES: Record<string, string> = {
  frame_gold:               "cosmetic-frame cosmetic-frame--gold",
  frame_neon:               "cosmetic-frame cosmetic-frame--neon",
  frame_fire:               "cosmetic-frame cosmetic-frame--fire",
  frame_legendary_diamond:  "cosmetic-frame cosmetic-frame--diamond",
  frame_legendary_biohazard:"cosmetic-frame cosmetic-frame--biohazard",
  frame_mythic_nebula:      "cosmetic-frame cosmetic-frame--nebula",
  frame_mythic_heartbeat:   "cosmetic-frame cosmetic-frame--heartbeat",
  frame_lightning:          "cosmetic-frame cosmetic-frame--lightning",
  frame_toxic_drip:         "cosmetic-frame cosmetic-frame--toxic",
}

/** Theme-aware leaderboard treatments with stable, high-contrast content. */
export const HIGHLIGHT_ROW_CLASSES: Record<string, string> = {
  highlight_neon:                    "cosmetic-highlight cosmetic-highlight--neon",
  highlight_gold:                    "cosmetic-highlight cosmetic-highlight--gold",
  highlight_amethyst:                "cosmetic-highlight cosmetic-highlight--amethyst",
  highlight_legendary_crimson:       "cosmetic-highlight cosmetic-highlight--crimson",
  highlight_legendary_emerald:       "cosmetic-highlight cosmetic-highlight--emerald",
  highlight_mythic_lightning:        "cosmetic-highlight cosmetic-highlight--lightning",
  highlight_mythic_void_walker:      "cosmetic-highlight cosmetic-highlight--void",
}

/** Accessible description so prestige is never communicated by styling alone. */
export function getCosmeticAccessibleLabel(id?: string | null): string | null {
  if (!id) return null
  const item = STORE_ITEMS.find(candidate => candidate.id === id)
  if (!item) return null
  const rarity = item.rarity ? `${COSMETIC_RARITY_LABELS[item.rarity]} ` : ""
  return `${rarity}${item.name}`
}

const STORE_ITEM_DEFINITIONS: Omit<StoreItem, "price" | "productGroup">[] = [
  // ── Supply Closet — Consumable lifelines ─────────────────────────────────
  {
    id: "lifeline_50_50",
    name: "Consult Attending",
    desc: "Eliminates 2 wrong answer choices instantly (50/50).",
    icon: "🩺",
    category: "lifeline",
    gradient: "from-emerald-500 to-teal-600",
    supply: {
      effectType: "eliminate_wrong_answers",
      supportedModes: ["rapid", "sudden", "timeatk", "streak", "double"],
      perQuestionUsageLimit: 1,
      stackLimit: ECONOMY_CONFIG.store.catalog.lifeline_50_50.maxInventory,
      effectAmount: 2,
      effectUnit: "answer_choices",
    },
  },
  {
    id: "lifeline_freeze",
    name: "Stat Labs",
    desc: "Adds 10 seconds to the current question timer.",
    icon: "🧪",
    category: "lifeline",
    gradient: "from-blue-500 to-cyan-600",
    supply: {
      effectType: "add_time",
      supportedModes: ["rapid", "sudden", "timeatk"],
      perQuestionUsageLimit: 1,
      stackLimit: ECONOMY_CONFIG.store.catalog.lifeline_freeze.maxInventory,
      effectAmount: 10,
      effectUnit: "seconds",
    },
  },
  {
    id: "lifeline_second_opinion",
    name: "Second Opinion",
    desc: "Activate before answering to get one retry after a wrong first answer. Assisted corrections continue the game but earn no accuracy or NP credit.",
    icon: "👥",
    category: "lifeline",
    gradient: "from-amber-500 to-orange-600",
    supply: {
      effectType: "second_attempt",
      supportedModes: ["rapid", "sudden", "timeatk", "streak"],
      perQuestionUsageLimit: 1,
      stackLimit: ECONOMY_CONFIG.store.catalog.lifeline_second_opinion.maxInventory,
      effectAmount: 1,
      effectUnit: "answer_choices",
    },
  },

  // ── The Vault — Premium clinical simulations ─────────────────────────────
  {
    id: "vault_sepsis_cascade",
    name: "The Sepsis Cascade",
    desc: "6-step sepsis management simulation. Fluid resuscitation, cultures, and antibiotic escalation under time pressure.",
    icon: "🧬",
    category: "vault",
    maxQuantity: 1,
    gradient: "from-rose-500 to-orange-600",
  },
  {
    id: "vault_stemi_2am",
    name: "STEMI at 2 AM",
    desc: "5-step STEMI pathway. Navigate cath lab decision, anticoagulation choice, and post-PCI management.",
    icon: "❤️",
    category: "vault",
    maxQuantity: 1,
    gradient: "from-red-500 to-rose-600",
  },
  {
    id: "vault_dka_peds",
    name: "Pediatric DKA",
    desc: "7-step new-onset DKA with cerebral edema risk. Insulin dosing, fluid rate, and neuro monitoring.",
    icon: "🩸",
    category: "vault",
    maxQuantity: 1,
    gradient: "from-violet-500 to-indigo-600",
  },
  {
    id: "vault_bacterial_meningitis",
    name: "Bacterial Meningitis",
    desc: "5-step meningitis emergency. LP timing, empiric antibiotics, steroid decision, and ICP management.",
    icon: "🧠",
    category: "vault",
    maxQuantity: 1,
    gradient: "from-amber-500 to-yellow-600",
  },
  {
    id: "vault_hepatic_failure",
    name: "Acute Liver Failure",
    desc: "8-step acute-on-chronic liver failure. Encephalopathy grading, coagulopathy management, and transplant criteria.",
    icon: "🫀",
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
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-cyan-400 to-teal-500",
    cosmeticType: "frame",
  },
  {
    id: "frame_fire",
    name: "Live Hellfire",
    desc: "Multi-layered living flames roar around your avatar — shifting reds, oranges, and yellows that flicker in real time.",
    icon: "🔥",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-red-700 via-orange-500 to-yellow-400",
    cosmeticType: "frame",
  },
  {
    id: "frame_legendary_diamond",
    name: "Legendary Diamond",
    desc: "A shimmering, ice-white crystalline frame.",
    icon: "💎",
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
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-red-600 via-rose-500 to-red-800",
    cosmeticType: "frame",
  },
  {
    id: "frame_lightning",
    name: "High-Voltage Lightning",
    desc: "Lurks in near-darkness for seconds, then erupts in three rapid arcs of blinding cyan and white electricity.",
    icon: "⚡",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-cyan-300 via-white to-blue-400",
    cosmeticType: "frame",
  },
  {
    id: "frame_toxic_drip",
    name: "Toxic Drip",
    desc: "Neon-green toxic ooze seeps and slowly drips down the edges of your avatar frame.",
    icon: "☣️",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-green-400 via-lime-300 to-emerald-600",
    cosmeticType: "frame",
  },
  ...([
    ["frame_vital_ring", "Vital Ring", "Monitor-bright vital waveform ring.", "🩺", "from-cyan-300 to-cyan-700"],
    ["frame_surgical_steel", "Surgical Steel", "Precision-machined surgical steel.", "⚙️", "from-slate-100 to-slate-600"],
    ["frame_chart_grid", "Chart Grid", "A measured clinical chart grid.", "📊", "from-sky-200 to-sky-700"],
    ["frame_ct_gantry", "CT Gantry", "The geometry of a CT scanner bore.", "◉", "from-slate-200 to-slate-800"],
    ["frame_microscope_iris", "Microscope Iris", "Interlocking microscope aperture blades.", "🔬", "from-purple-300 to-purple-900"],
    ["frame_neural_synapse", "Neural Synapse", "Branching neural terminals and nodes.", "🧠", "from-fuchsia-300 to-indigo-900"],
    ["frame_code_blue", "Code Blue", "A decisive emergency response signal.", "✚", "from-blue-200 to-blue-900"],
    ["frame_operating_theatre", "Operating Theatre", "A ring of shadowless theatre lamps.", "💡", "from-emerald-100 to-emerald-800"],
    ["frame_cell_culture", "Cell Culture", "Living colonies viewed through a culture dish.", "🧫", "from-amber-200 to-orange-800"],
    ["frame_cardiac_conduction", "Cardiac Conduction", "A clinical cardiac conduction pathway.", "🫀", "from-rose-200 to-rose-900"],
    ["frame_radiology_contrast", "Radiology Contrast", "High-contrast diagnostic imaging light.", "🩻", "from-white via-indigo-200 to-indigo-950"],
    ["frame_the_resuscitator", "The Resuscitator", "Defibrillator energy for the decisive moment.", "⚡", "from-yellow-200 via-orange-500 to-red-900"],
  ] as const).map(([id, name, desc, icon, gradient]) => ({ id, name, desc, icon, gradient, category: "cosmetic" as const, maxQuantity: 1, cosmeticType: "frame" as const })),

  // ── Cosmetics — Leaderboard Highlights ───────────────────────────────────
  {
    id: "highlight_neon",
    name: "Neon Row",
    desc: "Neon green highlight on your leaderboard entry.",
    icon: "🟢",
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
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-gray-950 to-black",
    cosmeticType: "highlight",
  },
  ...([
    ["highlight_monitor_sweep", "Monitor Sweep", "A precise bedside-monitor sweep marks your leaderboard row.", "ECG", "from-emerald-400 to-teal-700"],
    ["highlight_prescription_label", "Prescription Label", "A crisp medication-label treatment with clinical cyan accents.", "Rx", "from-cyan-300 to-cyan-800"],
    ["highlight_anatomy_plate", "Anatomy Plate", "An atlas-inspired violet plate gives your result anatomical depth.", "AP", "from-fuchsia-300 to-violet-800"],
    ["highlight_triage_priority", "Triage Priority", "Emergency red edge signals a top-priority result.", "T1", "from-red-400 to-rose-900"],
    ["highlight_sterile_field", "Sterile Field", "A cool surgical field surrounds your score without obscuring it.", "SF", "from-cyan-200 to-teal-800"],
    ["highlight_blood_flow", "Blood Flow", "A restrained arterial pulse travels along the row edge.", "BF", "from-rose-400 to-red-900"],
    ["highlight_neural_field", "Neural Field", "Synaptic violet energy responds to decisive leaderboard moments.", "NF", "from-violet-400 to-indigo-950"],
    ["highlight_radiology_lightbox", "Radiology Lightbox", "Diagnostic blue exposure frames your row like an imaging study.", "XR", "from-blue-200 to-indigo-950"],
  ] as const).map(([id, name, desc, icon, gradient]) => ({ id, name, desc, icon, gradient, category: "cosmetic" as const, maxQuantity: 1, cosmeticType: "highlight" as const })),

  // ── Cosmetics — Avatars ───────────────────────────────────────────────────
  {
    id: "avatar_scrub_tech",
    name: "The Scrub Tech",
    desc: "Standard issue blue scrubs.",
    icon: "🥼",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-blue-400 to-blue-600",
    cosmeticType: "avatar",
    imagePath: "/avatars/scrubs.png",
  },
  {
    id: "avatar_coffee_drip",
    name: "The Coffee Drip",
    desc: "An IV bag, but it's filled with espresso.",
    icon: "☕",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-amber-700 to-yellow-600",
    cosmeticType: "avatar",
    imagePath: "/avatars/coffee-iv.png",
  },
  {
    id: "avatar_lab_rat",
    name: "The Lab Rat",
    desc: "Goggles and a white coat.",
    icon: "🐭",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-violet-500 to-purple-600",
    cosmeticType: "avatar",
    imagePath: "/avatars/lab-rat.png",
  },
  {
    id: "avatar_night_shift",
    name: "Night Shift",
    desc: "Dark circles and a flashlight.",
    icon: "🌙",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-slate-700 to-slate-900",
    cosmeticType: "avatar",
    imagePath: "/avatars/night-shift.png",
  },
  {
    id: "avatar_gold_steth",
    name: "Legendary Golden Stethoscope",
    desc: "Pure 24k gold diagnostic tool.",
    icon: "🩺",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-yellow-400 via-amber-500 to-orange-500",
    cosmeticType: "avatar",
    imagePath: "/avatars/gold-steth.png",
  },
  {
    id: "avatar_plague_doctor",
    name: "Legendary Plague Doctor",
    desc: "Vintage intimidating bird mask.",
    icon: "🎭",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-stone-700 to-stone-900",
    cosmeticType: "avatar",
    imagePath: "/avatars/plague-doctor.png",
  },
  {
    id: "avatar_cyber_surgeon",
    name: "Legendary Cyber-Surgeon",
    desc: "Neon-lit, futuristic operator.",
    icon: "🤖",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-cyan-500 via-blue-600 to-indigo-700",
    cosmeticType: "avatar",
    imagePath: "/avatars/cyber-surgeon.png",
  },
  {
    id: "avatar_ascended",
    name: "Mythic Ascended Healer",
    desc: "A glowing, ethereal entity of pure medical knowledge.",
    icon: "✨",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-fuchsia-500 via-violet-600 to-purple-700",
    cosmeticType: "avatar",
    imagePath: "/avatars/ascended.png",
  },
  {
    id: "avatar_marble",
    name: "Mythic First Do No Harm",
    desc: "Ancient Greek marble statue aesthetic.",
    icon: "🏛️",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-slate-200 via-gray-300 to-slate-400",
    cosmeticType: "avatar",
    imagePath: "/avatars/marble.png",
  },
  {
    id: "avatar_vital_sign",
    name: "Mythic Vital Sign",
    desc: "A living, pulsing neon EKG waveform.",
    icon: "💓",
    category: "cosmetic",
    maxQuantity: 1,
    gradient: "from-emerald-400 via-green-500 to-teal-600",
    cosmeticType: "avatar",
    imagePath: "/avatars/vital-sign.png",
  },
]


export const STORE_ITEMS: StoreItem[] = STORE_ITEM_DEFINITIONS.map((item) => {
  const catalogEntry = ECONOMY_CONFIG.store.catalog[item.id as keyof typeof ECONOMY_CONFIG.store.catalog]
  if (!catalogEntry) throw new Error(`Missing store catalog configuration: ${item.id}`)
  const cosmeticMetadata = item.category === "cosmetic"
    ? COSMETIC_CATALOG_METADATA[item.id as keyof typeof COSMETIC_CATALOG_METADATA]
    : undefined
  if (item.category === "cosmetic" && !cosmeticMetadata) {
    throw new Error(`Missing cosmetic catalog metadata: ${item.id}`)
  }
  return { ...item, ...catalogEntry, ...cosmeticMetadata }
})

/** Lifecycle-aware purchase policy; ownership and rendering are intentionally separate. */
export function isStoreItemPurchasable(item: StoreItem): boolean {
  return item.sellable !== false
    && (item.category !== "cosmetic" || (item.status !== "retired" && item.status !== "legacy"))
}

/** Publicly listed products whose purchase is authorized by the server catalog. */
export const SELLABLE_STORE_ITEMS = STORE_ITEMS.filter(isStoreItemPurchasable)

// ── Clinical Ladder ──────────────────────────────────────────────────────────
// Rank points accumulate from every NP payout. Crossing a tier boundary
// triggers a one-time +1000 NP bonus awarded server-side.

export const CLINICAL_TIERS = ECONOMY_CONFIG.rankUp.thresholds

export type ClinicalTierName = (typeof CLINICAL_TIERS)[number]["name"]

/** Returns the 0-based tier index for a given rank_points total. */
export function getClinicalTierIndex(rankPoints: number): number {
  let idx = 0
  for (let i = 0; i < CLINICAL_TIERS.length; i++) {
    if (rankPoints >= CLINICAL_TIERS[i].minPoints) idx = i
  }
  return idx
}

export const RANK_UP_BONUS_NP = ECONOMY_CONFIG.rankUp.reward

/** Compute rank-up bonus when rank_points cross one or more Clinical Ladder tiers. */
export function computeRankUpBonus(oldPoints: number, newPoints: number): {
  tiersGained: number
  bonusNP: number
  newTierNames: string[]
} {
  const oldIdx = getClinicalTierIndex(Math.max(0, oldPoints))
  const newIdx = getClinicalTierIndex(Math.max(0, newPoints))
  if (newIdx <= oldIdx) return { tiersGained: 0, bonusNP: 0, newTierNames: [] }
  const tiersGained = newIdx - oldIdx
  const newTierNames = CLINICAL_TIERS.slice(oldIdx + 1, newIdx + 1).map(t => t.name)
  return { tiersGained, bonusNP: tiersGained * RANK_UP_BONUS_NP, newTierNames }
}

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
  /** True when the player activated at least one Supply Closet lifeline this session. */
  lifelineUsed?: boolean
  disciplines?: readonly string[]
}

export interface PayoutBreakdown {
  label: string
  amount: number
}

export function calculatePayout(result: GameResult): { total: number; breakdown: PayoutBreakdown[] } {
  const breakdown: PayoutBreakdown[] = []

  const rewards = ECONOMY_CONFIG.gameRewards.solo
  breakdown.push({ label: "Valid Completion", amount: rewards.completion })
  const accuracyBonus = [...rewards.accuracyBonuses]
    .reverse().find((band) => result.accuracy >= band.minimumAccuracy)
  if (accuracyBonus) breakdown.push({ label: `Accuracy Bonus (${accuracyBonus.minimumAccuracy}%+)`, amount: accuracyBonus.bonus })
  if (result.isNewHigh) breakdown.push({ label: "New Personal Best!", amount: rewards.personalBest })
  return { total: breakdown.reduce((sum, item) => sum + item.amount, 0), breakdown }
}

/** Compute bounty progress delta for a completed game */
export function computeBountyProgress(
  bounty: BountyDef,
  result: GameResult
): number {
  switch (bounty.type) {
    case "practice":
      return result.mode === "trial" || result.mode === "tutor" ? result.correct : 0
    case "exam":
      return result.mode === "exam" ? 1 : 0
    case "game":
      if (bounty.mode && bounty.mode !== result.mode) return 0
      if (bounty.id === "rapid_newbest") return result.isNewHigh ? 1 : 0
      return 1
    case "streak":
      return result.bestStreak
    case "accuracy":
      return result.accuracy >= 80 ? 1 : 0
    case "discipline_variety":
      return new Set(result.disciplines ?? []).size
    case "game_variety":
      if (!bounty.modes?.includes(result.mode)) return 0
      return 1
    default:
      return 0
  }
}
