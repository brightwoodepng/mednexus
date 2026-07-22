import type { StudyMode, TheoryCollectionId } from "@/lib/types"

/** Account-owned data. It is intentionally independent of the active study hub. */
export interface PlatformProfile {
  uid: string
  name: string
  avatarUrl: string | null
  role: "guest" | "learner" | "admin"
  joinedAt: string | null
  notificationAccess: "granted" | "denied" | "default" | "unsupported"
  appearance: { theme: string; glassEnabled: boolean }
}

/** MCQ-only profile data. Do not render this model while another hub is active. */
export interface McqProfileMetrics {
  mode: "MCQ"
  moduleCoverage: number
  disciplineCoverage: number
  attempts: number
  accuracy: number
  weakAreas: number
  streak: number
  assessmentHistory: number
}

export interface TheoryProgressMetric {
  completed: number
  total: number
}

export interface TheoryProfileMetrics {
  mode: "THEORY"
  collections: Record<TheoryCollectionId, TheoryProgressMetric>
  readQuestions: number
  completedQuestions: number
  modelAnswerReviews: number
  bookmarks: number
  notes: number
  revisionsDue: number
  completedRevisions: number
}

export interface TheoryProfileProgress extends TheoryProgressMetric {
  id: string
  title: string
  collectionId: TheoryCollectionId
  disciplineId?: string
}

export interface TheoryProfileActivity {
  questionId: string
  setId: string | null
  activityType: string
  occurredAt: string
  prompt: string
}

/** The small, server-aggregated payload consumed by Theory profile cards. */
export interface TheoryProfileSummary {
  activeMode: Extract<StudyMode, "THEORY">
  metrics: TheoryProfileMetrics
  disciplines: TheoryProfileProgress[]
  sets: TheoryProfileProgress[]
  recentActivity: TheoryProfileActivity[]
}
