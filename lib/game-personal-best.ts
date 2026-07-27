export type SoloPersonalBestMode = "rapid" | "sudden" | "timeatk" | "double" | "streak"

export interface SoloPersonalBestResult {
  mode: SoloPersonalBestMode
  score: number
  bestStreak: number
  survivedCount?: number
}

/** Return the mode-specific value shown and persisted as the player's record. */
export function personalBestValue(result: SoloPersonalBestResult): number {
  if (result.mode === "sudden") return result.survivedCount ?? 0
  if (result.mode === "streak") return result.bestStreak
  return result.score
}

/** Ties retain the stored record, but never count as a new personal best. */
export function getPersonalBestUpdate(previous: number, current: number) {
  return {
    best: Math.max(previous, current),
    isNewHigh: current > previous,
  }
}
