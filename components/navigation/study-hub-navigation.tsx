"use client"

import type { ComponentType } from "react"
import { Bookmark, BookOpen, LayoutDashboard, NotebookPen, RefreshCw, Search, User } from "lucide-react"
import { ActivityIcon, GamepadIcon, LayersIcon, RadioIcon, StoreIcon, TrophyIcon } from "@/components/icons"
import type { StudyHubId } from "@/components/study-hub-switcher"
import type { Screen } from "@/lib/view"

export type HubNavigationItem = {
  id: string
  label: string
  screen: Screen
  icon: ComponentType<{ size?: number; className?: string }>
  /** Bottom navigation intentionally shows a compact subset on small screens. */
  bottomNav?: boolean
}

/** The single source of truth for every learner-facing workspace destination. */
export const STUDY_HUB_NAVIGATION: Record<StudyHubId, readonly HubNavigationItem[]> = {
  "mcq-qbank": [
    { id: "dashboard", label: "Dashboard", screen: "dashboard", icon: LayoutDashboard, bottomNav: true },
    { id: "modules", label: "Study Modules", screen: "modules", icon: LayersIcon },
    { id: "weak-areas", label: "Weak Areas", screen: "weak-areas", icon: ActivityIcon },
    { id: "live-assessments", label: "Live Assessments", screen: "live-assessments", icon: RadioIcon },
    { id: "game", label: "Game Mode", screen: "game", icon: GamepadIcon, bottomNav: true },
    { id: "store", label: "Nexus Store", screen: "store", icon: StoreIcon },
    { id: "leaderboard", label: "Leaderboard", screen: "leaderboard", icon: TrophyIcon, bottomNav: true },
  ],
  "theory-vault": [
    { id: "theory-dashboard", label: "Dashboard", screen: "theory-dashboard", icon: LayoutDashboard, bottomNav: true },
    { id: "theory-browse", label: "Browse Questions", screen: "theory-browse", icon: BookOpen, bottomNav: true },
    { id: "theory-bookmarks", label: "Bookmarks", screen: "theory-bookmarks", icon: Bookmark, bottomNav: true },
    { id: "theory-notes", label: "My Notes", screen: "theory-notes", icon: NotebookPen, bottomNav: true },
    { id: "theory-revision", label: "Revision Queue", screen: "theory-revision", icon: RefreshCw, bottomNav: true },
    { id: "theory-search", label: "Search", screen: "theory-search", icon: Search },
  ],
  "osce-hub": [],
}

export const PROFILE_NAVIGATION_ITEM: HubNavigationItem = { id: "profile", label: "Profile", screen: "profile", icon: User, bottomNav: true }

export function getHubNavigation(hub: StudyHubId) {
  return STUDY_HUB_NAVIGATION[hub]
}
