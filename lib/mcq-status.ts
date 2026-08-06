import type { ModuleStatus, Question } from "@/lib/types"

export const managedQuestionStatuses = ["draft", "review", "live", "offline", "archived"] as const
export type ManagedQuestionStatus = typeof managedQuestionStatuses[number]

const managedStatusSet = new Set<string>(managedQuestionStatuses)

export function normalizeQuestionStatus(question: Pick<Question, "status" | "moduleStatus">): ManagedQuestionStatus {
  if (question.status && managedStatusSet.has(question.status)) return question.status as ManagedQuestionStatus
  if (question.moduleStatus === "draft") return "draft"
  if (question.moduleStatus === "offline") return "offline"
  return "live"
}

export function compatibleModuleStatus(status: ManagedQuestionStatus): ModuleStatus {
  if (status === "live") return "live"
  if (status === "offline" || status === "archived") return "offline"
  return "draft"
}

export function applyQuestionStatus(question: Question, status: ManagedQuestionStatus, updatedAt = new Date().toISOString()): Question {
  return { ...question, status, moduleStatus: compatibleModuleStatus(status), updatedAt }
}

export function normalizeCategory(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
