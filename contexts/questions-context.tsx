"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type MutableRefObject,
} from "react"
import { questionsDatabase } from "@/lib/questions-database"
import type { Question } from "@/lib/types"
import {
  saveQuestionChunks,
  type QuestionSaveProgress,
  type QuestionSaveResult,
} from "@/lib/question-save-chunks"

// Invalidate the local cache so modules.ts picks up fresh questions
import { saveActiveQuestions } from "@/lib/custom-questions"

const PAGE_SIZE = 50
export type QuestionSetFilter = { module?: string | null; discipline?: string | null }

function storedAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return {}
  const session = localStorage.getItem("mednexus-user-token")
  const guest = localStorage.getItem("mednexus-guest-token")
  return session ? { "x-session-token": session } : guest ? { "x-guest-token": guest } : {}
}

interface QuestionsContextValue {
  questions: Question[]
  lastUpdated: Date | null
  isLoading: boolean
  questionCount: number | null
  loadQuestionSet: (filter?: QuestionSetFilter) => Promise<Question[]>
  addQuestion: (q: Question) => Promise<void>
  updateQuestion: (q: Question) => Promise<void>
  deleteQuestion: (id: string) => Promise<void>
  deleteQuestionsBySubject: (subject: string) => Promise<void>
  deleteModule: (subject: string) => Promise<void>
  deleteAllQuestions: () => Promise<void>
  resetToDefault: () => Promise<void>
  saveToDb: (qs: Question[]) => Promise<boolean>
  appendQuestions: (qs: Question[]) => Promise<boolean>
  appendQuestionsInChunks: (
    qs: Question[],
    onProgress?: (progress: QuestionSaveProgress) => void,
  ) => Promise<QuestionSaveResult>
  /**
   * Ref flag consumers (e.g. the admin editor's own auto-save effect) can
   * check to know the most recent `questions` state change was already
   * persisted by this context (via appendQuestions or a remote poll), so
   * they should skip re-saving the full bank themselves.
   */
  suppressNextAutoSave: MutableRefObject<boolean>
}

const QuestionsContext = createContext<QuestionsContextValue | undefined>(undefined)

/** Fetch questions from the authenticated runtime API. Null means unavailable. */
async function fetchFromDb(filter: QuestionSetFilter = {}): Promise<{ questions: Question[] | null; updatedAt: string | null }> {
  try {
    const params = new URLSearchParams({ view: "runtime", page: "1", pageSize: String(PAGE_SIZE) })
    if (filter.module) params.set("module", filter.module)
    if (filter.discipline) params.set("discipline", filter.discipline)
    const firstResponse = await fetch(
      `/api/questions?${params}`,
      { cache: "no-store", headers: storedAuthHeaders() },
    )
    if (!firstResponse.ok) return { questions: null, updatedAt: null }
    const first = await firstResponse.json()
    const questions: Question[] = Array.isArray(first.questions) ? first.questions : []
    const pages = Math.max(1, Number(first.pagination?.pages ?? 1))
    for (let page = 2; page <= pages; page++) {
      params.set("page", String(page))
      const response = await fetch(`/api/questions?${params}`, { cache: "no-store", headers: storedAuthHeaders() })
      if (!response.ok) return { questions: null, updatedAt: null }
      const data = await response.json()
      if (Array.isArray(data.questions)) questions.push(...data.questions)
    }
    return { questions, updatedAt: first.updatedAt ?? null }
  } catch {
    return { questions: null, updatedAt: null }
  }
}

