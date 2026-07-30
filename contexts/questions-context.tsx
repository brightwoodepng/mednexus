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
import { useApp } from "@/contexts/app-context"
import type { Question } from "@/lib/types"
import {
  saveQuestionChunks,
  type QuestionSaveProgress,
  type QuestionSaveResult,
} from "@/lib/question-save-chunks"

// Invalidate the local cache so modules.ts picks up fresh questions
import { saveActiveQuestions } from "@/lib/custom-questions"

const QUESTION_PAGE_SIZE = 100
const PAGE_CONCURRENCY = 4
export type QuestionSetFilter = { module?: string | null; discipline?: string | null }
export type QuestionCatalogModule = { name: string; count: number; disciplines: Array<{ name: string; count: number }> }

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
  catalog: QuestionCatalogModule[]
  catalogLoading: boolean
  catalogError: string | null
  reloadCatalog: () => Promise<void>
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

type RequestTiming = { authenticationMs?: number; databaseQueryMs?: number }

async function readTimedJson<T>(response: Response, request: string, requestStartedAt: number): Promise<T> {
  const headersReceivedAt = performance.now()
  const serverTiming = response.headers.get("Server-Timing") ?? ""
  const timing: RequestTiming = {}
  for (const entry of serverTiming.split(",")) {
    const [name, ...parameters] = entry.trim().split(";")
    const duration = parameters.find(parameter => parameter.startsWith("dur="))?.slice(4)
    if (name === "auth" && duration) timing.authenticationMs = Number(duration)
    if (name === "database" && duration) timing.databaseQueryMs = Number(duration)
  }
  const body = await response.text()
  const bodyReceivedAt = performance.now()
  const data = JSON.parse(body) as T
  const processedAt = performance.now()
  console.info("[questions-request-timing]", {
    request,
    authenticationMs: timing.authenticationMs,
    databaseQueryMs: timing.databaseQueryMs,
    networkTransferMs: Math.max(0, bodyReceivedAt - requestStartedAt
      - (timing.authenticationMs ?? 0) - (timing.databaseQueryMs ?? 0)),
    bodyDownloadMs: bodyReceivedAt - headersReceivedAt,
    clientProcessingMs: processedAt - bodyReceivedAt,
    totalClientMs: processedAt - requestStartedAt,
    responseBytes: new TextEncoder().encode(body).byteLength,
  })
  return data
}

