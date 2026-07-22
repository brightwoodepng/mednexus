/** The single source of truth for MedNexus' top-level study environments. */
import type { StudyMode } from "@/lib/types"

export type StudyHubId = Lowercase<StudyMode>
export type HubAvailability = "available" | "coming-soon"

export interface StudyHub {
  id: StudyHubId
  mode: StudyMode
  title: string
  subtitle: string
  /** A stable icon identifier; renderers may map this to their icon system. */
  icon: "book-open" | "flask" | "stethoscope"
  landingRoute: string
  availability: HubAvailability
  learnerNavigation: readonly { id: string; label: string; route: string }[]
  capabilities: readonly string[]
  profileMetrics: readonly { id: string; label: string; source: string }[]
  adminEditorRoute: string
}

export const STUDY_HUBS = [
  {
    id: "mcq", mode: "MCQ", title: "MCQ Q-Bank", subtitle: "Clinical questions, exams, and performance practice.", icon: "book-open", landingRoute: "/", availability: "available",
    learnerNavigation: [{ id: "dashboard", label: "Dashboard", route: "/" }, { id: "modules", label: "Study Modules", route: "/?screen=modules" }, { id: "weak-areas", label: "Weak Areas", route: "/?screen=weak-areas" }],
    capabilities: ["tutor-mode", "timed-exams", "live-assessments", "gamification"],
    profileMetrics: [{ id: "questions", label: "Questions answered", source: "progress.history" }, { id: "accuracy", label: "Accuracy", source: "progress.history" }],
    adminEditorRoute: "/?screen=question-editor",
  },
  {
    id: "theory", mode: "THEORY", title: "Theory Vault", subtitle: "Long-form questions, model answers, and revision.", icon: "flask", landingRoute: "/theory", availability: "available",
    learnerNavigation: [{ id: "dashboard", label: "Dashboard", route: "/theory" }, { id: "browse", label: "Browse Questions", route: "/theory/browse" }, { id: "bookmarks", label: "Bookmarks", route: "/theory/bookmarks" }, { id: "notes", label: "My Notes", route: "/theory/notes" }, { id: "revision", label: "Revision Queue", route: "/theory/revision-queue" }, { id: "progress", label: "Progress", route: "/theory/progress" }, { id: "search", label: "Search", route: "/theory/search" }],
    capabilities: ["model-answers", "bookmarks", "notes", "spaced-revision"],
    profileMetrics: [{ id: "reviewed", label: "Questions reviewed", source: "theory.progress" }, { id: "revision", label: "Due for revision", source: "theory.revisionQueue" }],
    adminEditorRoute: "/?screen=question-editor&hub=theory",
  },
  {
    id: "osce", mode: "OSCE", title: "OSCE Practice", subtitle: "Clinical station practice is on its way.", icon: "stethoscope", landingRoute: "/osce", availability: "coming-soon",
    learnerNavigation: [], capabilities: ["station-practice"], profileMetrics: [{ id: "stations", label: "Stations completed", source: "osce.progress" }], adminEditorRoute: "/?screen=question-editor&hub=osce",
  },
] as const satisfies readonly StudyHub[]

export const AVAILABLE_STUDY_HUBS = STUDY_HUBS.filter((hub) => hub.availability === "available")
export const getStudyHubByMode = (mode: StudyMode) => STUDY_HUBS.find((hub) => hub.mode === mode)!
export const getStudyHubFromPathname = (pathname: string | null): StudyHub =>
  pathname?.startsWith("/theory") ? getStudyHubByMode("THEORY") : getStudyHubByMode("MCQ")