async function pushToDb(questions: Question[]): Promise<boolean> {
  try {
    const res = await fetch("/api/questions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Appends only the given (new) questions to the DB-backed bank, instead of
 * re-sending the entire existing bank. Postgres merges them into the JSONB
 * array server-side. This keeps bulk operations (e.g. approving a large
 * PDF/Word import) fast and avoids multi-minute PUT requests that can time
 * out through the browser/proxy as the bank grows.
 */
async function appendToDb(questions: Question[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/questions/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    })
    if (res.ok) return { ok: true }

    const body = await res.json().catch(() => null) as { error?: string } | null
    return {
      ok: false,
      error: body?.error || `Save request was rejected (HTTP ${res.status}).`,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The save request could not reach the server.",
    }
  }
}

export function QuestionsProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  const questionsRef = useRef(questions)
  questionsRef.current = questions
  const suppressNextAutoSave = useRef(false)

  // Sync to custom-questions cache so modules.ts picks up changes.
  // `alreadySaved` marks state changes this context has already persisted
  // to the DB itself (append, remote poll) so downstream consumers with
  // their own full-bank auto-save effects know to skip re-saving.
  function persist(qs: Question[], alreadySaved = false) {
    if (alreadySaved) suppressNextAutoSave.current = true
    saveActiveQuestions(qs)
    setQuestions([...qs])
    questionsRef.current = qs
  }

  // Fetch metadata only at startup. Content is loaded lazily by the workspace
  // that needs it, preventing every route from transferring the entire bank.
  useEffect(() => {
    let cancelled = false
    async function loadMetadata() {
      try {
        const response = await fetch("/api/questions?view=meta")
        if (!response.ok) throw new Error("metadata unavailable")
        const metadata = await response.json() as { count?: number; updatedAt?: string | null }
        if (!cancelled) {
          setQuestionCount(Number(metadata.count ?? 0))
          if (metadata.updatedAt) setLastUpdated(new Date(metadata.updatedAt))
        }
      } catch {
        if (!cancelled) setQuestionCount(questionsDatabase.length)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadMetadata()
    window.addEventListener("mednexus:questions-invalidated", loadMetadata)

    return () => {
      cancelled = true
      window.removeEventListener("mednexus:questions-invalidated", loadMetadata)
    }
  }, [])

  const loadQuestionSet = useCallback(async (filter: QuestionSetFilter = {}) => {
    setIsLoading(true)
    const result = await fetchFromDb(filter)
    // Never substitute bundled demo content for an authentication race,
    // network error, or rejected request. The server remains responsible for
    // selecting its configured database/static source on successful requests.
    const loaded = result.questions ?? questionsRef.current
    if (result.questions !== null) persist(loaded, true)
    if (result.questions !== null && !filter.module && !filter.discipline) setQuestionCount(loaded.length)
    if (result.updatedAt) setLastUpdated(new Date(result.updatedAt))
    setIsLoading(false)
    return loaded
  }, [])

  const saveToDb = useCallback(async (qs: Question[]) => {
    const ok = await pushToDb(qs)
    if (ok) setLastUpdated(new Date())
    return ok
  }, [])

  /**
   * Appends only newly-created questions to the DB (fast path for bulk
   * imports). Also merges them into local state so the UI is consistent
   * without waiting on the next poll.
   */
  const appendQuestions = useCallback(async (qs: Question[]) => {
    if (qs.length === 0) return true
    const result = await appendToDb(qs)
    if (result.ok) {
      persist([...questionsRef.current, ...qs], true)
      setLastUpdated(new Date())
    }
    return result.ok
  }, [])

  const appendQuestionsInChunks = useCallback(async (
    qs: Question[],
    onProgress?: (progress: QuestionSaveProgress) => void,
  ) => {
    const result = await saveQuestionChunks(qs, async (chunk) => {
      const saved = await appendToDb(chunk)
      if (saved.ok) {
        const existingIds = new Set(questionsRef.current.map((question) => question.id))
        const fresh = chunk.filter((question) => !existingIds.has(question.id))
        if (fresh.length > 0) persist([...questionsRef.current, ...fresh], true)
        setLastUpdated(new Date())
      }
      return saved
    }, onProgress)
    return result
  }, [])

  // ── Mutation helpers (update local state; the editor persists through cookie-authenticated APIs) ──

  const addQuestion = useCallback(async (q: Question) => {
    persist([...questionsRef.current, q])
  }, [])

  const updateQuestion = useCallback(async (q: Question) => {
    persist(questionsRef.current.map((e) => (e.id === q.id ? q : e)))
  }, [])

  const deleteQuestion = useCallback(async (id: string) => {
    persist(questionsRef.current.filter((q) => q.id !== id))
  }, [])

  const deleteQuestionsBySubject = useCallback(async (subject: string) => {
    persist(questionsRef.current.filter((q) => q.subject !== subject))
  }, [])

  const deleteModule = useCallback(async (subject: string) => {
    persist(questionsRef.current.filter((q) => q.subject !== subject))
  }, [])

  const deleteAllQuestions = useCallback(async () => {
    persist([])
  }, [])

  const resetToDefault = useCallback(async () => {
    persist([...questionsDatabase])
  }, [])

  return (
    <QuestionsContext.Provider
      value={{
        questions,
        lastUpdated,
        isLoading,
        questionCount,
        loadQuestionSet,
        addQuestion,
        updateQuestion,
        deleteQuestion,
        deleteQuestionsBySubject,
        deleteModule,
        deleteAllQuestions,
        resetToDefault,
        saveToDb,
        appendQuestions,
        appendQuestionsInChunks,
        suppressNextAutoSave,
      }}
    >
      {children}
    </QuestionsContext.Provider>
  )
}

export function useQuestions() {
  const ctx = useContext(QuestionsContext)
  if (!ctx) throw new Error("useQuestions must be used within QuestionsProvider")
  return ctx
}
