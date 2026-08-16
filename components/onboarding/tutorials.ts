import type { TutorialId } from "@/lib/onboarding"
import type { Screen } from "@/lib/view"
import { STUDY_HUB_NAVIGATION } from "@/components/navigation/study-hub-navigation"

export type TutorialNavigationAction =
  | { type: "open-mobile-drawer" } | { type: "close-mobile-drawer" }
  | { type: "open-workspace-switcher" } | { type: "close-workspace-switcher" }
  | { type: "open-account-menu" } | { type: "close-account-menu" }
  | { type: "open-appearance" } | { type: "close-appearance" }
  | { type: "navigate-preview"; screen: Screen }
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
export type TutorialDefinition = { id: TutorialId; name: string; finishLabel: string; device: "desktop" | "phone"; steps: TutorialStep[] }

const nav = (hub: "mcq-qbank" | "theory-vault", id: string) => STUDY_HUB_NAVIGATION[hub].find(item => item.id === id)!
const baseStep = { preferredPlacement: "right", desktopPresentation: "coachmark", mobilePresentation: "sheet" } as const

const desktopDestination = (hub: "mcq-qbank" | "theory-vault", id: string, body: string, previewScreen?: Screen): TutorialStep => {
  const item = nav(hub, id)
  return { ...baseStep, id: `desktop-${hub}-${id}`, title: item.label, body, desktopTargetAnchorId: `desktop-nav-${id}`, navigationAction: previewScreen ? { type: "navigate-preview", screen: previewScreen } : { type: "none" } }
}

const phoneDestination = (hub: "mcq-qbank" | "theory-vault", id: string, body: string, previewScreen?: Screen): TutorialStep => {
  const item = nav(hub, id)
  const drawer = !item.bottomNav
  return { ...baseStep, id: `phone-${hub}-${id}`, title: item.mobileLabel ?? item.label, body, mobileTargetAnchorId: item.bottomNav ? `mobile-bottom-nav-${id}` : "mobile-menu-button", mobileDrawerTargetAnchorId: drawer ? `drawer-nav-${id}` : undefined, navigationAction: previewScreen ? { type: "navigate-preview", screen: previewScreen } : drawer ? { type: "open-mobile-drawer" } : { type: "none" }, restoreUiAfterStep: drawer }
}

const desktopShared = (hub: string): TutorialStep[] => [
  { ...baseStep, id: `desktop-${hub}-workspace`, title: "Switch study workspaces", body: "Use this switcher to move between MCQ Q-Bank and Theory Vault.", desktopTargetAnchorId: "desktop-workspace-switcher", navigationAction: { type: "open-workspace-switcher" }, restoreUiAfterStep: true },
  { ...baseStep, id: `desktop-${hub}-navigation`, title: "Desktop navigation", body: "The desktop sidebar keeps every destination visible. It expands during this tour when a full label needs to be shown.", desktopTargetAnchorId: "desktop-navigation", navigationAction: { type: "none" } },
  { ...baseStep, id: `desktop-${hub}-profile`, title: "Profile and notifications", body: "Notifications are in the header. Your account menu contains profile settings and sign out; this tour never signs you out.", desktopTargetAnchorId: "header-account-menu", preferredPlacement: "bottom", navigationAction: { type: "open-account-menu" }, restoreUiAfterStep: true },
  { ...baseStep, id: `desktop-${hub}-appearance`, title: "Appearance and themes", body: "Open appearance settings to preview themes. Pausing the tour restores the appearance you started with.", desktopTargetAnchorId: "header-appearance", preferredPlacement: "bottom", navigationAction: { type: "open-appearance" }, restoreUiAfterStep: true },
]

