"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { getActiveQuestions, saveActiveQuestions, resetQuestionsToDefault } from "@/lib/custom-questions"
import type { Question } from "@/lib/types"

interface QuestionsContextValue {
  questions: Question[]
  addQuestion: (q: Question) => void
  updateQuestion: (q: Question) => void
  deleteQuestion: (id: string) => void
  deleteQuestionsBySubject: (subject: string) => void
  deleteModule: (subject: string) => void
  deleteAllQuestions: () => void
  resetToDefault: () => void
  refresh: () => void
}

const QuestionsContext = createContext<QuestionsContextValue | undefined>(undefined)

export function QuestionsProvider({ children }: { children: ReactNode }) {
  const [questions, setQuestions] = useState<Question[]>(() => getActiveQuestions())

  const persist = useCallback((next: Question[]) => {
    saveActiveQuestions(next)
    setQuestions([...next])
  }, [])

  const addQuestion = useCallback((q: Question) => {
    const next = [...getActiveQuestions(), q]
    persist(next)
  }, [persist])

  const updateQuestion = useCallback((q: Question) => {
    const next = getActiveQuestions().map((existing) => (existing.id === q.id ? q : existing))
    persist(next)
  }, [persist])

  const deleteQuestion = useCallback((id: string) => {
    const next = getActiveQuestions().filter((q) => q.id !== id)
    persist(next)
  }, [persist])

  const deleteQuestionsBySubject = useCallback((subject: string) => {
    const next = getActiveQuestions().filter((q) => q.subject !== subject)
    persist(next)
  }, [persist])

  const deleteModule = useCallback((subject: string) => {
    const next = getActiveQuestions().filter((q) => q.subject !== subject)
    persist(next)
  }, [persist])

  const deleteAllQuestions = useCallback(() => {
    persist([])
  }, [persist])

  const resetToDefault = useCallback(() => {
    resetQuestionsToDefault()
    setQuestions([...getActiveQuestions()])
  }, [])

  const refresh = useCallback(() => {
    setQuestions([...getActiveQuestions()])
  }, [])

  return (
    <QuestionsContext.Provider
      value={{
        questions,
        addQuestion,
        updateQuestion,
        deleteQuestion,
        deleteQuestionsBySubject,
        deleteModule,
        deleteAllQuestions,
        resetToDefault,
        refresh,
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
