import type { TutorialId } from "@/lib/onboarding"

export type TutorialStep = {
  id: string; title: string; body: string; targetAnchorId: string; preferredPlacement: "top" | "bottom" | "left" | "right" | "center"
  desktopPresentation: "coachmark" | "card"; mobilePresentation: "sheet"; navigationAction?: string; completionRequirement?: string
}
export type TutorialDefinition = { id: TutorialId; name: string; finishLabel: string; steps: TutorialStep[] }

export const tutorials: Record<TutorialId, TutorialDefinition> = {
  mcq_qbank_intro: { id: "mcq_qbank_intro", name: "MCQ Q-Bank", finishLabel: "Start practicing", steps: [
    { id: "mcq-home", title: "Your MCQ home", body: "Practice questions, take exams, review weak areas, and earn Nexus Points through verified MCQ activity.", targetAnchorId: "mcq-home", preferredPlacement: "bottom", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
    { id: "trial-exam", title: "Trial and Exam modes", body: "Trial gives immediate feedback and learning support. Exam waits until completion to show results. Both can contribute to verified NP earnings.", targetAnchorId: "mcq-mode", preferredPlacement: "bottom", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
    { id: "modules", title: "Modules and disciplines", body: "Choose a module, study all of it or one discipline, then select how many questions to begin.", targetAnchorId: "mcq-modules", preferredPlacement: "top", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
    { id: "games", title: "Games", body: "Solo games use MCQs with different mechanics. Multiplayer rooms use a PIN. Eligible results earn NP subject to economy limits.", targetAnchorId: "mcq-games", preferredPlacement: "top", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
    { id: "progress", title: "Progress and weak areas", body: "Incorrect answers feed focused revision. History identifies weak disciplines, while repeat limits prevent unlimited NP farming.", targetAnchorId: "mcq-progress", preferredPlacement: "right", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
    { id: "points", title: "Nexus Points and store", body: "Earn NP through supported MCQ activity and spend it on supplies or cosmetics. Spending NP never erases lifetime progression.", targetAnchorId: "mcq-store", preferredPlacement: "right", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
  ]},
  theory_vault_intro: { id: "theory_vault_intro", name: "Theory Vault", finishLabel: "Explore Theory Vault", steps: [
    { id: "theory-home", title: "Theory Vault home", body: "Browse structured theory questions, draft answers, compare key points, and build a revision queue.", targetAnchorId: "theory-home", preferredPlacement: "bottom", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
    { id: "hierarchy", title: "Browse hierarchy", body: "Browse from module to discipline, set, and finally question.", targetAnchorId: "theory-browse", preferredPlacement: "bottom", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
    { id: "study", title: "Study interface", body: "Read the prompt, write or dictate an answer, reveal the structured answer, and compare key and critical points. This tour never edits your work.", targetAnchorId: "theory-study-demo", preferredPlacement: "center", desktopPresentation: "card", mobilePresentation: "sheet", navigationAction: "Open a question only with your consent" },
    { id: "rating", title: "Self-assessment", body: "Confidence choices help schedule when a question should return for revision.", targetAnchorId: "theory-rating-demo", preferredPlacement: "center", desktopPresentation: "card", mobilePresentation: "sheet" },
    { id: "saved", title: "Bookmarks and notes", body: "Bookmarks and My Notes keep saved questions and your notes available for later review.", targetAnchorId: "theory-saved", preferredPlacement: "right", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
    { id: "revision-search", title: "Revision and search", body: "Weak or deferred questions enter revision. Search finds topics across the Vault, and export is available where supported.", targetAnchorId: "theory-search", preferredPlacement: "bottom", desktopPresentation: "coachmark", mobilePresentation: "sheet" },
  ]},
}
