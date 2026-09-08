export const ACTIVE_THEORY_QUESTION_KEY = "mednexus:theory:active-question"

export function clearPersistedTheoryQuestion(storage?: Pick<Storage, "removeItem"> | null) {
  const target = storage ?? (typeof window !== "undefined" ? window.sessionStorage : null)
  target?.removeItem(ACTIVE_THEORY_QUESTION_KEY)
}
