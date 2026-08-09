"use client"

export type StudyHubId = "mcq-qbank" | "theory-vault" | "osce-hub"

export const STUDY_HUBS: ReadonlyArray<{
  id: StudyHubId
  name: string
  description: string
  available: boolean
}> = [
  { id: "mcq-qbank", name: "MCQ Q-Bank", description: "Questions, practice and exams", available: true },
  { id: "theory-vault", name: "Theory Vault", description: "Core notes and revision guides", available: true },
  { id: "osce-hub", name: "OSCE Hub", description: "Clinical stations and feedback", available: false },
]

export function getStudyHubMenuOptions(activeHub: StudyHubId) {
  return STUDY_HUBS.filter((hub) => hub.id !== activeHub)
}
