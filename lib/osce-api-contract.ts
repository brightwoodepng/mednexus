import type {
  OsceCompetencyProgress,
  OsceStation,
  OsceStationAttempt,
  OsceStationStatus,
} from "@/lib/types"

/**
 * Reserved API boundary for the future OSCE product.
 *
 * These are TypeScript contracts only: no route handlers are registered while
 * OSCE Hub remains Coming Soon. Keeping the boundary here prevents OSCE
 * delivery and authoring concerns from leaking into MCQ or Theory APIs.
 */
export const OSCE_API = {
  stations: "/api/osce/stations",
  station: (stationId: string) => `/api/osce/stations/${stationId}`,
  attempts: (stationId: string) => `/api/osce/stations/${stationId}/attempts`,
  attempt: (attemptId: string) => `/api/osce/attempts/${attemptId}`,
  competencyProgress: "/api/osce/competency-progress",
} as const

export interface OsceStationBrowserQuery {
  specialty?: string
  tag?: string
  competency?: string
}

export interface OsceStationBrowserResponse {
  stations: Array<Pick<OsceStation, "id" | "title" | "specialty" | "tags" | "competencies" | "timingPhases">>
}

/** Admin-only OSCE editor boundary; publication is explicit, never implied. */
export interface CreateOsceStationRequest {
  station: Omit<OsceStation, "id" | "createdAt" | "updatedAt" | "status">
  status?: Extract<OsceStationStatus, "draft" | "review">
}

export interface UpdateOsceStationRequest {
  station: Partial<Omit<OsceStation, "id" | "createdAt" | "updatedAt">>
}

export interface StartOsceAttemptRequest {
  stationId: string
}

export interface CompleteOsceAttemptRequest {
  checklistResponses: OsceStationAttempt["checklistResponses"]
  rubricScores: OsceStationAttempt["rubricScores"]
  selfAssessment: string
  examinerFeedback?: string
}

export interface OsceAttemptHistoryResponse {
  attempts: OsceStationAttempt[]
}

export interface OsceCompetencyProgressResponse {
  progress: OsceCompetencyProgress[]
}
