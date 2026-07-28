import type { TutorialId } from "@/lib/onboarding"
import { STUDY_HUB_NAVIGATION } from "@/components/navigation/study-hub-navigation"

export type TutorialNavigationAction =
  | { type: "open-mobile-drawer" } | { type: "close-mobile-drawer" }
  | { type: "open-workspace-switcher" } | { type: "close-workspace-switcher" }
  | { type: "open-account-menu" } | { type: "close-account-menu" }
  | { type: "open-appearance" } | { type: "close-appearance" }
  | { type: "navigate-preview"; anchorId: string }
  | { type: "none" }

export type TutorialStep = {
  id: string
  title: string
  body: string
  desktopTargetAnchorId?: string
  mobileTargetAnchorId?: string
  mobileDrawerTargetAnchorId?: string
  preferredPlacement: "top" | "bottom" | "left" | "right" | "center"
  desktopPresentation: "coachmark" | "card"
  mobilePresentation: "sheet"
  navigationAction?: TutorialNavigationAction
  restoreUiAfterStep?: boolean
  interaction?: { type: "try-it"; expectedAction: "open-mobile-drawer" | "open-workspace-switcher" }
}
export type TutorialDefinition = { id: TutorialId; name: string; finishLabel: string; steps: TutorialStep[] }

const nav = (hub: "mcq-qbank" | "theory-vault", id: string) => STUDY_HUB_NAVIGATION[hub].find(item => item.id === id)!
const destination = (hub: "mcq-qbank" | "theory-vault", id: string, body: string, drawer = false): TutorialStep => {
  const item = nav(hub, id)
  return { id: `${hub}-${id}`, title: item.label, body, desktopTargetAnchorId: `desktop-nav-${id}`, mobileTargetAnchorId: item.bottomNav ? `mobile-bottom-nav-${id}` : undefined, mobileDrawerTargetAnchorId: drawer ? `drawer-nav-${id}` : undefined, preferredPlacement: "right", desktopPresentation: "coachmark", mobilePresentation: "sheet", navigationAction: drawer ? { type: "open-mobile-drawer" } : { type: "none" }, restoreUiAfterStep: drawer }
}
const shared = (hub: string): TutorialStep[] => [
  { id: `${hub}-workspace`, title: "Switch study workspaces", body: "Move between MCQ Q-Bank and Theory Vault here. Each workspace keeps its own tutorial progress, so switching never completes the other tour.", desktopTargetAnchorId: "desktop-workspace-switcher", mobileTargetAnchorId: "mobile-menu-button", preferredPlacement: "right", desktopPresentation: "coachmark", mobilePresentation: "sheet", navigationAction: { type: "open-workspace-switcher" }, restoreUiAfterStep: true },
  { id: `${hub}-primary-nav`, title: "Your primary navigation", body: "On desktop, the sidebar holds every destination. On your phone, the four most useful destinations stay within thumb reach in the bottom bar.", desktopTargetAnchorId: "desktop-navigation", mobileTargetAnchorId: "mobile-bottom-navigation", preferredPlacement: "right", desktopPresentation: "coachmark", mobilePresentation: "sheet", navigationAction: { type: "none" } },
  { id: `${hub}-more`, title: "More destinations", body: "The menu opens the full navigation drawer. Destinations not shown in the four-tab bar remain available here.", desktopTargetAnchorId: "desktop-navigation", mobileTargetAnchorId: "mobile-menu-button", mobileDrawerTargetAnchorId: "drawer-navigation", preferredPlacement: "right", desktopPresentation: "coachmark", mobilePresentation: "sheet", interaction: { type: "try-it", expectedAction: "open-mobile-drawer" }, restoreUiAfterStep: true },
  { id: `${hub}-profile`, title: "Profile and notifications", body: "Notifications are in the header. Your account menu contains profile settings and sign out. The tour only explains sign out—it will never activate it.", desktopTargetAnchorId: "header-account-menu", mobileTargetAnchorId: "header-account-menu", preferredPlacement: "bottom", desktopPresentation: "coachmark", mobilePresentation: "sheet", navigationAction: { type: "open-account-menu" }, restoreUiAfterStep: true },
  { id: `${hub}-appearance`, title: "Appearance and themes", body: "Preview a comfortable theme or Liquid Glass. Opening this panel does not save a new choice automatically; pausing or dismissing restores the appearance you started with.", desktopTargetAnchorId: "header-appearance", mobileTargetAnchorId: "mobile-menu-button", mobileDrawerTargetAnchorId: "drawer-appearance", preferredPlacement: "bottom", desktopPresentation: "coachmark", mobilePresentation: "sheet", navigationAction: { type: "open-appearance" }, restoreUiAfterStep: true },
]

export const tutorials: Record<TutorialId, TutorialDefinition> = {
  mcq_qbank_intro: { id: "mcq_qbank_intro", name: "MCQ Q-Bank", finishLabel: "Start practicing", steps: [
    ...shared("mcq"),
    destination("mcq-qbank", "dashboard", "See your overview, current activity, recent results, and the next useful place to study."),
    destination("mcq-qbank", "modules", "Choose a module, discipline, and question count, then choose Trial for guided feedback or Exam for results at the end."),
    destination("mcq-qbank", "game", "Play safe solo MCQ games or join a multiplayer room. This tour never starts a game."),
    destination("mcq-qbank", "leaderboard", "Follow seasonal ranking and the rank points earned from eligible activity."),
    destination("mcq-qbank", "weak-areas", "Incorrect MCQs identify weak disciplines and create focused revision opportunities.", true),
    destination("mcq-qbank", "live-assessments", "Join scheduled assessments here when you intend to. The tutorial never joins or starts one.", true),
    destination("mcq-qbank", "store", "Check your NP balance and browse supplies and cosmetics. The tour never makes a purchase.", true),
  ]},
  theory_vault_intro: { id: "theory_vault_intro", name: "Theory Vault", finishLabel: "Explore Theory Vault", steps: [
    ...shared("theory"),
    destination("theory-vault", "theory-dashboard", "See a Theory-specific overview and your recent study activity."),
    destination("theory-vault", "theory-browse", "Browse the module → discipline → set → question hierarchy."),
    destination("theory-vault", "theory-bookmarks", "Return to theory questions you intentionally saved."),
    destination("theory-vault", "theory-notes", "Keep and revisit learner-created notes."),
    destination("theory-vault", "theory-revision", "Deferred and weak questions collect in your revision queue.", true),
    destination("theory-vault", "theory-progress", "Review progress that belongs specifically to Theory Vault.", true),
    destination("theory-vault", "theory-search", "Locate concepts across Theory Vault without stepping through the browse hierarchy.", true),
    { id: "theory-study-interface", title: "The study interface", body: "This non-mutating demonstration explains answer drafting, revealing structured answers, confidence rating, and revision scheduling. It never opens a real question, overwrites a draft, or changes confidence.", desktopTargetAnchorId: "theory-study-demo", mobileTargetAnchorId: "theory-study-demo", preferredPlacement: "center", desktopPresentation: "card", mobilePresentation: "sheet", navigationAction: { type: "none" } },
  ]},
}