const phoneShared = (hub: string): TutorialStep[] => [
  { ...baseStep, id: `phone-${hub}-workspace`, title: "Switch study workspaces", body: "On your phone, open the menu to reach the workspace switcher for MCQ Q-Bank and Theory Vault.", mobileTargetAnchorId: "mobile-menu-button", mobileDrawerTargetAnchorId: "drawer-workspace-switcher", navigationAction: { type: "open-workspace-switcher" }, interaction: { type: "try-it", expectedAction: "open-mobile-drawer" }, restoreUiAfterStep: true },
  { ...baseStep, id: `phone-${hub}-bottom-navigation`, title: "Phone navigation bar", body: "The four main destinations stay in the bottom navigation bar within thumb reach.", mobileTargetAnchorId: "mobile-bottom-navigation", navigationAction: { type: "none" } },
  { ...baseStep, id: `phone-${hub}-more`, title: "The full phone menu", body: "Open the menu for every destination that does not fit in the four-tab phone bar.", mobileTargetAnchorId: "mobile-menu-button", mobileDrawerTargetAnchorId: "drawer-navigation", interaction: { type: "try-it", expectedAction: "open-mobile-drawer" }, restoreUiAfterStep: true },
  { ...baseStep, id: `phone-${hub}-profile`, title: "Profile and notifications", body: "Notifications and your account menu remain in the phone header. The tutorial never signs you out.", mobileTargetAnchorId: "header-account-menu", preferredPlacement: "bottom", navigationAction: { type: "open-account-menu" }, restoreUiAfterStep: true },
  { ...baseStep, id: `phone-${hub}-appearance`, title: "Appearance and themes", body: "Appearance settings live inside the phone menu. Pausing restores the appearance you started with.", mobileTargetAnchorId: "mobile-menu-button", mobileDrawerTargetAnchorId: "drawer-appearance", preferredPlacement: "bottom", navigationAction: { type: "open-appearance" }, restoreUiAfterStep: true },
]

const mcqDestinations = [
  ["dashboard", "See your overview, current activity, recent results, and the next useful place to study.", "dashboard"],
  ["modules", "Choose a module and discipline, then choose Trial for guided feedback or Exam for results at the end."],
  ["game", "Play solo MCQ games or join multiplayer. The tutorial never starts a game."],
  ["leaderboard", "Follow seasonal ranking and rank points earned from eligible activity."],
  ["weak-areas", "Incorrect MCQs identify weak disciplines and focused revision opportunities."],
  ["live-assessments", "Join scheduled assessments only when you intend to; the tutorial never joins one."],
  ["store", "Check your NP balance and browse supplies and cosmetics. The tutorial never purchases anything."],
] as const

const theoryDestinations = [
  ["theory-dashboard", "See your Theory overview and recent study activity.", "theory-dashboard"],
  ["theory-browse", "Browse the module → discipline → set → question hierarchy."],
  ["theory-bookmarks", "Return to theory questions you intentionally saved."],
  ["theory-notes", "Keep and revisit learner-created notes."],
  ["theory-revision", "Deferred and weak questions collect in your revision queue."],
  ["theory-progress", "Review progress that belongs specifically to Theory Vault."],
  ["theory-search", "Locate concepts across Theory Vault without stepping through the browse hierarchy."],
] as const

const theoryStudy = (device: "desktop" | "phone"): TutorialStep => ({ ...baseStep, id: `${device}-theory-study-interface`, title: "The study interface", body: "This safe demonstration explains answer drafting, structured answers, confidence, and revision scheduling without opening a real question or changing progress.", desktopTargetAnchorId: device === "desktop" ? "theory-study-demo" : undefined, mobileTargetAnchorId: device === "phone" ? "theory-study-demo" : undefined, preferredPlacement: "center", desktopPresentation: "card", navigationAction: { type: "none" } })

export const tutorials: Record<TutorialId, TutorialDefinition> = {
  mcq_qbank_desktop_intro: { id: "mcq_qbank_desktop_intro", name: "MCQ Q-Bank · Desktop", finishLabel: "Start practicing", device: "desktop", steps: [...desktopShared("mcq"), ...mcqDestinations.map(([id, body, screen]) => desktopDestination("mcq-qbank", id, body, screen))] },
  mcq_qbank_phone_intro: { id: "mcq_qbank_phone_intro", name: "MCQ Q-Bank · Phone", finishLabel: "Start practicing", device: "phone", steps: [...phoneShared("mcq"), ...mcqDestinations.map(([id, body, screen]) => phoneDestination("mcq-qbank", id, body, screen))] },
  theory_vault_desktop_intro: { id: "theory_vault_desktop_intro", name: "Theory Vault · Desktop", finishLabel: "Explore Theory Vault", device: "desktop", steps: [...desktopShared("theory"), ...theoryDestinations.map(([id, body, screen]) => desktopDestination("theory-vault", id, body, screen)), theoryStudy("desktop")] },
  theory_vault_phone_intro: { id: "theory_vault_phone_intro", name: "Theory Vault · Phone", finishLabel: "Explore Theory Vault", device: "phone", steps: [...phoneShared("theory"), ...theoryDestinations.map(([id, body, screen]) => phoneDestination("theory-vault", id, body, screen)), theoryStudy("phone")] },
}
