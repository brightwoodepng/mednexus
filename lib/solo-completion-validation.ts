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

const TIME_ATTACK_START_SECONDS = 90
const TIME_ATTACK_CORRECT_EXTENSION_SECONDS = 3
const TIME_ATTACK_WRONG_PENALTY_SECONDS = 5
const FREEZE_EXTENSION_SECONDS = 10
const TIMEOUT_CLOCK_TOLERANCE_MS = 5_000
const DOUBLE_STARTING_BANK = 500
const DOUBLE_WAGER_RATIOS = [0.1, 0.25, 0.5, 1]

/** Reconstructs a solo round solely from its immutable answer snapshot and bounded metadata. */
export function hasConsistentSoloCompletion(
  mode: string,
  snapshotIds: string[],
  attempts: CompletionAttempt[],
  metadata: CompletionMetadata,
): boolean {
  const reason = metadata.completionReason
  const startedAt = typeof metadata.clientRoundStartedAt === "string"
    ? Date.parse(metadata.clientRoundStartedAt) : NaN
  const finishedAt = typeof metadata.clientRoundFinishedAt === "string"
    ? Date.parse(metadata.clientRoundFinishedAt) : NaN
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt
    || metadata.selectedQuestionCount !== snapshotIds.length
    || metadata.answeredQuestionCount !== attempts.length) return false

  const isExactSnapshot = attempts.length === snapshotIds.length
    && attempts.every((attempt, index) => attempt.questionId === snapshotIds[index])
  if (reason === "pool_completed") return isExactSnapshot

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
    const freezes = metadata.freezeCount
    if (!Number.isInteger(freezes) || (freezes as number) < 0) return false
    const correct = attempts.filter((attempt) => attempt.isCorrect).length
    const wrong = attempts.length - correct
    const expectedDuration = Math.max(0,
      TIME_ATTACK_START_SECONDS
      + correct * TIME_ATTACK_CORRECT_EXTENSION_SECONDS
      - wrong * TIME_ATTACK_WRONG_PENALTY_SECONDS
      + (freezes as number) * FREEZE_EXTENSION_SECONDS) * 1000
    return Math.abs((finishedAt - startedAt) - expectedDuration) <= TIMEOUT_CLOCK_TOLERANCE_MS
  }
  if (mode === "double" && reason === "bank_depleted") {
    if (!Array.isArray(metadata.wagerHistory) || metadata.wagerHistory.length !== attempts.length) return false
    let bank = DOUBLE_STARTING_BANK
    for (let index = 0; index < attempts.length; index++) {
      const wager = metadata.wagerHistory[index]
      const permitted = DOUBLE_WAGER_RATIOS.map((ratio) => Math.max(10, Math.floor(bank * ratio)))
      if (!Number.isInteger(wager) || !permitted.includes(wager as number)) return false
      bank = attempts[index].isCorrect ? bank + (wager as number) : Math.max(0, bank - (wager as number))
      if (bank === 0 && index !== attempts.length - 1) return false
    }
    return bank === 0
  }
  return false
}
