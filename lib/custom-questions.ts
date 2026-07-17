import { questionsDatabase } from "./questions-database"
import type { Question } from "./types"

const LS_KEY = "mednexus-custom-questions"

let _cache: Question[] | null = null

export function getActiveQuestions(): Question[] {
  if (typeof window === "undefined") return questionsDatabase
  if (_cache !== null) return _cache
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Question[]
      if (Array.isArray(parsed)) {
        _cache = parsed
        return _cache
      }
    }
  } catch {}
  _cache = [...questionsDatabase]
  return _cache
}

export function saveActiveQuestions(questions: Question[]): void {
  // Keep full data (including images) in the in-memory cache so they show
  // immediately within the current session.
  _cache = questions
  try {
    // Strip mediaBase64 before writing to localStorage. Base64 images can be
    // hundreds of KB each; a question bank with several images easily exceeds
    // the 5 MB localStorage quota, causing a silent QuotaExceededError that
    // drops the write entirely. The database is the source of truth for images
    // — they are restored within seconds via the DB poll on page load.
    const slim = questions.map(({ mediaBase64: _img, ...rest }) => rest)
    localStorage.setItem(LS_KEY, JSON.stringify(slim))
  } catch {}
}

export function resetQuestionsToDefault(): void {
  _cache = [...questionsDatabase]
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(_cache))
  } catch {}
}

export function invalidateQuestionsCache(): void {
  _cache = null
}