/** Fetch a filtered set, or the intentionally requested full bank, in bounded concurrent pages. */
async function fetchFromDb(
  filter: QuestionSetFilter,
  signal: AbortSignal,
): Promise<{ questions: Question[] | null; updatedAt: string | null }> {
  try {
    const params = new URLSearchParams({ view: "runtime", page: "1", pageSize: String(QUESTION_PAGE_SIZE) })
    if (filter.module) params.set("module", filter.module)
    if (filter.discipline) params.set("discipline", filter.discipline)
    const firstStartedAt = performance.now()
    const firstResponse = await fetch(
      `/api/questions?${params}`,
      { cache: "no-store", headers: storedAuthHeaders(), signal },
    )
    if (!firstResponse.ok) return { questions: null, updatedAt: null }
    const first = await readTimedJson<{ questions?: Question[]; updatedAt?: string | null; pagination?: { pages?: number } }>(
      firstResponse,
      filter.module ? "module-questions:first-page" : "full-bank:first-page",
      firstStartedAt,
    )
    const pageResults: Question[][] = [Array.isArray(first.questions) ? first.questions : []]
    const pages = Math.max(1, Number(first.pagination?.pages ?? 1))
    let nextPage = 2
    async function worker() {
      while (nextPage <= pages) {
        const page = nextPage++
        const pageParams = new URLSearchParams(params)
        pageParams.set("page", String(page))
        const startedAt = performance.now()
        const response = await fetch(`/api/questions?${pageParams}`, {
          cache: "no-store",
          headers: storedAuthHeaders(),
          signal,
        })
        if (!response.ok) throw new Error(`Question page ${page} unavailable`)
        const data = await readTimedJson<{ questions?: Question[] }>(
          response,
          filter.module ? "module-questions:page" : "full-bank:page",
          startedAt,
        )
        pageResults[page - 1] = Array.isArray(data.questions) ? data.questions : []
      }
    }
    await Promise.all(Array.from({ length: Math.min(PAGE_CONCURRENCY, pages - 1) }, () => worker()))
    return { questions: pageResults.flat(), updatedAt: first.updatedAt ?? null }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
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
  const { user, authReady } = useApp()
  const userId = user?.uid
  const [questions, setQuestions] = useState<Question[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  const [catalog, setCatalog] = useState<QuestionCatalogModule[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const questionSetCache = useRef(new Map<string, Question[]>())
  const questionsRef = useRef(questions)
  questionsRef.current = questions
  const suppressNextAutoSave = useRef(false)
  const catalogRequest = useRef<AbortController | null>(null)
  const questionSetRequest = useRef<AbortController | null>(null)
  const questionSetLoadId = useRef(0)

  useEffect(() => () => {
    catalogRequest.current?.abort()
    questionSetRequest.current?.abort()
  }, [])

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

  const reloadCatalog = useCallback(async () => {
    catalogRequest.current?.abort()
    const controller = new AbortController()
    catalogRequest.current = controller
    setCatalogLoading(true)
    setCatalogError(null)
    try {
      const startedAt = performance.now()
      const response = await fetch("/api/questions?view=catalog", {
        cache: "no-store",
        headers: storedAuthHeaders(),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(response.status === 401 ? "Authentication expired" : "Catalog unavailable")
      const data = await readTimedJson<{ modules?: QuestionCatalogModule[] }>(response, "catalog", startedAt)
      const modules = Array.isArray(data.modules) ? data.modules : []
      setCatalog(modules)
      setQuestionCount(modules.reduce((sum, module) => sum + module.count, 0))
    } catch (error) {
      if (controller.signal.aborted) return
      setCatalogError(error instanceof Error ? error.message : "Catalog unavailable")
    } finally {
      if (catalogRequest.current === controller) {
        catalogRequest.current = null
        setCatalogLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!authReady || !userId) {
      if (authReady) setCatalog([])
      return
    }
    void reloadCatalog()
  }, [authReady, reloadCatalog, userId])

  const loadQuestionSet = useCallback(async (filter: QuestionSetFilter = {}) => {
    questionSetRequest.current?.abort()
    const loadId = ++questionSetLoadId.current
    const cacheKey = filter.module ? `${filter.module}\u0000${filter.discipline ?? "*"}` : null
    if (cacheKey && questionSetCache.current.has(cacheKey)) {
      setIsLoading(false)
      return questionSetCache.current.get(cacheKey)!
    }
    const cachedModule = filter.module ? questionSetCache.current.get(`${filter.module}\u0000*`) : undefined
    if (cachedModule && filter.discipline) {
      const subset = cachedModule.filter((question) => question.subject === filter.discipline)
      questionSetCache.current.set(cacheKey!, subset)
      persist(subset, true)
      setIsLoading(false)
      return subset
    }
    const controller = new AbortController()
    questionSetRequest.current = controller
    setIsLoading(true)
    let result: Awaited<ReturnType<typeof fetchFromDb>>
    try {
      result = await fetchFromDb(filter, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) return questionsRef.current
      throw error
    }
    if (loadId !== questionSetLoadId.current || controller.signal.aborted) return questionsRef.current
    // Never substitute bundled demo content for an authentication race,
    // network error, or rejected request. The server remains responsible for
    // selecting its configured database/static source on successful requests.
    const loaded = result.questions ?? questionsRef.current
    if (result.questions !== null) persist(loaded, true)
    if (result.questions !== null && cacheKey) questionSetCache.current.set(cacheKey, loaded)
    if (result.questions !== null && !filter.module && !filter.discipline) setQuestionCount(loaded.length)
    if (result.updatedAt) setLastUpdated(new Date(result.updatedAt))
    setIsLoading(false)
    if (questionSetRequest.current === controller) questionSetRequest.current = null
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
        catalog,
        catalogLoading,
        catalogError,
        reloadCatalog,
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
