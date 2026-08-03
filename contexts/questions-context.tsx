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

const QUESTION_PAGE_SIZE = 25
const PAGE_CONCURRENCY = 4
const CATALOG_CACHE_KEY = "mednexus-question-catalog:v1"
export type QuestionSetFilter = { module?: string | null; discipline?: string | null; topic?: string | null }
export type QuestionCatalogModule = { name: string; count: number; disciplines: Array<{ name: string; count: number; topics: Array<{ name: string; count: number }> }> }
export type GameQuestionBatch = { questions: Question[]; total: number }

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
  gameCatalog: QuestionCatalogModule[]
  gameCatalogLoading: boolean
  reloadCatalog: () => Promise<void>
  reloadGameCatalog: () => Promise<void>
  loadQuestionSet: (filter: QuestionSetFilter) => Promise<Question[]>
  /** Administrative editor/export/bulk allowlist only. */
  loadFullQuestionBank: () => Promise<Question[]>
  loadGameQuestionPool: (filter: QuestionSetFilter, quantity: number) => Promise<GameQuestionBatch>
  loadQuestionsByIds: (questionIds: string[], gameOnly?: boolean) => Promise<Question[]>
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
    if (filter.topic) params.set("topic", filter.topic)
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

async function reconcileWithDb(previous: Question[], questions: Question[]): Promise<boolean> {
  try {
    const previousById = new Map(previous.map(question => [question.id, question]))
    const nextIds = new Set(questions.map(question => question.id))
    const upserts = questions.filter(question => {
      const before = previousById.get(question.id)
      return !before || JSON.stringify(before) !== JSON.stringify(question)
    })
    const deletedIds = previous.filter(question => !nextIds.has(question.id)).map(question => question.id)
    if (!upserts.length && !deletedIds.length) return true
    const res = await fetch("/api/admin/mcq/questions/reconcile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...storedAuthHeaders() },
      body: JSON.stringify({ upserts, deletedIds }),
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
  const [isLoading, setIsLoading] = useState(false)
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  const [catalog, setCatalog] = useState<QuestionCatalogModule[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [gameCatalog, setGameCatalog] = useState<QuestionCatalogModule[]>([])
  const [gameCatalogLoading, setGameCatalogLoading] = useState(false)
  const questionSetCache = useRef(new Map<string, Question[]>())
  const questionsRef = useRef(questions)
  questionsRef.current = questions
  const persistedQuestionsRef = useRef<Question[]>([])
  const suppressNextAutoSave = useRef(false)
  const catalogRequest = useRef<AbortController | null>(null)
  const questionSetRequest = useRef<AbortController | null>(null)
  const questionSetLoadId = useRef(0)
  const catalogLoadId = useRef(0)
  const sessionOwner = useRef<string | undefined>(undefined)

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
    if (alreadySaved) persistedQuestionsRef.current = [...qs]
    saveActiveQuestions(qs)
    setQuestions([...qs])
    questionsRef.current = qs
  }

  const reloadCatalog = useCallback(async () => {
    catalogRequest.current?.abort()
    const loadId = ++catalogLoadId.current
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
      const data = await readTimedJson<{ modules?: QuestionCatalogModule[]; totalCount?: number; updatedAt?: string | null }>(response, "catalog", startedAt)
      if (controller.signal.aborted || loadId !== catalogLoadId.current) return
      const modules = Array.isArray(data.modules) ? data.modules : []
      const totalCount = Number(data.totalCount ?? modules.reduce((sum, module) => sum + module.count, 0))
      setCatalog(modules)
      setQuestionCount(totalCount)
      setLastUpdated(data.updatedAt ? new Date(data.updatedAt) : null)
      try {
        localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ modules, totalCount, updatedAt: data.updatedAt ?? null }))
      } catch {
        // Storage can be unavailable in private browsing; the live response still works.
      }
    } catch (error) {
      if (controller.signal.aborted) return
      setCatalogError(error instanceof Error ? error.message : "Catalog unavailable")
    } finally {
      if (catalogRequest.current === controller && loadId === catalogLoadId.current) {
        catalogRequest.current = null
        setCatalogLoading(false)
      }
    }
  }, [])

  const reloadGameCatalog = useCallback(async () => {
    setGameCatalogLoading(true)
    try {
      const startedAt = performance.now()
      const response = await fetch("/api/questions?view=game-catalog", {
        cache: "no-store",
        headers: storedAuthHeaders(),
      })
      if (!response.ok) throw new Error("Game catalog unavailable")
      const data = await readTimedJson<{ modules?: QuestionCatalogModule[] }>(
        response,
        "game-catalog",
        startedAt,
      )
      setGameCatalog(Array.isArray(data.modules) ? data.modules : [])
    } catch {
      setGameCatalog([])
    } finally {
      setGameCatalogLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionOwner.current !== userId) {
      sessionOwner.current = userId
      catalogRequest.current?.abort()
      questionSetRequest.current?.abort()
      catalogLoadId.current++
      questionSetLoadId.current++
      questionSetCache.current.clear()
      questionsRef.current = []
      persistedQuestionsRef.current = []
      setQuestions([])
      setCatalog([])
      setGameCatalog([])
      setQuestionCount(null)
      setLastUpdated(null)
      setCatalogError(null)
      setIsLoading(false)
      setCatalogLoading(false)
      setGameCatalogLoading(false)
    }
    if (!authReady || !userId) {
      return
    }
    try {
      const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) ?? "null") as {
        modules?: QuestionCatalogModule[]
        totalCount?: number
        updatedAt?: string | null
      } | null
      if (cached && Array.isArray(cached.modules) && cached.modules.length > 0) {
        setCatalog(cached.modules)
        setQuestionCount(Number(cached.totalCount ?? cached.modules.reduce((sum, module) => sum + module.count, 0)))
        setLastUpdated(cached.updatedAt ? new Date(cached.updatedAt) : null)
      }
    } catch {
      localStorage.removeItem(CATALOG_CACHE_KEY)
    }
    void reloadCatalog()
  }, [authReady, reloadCatalog, userId])

  const loadQuestionSet = useCallback(async (filter: QuestionSetFilter) => {
    questionSetRequest.current?.abort()
    const loadId = ++questionSetLoadId.current
    const owner = userId
    const cacheKey = filter.module ? `${owner}\u0000${filter.module}\u0000${filter.discipline ?? "*"}\u0000${filter.topic ?? "*"}` : null
    if (cacheKey && questionSetCache.current.has(cacheKey)) {
      setIsLoading(false)
      return questionSetCache.current.get(cacheKey)!
    }
    const cachedModule = filter.module ? questionSetCache.current.get(`${owner}\u0000${filter.module}\u0000*\u0000*`) : undefined
    if (cachedModule && filter.discipline) {
      const subset = cachedModule.filter((question) => question.subject === filter.discipline
        && (!filter.topic || (question as Question & { topic?: string }).topic === filter.topic || question.tags?.[0] === filter.topic))
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
    if (loadId !== questionSetLoadId.current || controller.signal.aborted || sessionOwner.current !== owner) return questionsRef.current
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
  }, [userId])

  const loadFullQuestionBank = useCallback(() => loadQuestionSet({}), [loadQuestionSet])

  const loadGameQuestionPool = useCallback(async (filter: QuestionSetFilter, quantity: number) => {
    const controller = new AbortController()
    const owner = userId
    const params = new URLSearchParams({
      view: "game",
      quantity: String(Math.max(1, quantity)),
    })
    if (filter.module) params.set("module", filter.module)
    if (filter.discipline) params.set("discipline", filter.discipline)
    const startedAt = performance.now()
    const response = await fetch(`/api/questions?${params}`, {
      cache: "no-store", headers: storedAuthHeaders(), signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Game question pool unavailable (HTTP ${response.status})`)
    const data = await readTimedJson<{ questions?: Question[]; total?: number }>(response, "game-question-pool", startedAt)
    if (controller.signal.aborted || sessionOwner.current !== owner) return { questions: [], total: 0 }
    const loaded = Array.isArray(data.questions) ? data.questions : []
    return { questions: loaded, total: Number(data.total ?? loaded.length) }
  }, [userId])

  const loadQuestionsByIds = useCallback(async (questionIds: string[], gameOnly = false) => {
    const response = await fetch("/api/questions?view=recover", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...storedAuthHeaders() },
      body: JSON.stringify({ questionIds, gameOnly }),
    })
    if (!response.ok) throw new Error("Saved question pool is unavailable")
    const data = await response.json() as { questions?: Question[] }
    return Array.isArray(data.questions) ? data.questions : []
  }, [])

  const saveToDb = useCallback(async (qs: Question[]) => {
    const ok = await reconcileWithDb(persistedQuestionsRef.current, qs)
    if (ok) {
      persistedQuestionsRef.current = [...qs]
      setLastUpdated(new Date())
    }
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
        gameCatalog,
        gameCatalogLoading,
        reloadCatalog,
        reloadGameCatalog,
        loadQuestionSet,
        loadFullQuestionBank,
        loadGameQuestionPool,
        loadQuestionsByIds,
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
