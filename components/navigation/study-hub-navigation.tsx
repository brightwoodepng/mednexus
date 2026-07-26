"use client"

import type { ComponentType } from "react"
import { Bookmark, BookOpen, LayoutDashboard, NotebookPen, RefreshCw, Search } from "lucide-react"
import { ActivityIcon, GamepadIcon, LayersIcon, RadioIcon, StoreIcon, TrophyIcon } from "@/components/icons"
import type { StudyHubId } from "@/components/study-hub-switcher"
import type { Screen } from "@/lib/view"

export type HubNavigationItem = {
  id: string
  label: string
  /** Short label used only by the constrained phone bottom navigation. */
  mobileLabel?: string
  screen: Screen
  icon: ComponentType<{ size?: number; className?: string }>
  /** Tailwind text-color class applied to the icon (e.g. "text-blue-500"). */
  iconColor?: string
  /** Bottom navigation intentionally shows a compact subset on small screens. */
  bottomNav?: boolean
}

/** The single source of truth for every learner-facing workspace destination. */
export const STUDY_HUB_NAVIGATION: Record<StudyHubId, readonly HubNavigationItem[]> = {
  "mcq-qbank": [
    { id: "dashboard", label: "Dashboard", screen: "dashboard", icon: LayoutDashboard, iconColor: "text-primary", bottomNav: true },
    { id: "modules", label: "Study Modules", mobileLabel: "Modules", screen: "modules", icon: LayersIcon, iconColor: "text-primary", bottomNav: true },
    { id: "weak-areas", label: "Weak Areas", screen: "weak-areas", icon: ActivityIcon, iconColor: "text-primary" },
    { id: "live-assessments", label: "Live Assessments", screen: "live-assessments", icon: RadioIcon, iconColor: "text-primary" },
    { id: "game", label: "Game Mode", screen: "game", icon: GamepadIcon, iconColor: "text-primary", bottomNav: true },
    { id: "store", label: "Nexus Store", screen: "store", icon: StoreIcon, iconColor: "text-primary" },
    { id: "leaderboard", label: "Leaderboard", screen: "leaderboard", icon: TrophyIcon, iconColor: "text-primary", bottomNav: true },
  ],
  "theory-vault": [
    { id: "theory-dashboard", label: "Dashboard", screen: "theory-dashboard", icon: LayoutDashboard, iconColor: "text-primary", bottomNav: true },
    { id: "theory-browse", label: "Browse Questions", mobileLabel: "Browse", screen: "theory-browse", icon: BookOpen, iconColor: "text-primary", bottomNav: true },
    { id: "theory-bookmarks", label: "Bookmarks", screen: "theory-bookmarks", icon: Bookmark, iconColor: "text-primary", bottomNav: true },
    { id: "theory-notes", label: "My Notes", mobileLabel: "Notes", screen: "theory-notes", icon: NotebookPen, iconColor: "text-primary", bottomNav: true },
    { id: "theory-revision", label: "Revision Queue", mobileLabel: "Revision", screen: "theory-revision", icon: RefreshCw, iconColor: "text-primary", bottomNav: true },
    { id: "theory-progress", label: "Progress", screen: "theory-progress", icon: ActivityIcon, iconColor: "text-primary" },
    { id: "theory-search", label: "Search", screen: "theory-search", icon: Search, iconColor: "text-primary" },
  ],
  "osce-hub": [],
}

export function getHubNavigation(hub: StudyHubId) {
  return STUDY_HUB_NAVIGATION[hub]
}
