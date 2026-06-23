"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react"
import { questionsDatabase } from "@/lib/questions-database"
import type { Question } from "@/lib/types"

// Invalidate the local cache so modules.ts picks up fresh questions
import { saveActiveQuestions } from "@/lib/custom-questions"

const POLL_INTERVAL = 30_000 // 30 s

interface QuestionsContextValue {
  questions: Question[]
  lastUpdated: Date | null
  isLoading: boolean
  addQuestion: (q: Question) => Promise<void>
  updateQuestion: (q: Question) => Promise<void>
  deleteQuestion: (id: string) => Promise<void>
  deleteQuestionsBySubject: (subject: string) => Promise<void>
  deleteModule: (subject: string) => Promise<void>
  deleteAllQuestions: () => Promise<void>
  resetToDefault: () => Promise<void>
  saveToDb: (qs: Question[], token: string) => Promise<boolean>
}

const QuestionsContext = createContext<QuestionsContextValue | undefined>(undefined)

/** Fetch questions from DB. Returns null if none saved yet. */
async function fetchFromDb(): Promise<{ questions: Question[] | null; updatedAt: string | null }> {
  try {
    const res = await fetch("/api/questions", { cache: "no-store" })
    if (!res.ok) return { questions: null, updatedAt: null }
    const data = await res.json()
    return { questions: data.questions, updatedAt: data.updatedAt }
  } catch {
    return { questions: null, updatedAt: null }
  }
}

async function pushToDb(questions: Question[], token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/questions", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ questions }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function QuestionsProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>([...questionsDatabase])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const questionsRef = useRef(questions)
  questionsRef.current = questions

  // Sync to custom-questions cache so modules.ts picks up changes
  function persist(qs: Question[]) {
    saveActiveQuestions(qs)
    setQuestions([...qs])
    questionsRef.current = qs
  }

  // Initial load + polling
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null

    async function load() {
      const { questions: dbQuestions, updatedAt } = await fetchFromDb()
      if (dbQuestions !== null) {
        persist(dbQuestions)
        if (updatedAt) setLastUpdated(new Date(updatedAt))
      }
      setIsLoading(false)
    }

    async function poll() {
      const { questions: dbQuestions, updatedAt } = await fetchFromDb()
      if (dbQuestions === null) return
      const dbUpdated = updatedAt ? new Date(updatedAt).getTime() : 0
      const localUpdated = lastUpdated?.getTime() ?? 0
      if (dbUpdated > localUpdated) {
        persist(dbQuestions)
        setLastUpdated(new Date(updatedAt!))
      }
    }

    load().then(() => {
      pollTimer = setInterval(poll, POLL_INTERVAL)
    })

    return () => { if (pollTimer) clearInterval(pollTimer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveToDb = useCallback(async (qs: Question[], token: string) => {
    const ok = await pushToDb(qs, token)
    if (ok) setLastUpdated(new Date())
    return ok
  }, [])

  // ── Mutation helpers (update local state; caller must push to DB if admin) ──

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
        addQuestion,
        updateQuestion,
        deleteQuestion,
        deleteQuestionsBySubject,
        deleteModule,
        deleteAllQuestions,
        resetToDefault,
        saveToDb,
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
