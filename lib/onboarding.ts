export const TUTORIAL_VERSION = 1 as const
export const TUTORIAL_IDS = ["mcq_qbank_intro", "theory_vault_intro"] as const
export type TutorialId = typeof TUTORIAL_IDS[number]
export type TutorialStatus = "not_started" | "in_progress" | "completed" | "dismissed"

export interface OnboardingRecord {
  tutorialId: TutorialId
  tutorialVersion: number
  status: TutorialStatus
  currentStep: number
  startedAt: string | null
  completedAt: string | null
  dismissedAt: string | null
  updatedAt: string | null
}

export const emptyOnboardingRecord = (tutorialId: TutorialId): OnboardingRecord => ({
  tutorialId, tutorialVersion: TUTORIAL_VERSION, status: "not_started", currentStep: 0,
  startedAt: null, completedAt: null, dismissedAt: null, updatedAt: null,
})
