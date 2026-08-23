/**
 * Returns the number of attempts represented by a finished Sudden Death round.
 * A completed pool contains only successful attempts, while an early ending must
 * retain the final incorrect or timed-out attempt recorded in the answer history.
 */
export function getSuddenDeathResultTotal(
  completionReason: string | null,
  survivedCount: number,
  answeredCount: number,
): number {
  return completionReason === "pool_completed" ? survivedCount : answeredCount
}

export function getSuddenDeathOutcome(completionReason: string | null) {
  return completionReason === "pool_completed"
    ? { emoji: "🏆", headline: "You Won!" }
    : { emoji: "💀", headline: "Game Over!" }
}
