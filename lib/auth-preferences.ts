export const REMEMBERED_INDEX_NUMBER_KEY = "mednexus.remembered-index-number.v1"

export function readRememberedIndexNumber() {
  if (typeof window === "undefined") return ""
  try {
    return window.localStorage.getItem(REMEMBERED_INDEX_NUMBER_KEY)?.trim() ?? ""
  } catch {
    return ""
  }
}

export function rememberIndexNumber(indexNumber: unknown) {
  if (typeof window === "undefined" || typeof indexNumber !== "string" || !indexNumber.trim()) return
  try {
    window.localStorage.setItem(REMEMBERED_INDEX_NUMBER_KEY, indexNumber.trim())
  } catch {
    // Authentication must still succeed when storage is unavailable.
  }
}
