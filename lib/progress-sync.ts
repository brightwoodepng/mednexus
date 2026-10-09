import type { HistoryEntry, UserProgress, ExamScore } from "@/lib/types"

export type SyncMutation = {
  mutationId?: string
  patch?: Partial<Omit<UserProgress, "history" | "examScores" | "totalAnswered" | "totalCorrect">>
  increments?: { totalAnswered?: number; totalCorrect?: number }
  events?: { history?: HistoryEntry[]; examScores?: ExamScore[] }
  deleteHistory?: { mode: "trial" | "exam"; questionIds: string[] }
}

export function applyPendingMutations(remote: UserProgress, mutations: SyncMutation[]): UserProgress {
  const acknowledged = new Set((remote as UserProgress & { _syncMutationIds?: string[] })._syncMutationIds ?? [])
  return mutations.filter(m => !m.mutationId || !acknowledged.has(m.mutationId)).reduce((current, mutation) => {
    const removed = mutation.deleteHistory ? new Set(mutation.deleteHistory.questionIds) : null
    const addedHistory = mutation.events?.history ?? []
    const addedExams = mutation.events?.examScores ?? []
    const historyIds = new Set(addedHistory.map(item => item.id))
    const examIds = new Set(addedExams.map(item => item.id))
    return {
      ...current,
      ...mutation.patch,
      totalAnswered: current.totalAnswered + (mutation.increments?.totalAnswered ?? 0),
      totalCorrect: current.totalCorrect + (mutation.increments?.totalCorrect ?? 0),
      history: [...addedHistory, ...current.history.filter(item => !historyIds.has(item.id) && (!removed || item.mode !== mutation.deleteHistory?.mode || !removed.has(item.questionId)))],
      examScores: [...addedExams, ...current.examScores.filter(item => !examIds.has(item.id))],
    }
  }, remote)
}
