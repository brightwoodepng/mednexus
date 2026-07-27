export type CompletionAttempt = { questionId: string; isCorrect: boolean }

export type CompletionMetadata = {
  completionReason?: unknown
  clientRoundStartedAt?: unknown
  clientRoundFinishedAt?: unknown
  selectedQuestionCount?: unknown
  answeredQuestionCount?: unknown
  freezeCount?: unknown
  wagerHistory?: unknown
}

export type ServerCompletionTiming = {
  startedAt: Date | string
  finishedAt: Date | string
  verifiedFreezeCount?: number
}

const TIME_ATTACK_START_SECONDS = 90
const TIME_ATTACK_CORRECT_EXTENSION_SECONDS = 3
const TIME_ATTACK_WRONG_PENALTY_SECONDS = 5
const STAT_LABS_ADDED_SECONDS = 10
const TIMEOUT_CLOCK_TOLERANCE_MS = 5_000
const DOUBLE_STARTING_BANK = 500
const DOUBLE_WAGER_RATIOS = [0.1, 0.25, 0.5, 1]

export function calculateDoubleBank(attempts: CompletionAttempt[], wagerHistory: unknown): number | null {
  if (!Array.isArray(wagerHistory) || wagerHistory.length !== attempts.length) return null
  let bank = DOUBLE_STARTING_BANK
  for (let index = 0; index < attempts.length; index++) {
    const wager = wagerHistory[index]
    const permitted = DOUBLE_WAGER_RATIOS.map((ratio) => Math.max(10, Math.floor(bank * ratio)))
    if (!Number.isInteger(wager) || !permitted.includes(wager as number)) return null
    bank = attempts[index].isCorrect ? bank + (wager as number) : Math.max(0, bank - (wager as number))
    if (bank === 0 && index !== attempts.length - 1) return null
  }
  return bank
}

/** Reconstructs a solo round solely from its immutable answer snapshot and bounded metadata. */
export function hasConsistentSoloCompletion(
  mode: string,
  snapshotIds: string[],
  attempts: CompletionAttempt[],
  metadata: CompletionMetadata,
  serverTiming: ServerCompletionTiming,
): boolean {
  const reason = metadata.completionReason
  // Client clock values remain in metadata for diagnostics, but never establish
  // payout eligibility. The session row and authenticated usage events are the
  // authoritative clock and Stat Labs activation ledger.
  const startedAt = new Date(serverTiming.startedAt).getTime()
  const finishedAt = new Date(serverTiming.finishedAt).getTime()
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt
    || metadata.selectedQuestionCount !== snapshotIds.length
    || metadata.answeredQuestionCount !== attempts.length) return false

  const isExactSnapshot = attempts.length === snapshotIds.length
    && attempts.every((attempt, index) => attempt.questionId === snapshotIds[index])
  if (reason === "pool_completed") {
    return isExactSnapshot && (mode !== "double" || calculateDoubleBank(attempts, metadata.wagerHistory) !== null)
  }

  const isPrefix = attempts.length > 0 && attempts.length <= snapshotIds.length
    && attempts.every((attempt, index) => attempt.questionId === snapshotIds[index])
  if (!isPrefix) return false
  if (mode === "rapid" && reason === "lives_exhausted") {
    return attempts.filter((attempt) => !attempt.isCorrect).length >= 3
  }
  if (mode === "sudden" && reason === "incorrect_answer") {
    return attempts.at(-1)?.isCorrect === false
      && attempts.slice(0, -1).every((attempt) => attempt.isCorrect)
  }
  if (mode === "streak" && reason === "player_finished") return true
  if (mode === "timeatk" && reason === "timeout") {
    const freezes = serverTiming.verifiedFreezeCount ?? 0
    if (!Number.isInteger(freezes) || freezes < 0) return false
    const correct = attempts.filter((attempt) => attempt.isCorrect).length
    const wrong = attempts.length - correct
    const expectedDuration = Math.max(0,
      TIME_ATTACK_START_SECONDS
      + correct * TIME_ATTACK_CORRECT_EXTENSION_SECONDS
      - wrong * TIME_ATTACK_WRONG_PENALTY_SECONDS
      + freezes * STAT_LABS_ADDED_SECONDS) * 1000
    return Math.abs((finishedAt - startedAt) - expectedDuration) <= TIMEOUT_CLOCK_TOLERANCE_MS
  }
  if (mode === "double" && reason === "bank_depleted") {
    return calculateDoubleBank(attempts, metadata.wagerHistory) === 0
  }
  return false
}
