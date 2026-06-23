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
  _cache = questions
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(questions))
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
