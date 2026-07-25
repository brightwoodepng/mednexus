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
  /** Tailwind text-color class applied to the icon (e.g. "text-blue-500"). */
  iconColor?: string
  /** Bottom navigation intentionally shows a compact subset on small screens. */
  bottomNav?: boolean
}

/** The single source of truth for every learner-facing workspace destination. */
export const STUDY_HUB_NAVIGATION: Record<StudyHubId, readonly HubNavigationItem[]> = {
  "mcq-qbank": [
    { id: "dashboard", label: "Dashboard", screen: "dashboard", icon: LayoutDashboard, iconColor: "text-blue-500", bottomNav: true },
    { id: "modules", label: "Study Modules", screen: "modules", icon: LayersIcon, iconColor: "text-violet-500" },
    { id: "weak-areas", label: "Weak Areas", screen: "weak-areas", icon: ActivityIcon, iconColor: "text-orange-500" },
    { id: "live-assessments", label: "Live Assessments", screen: "live-assessments", icon: RadioIcon, iconColor: "text-red-500" },
    { id: "game", label: "Game Mode", screen: "game", icon: GamepadIcon, iconColor: "text-green-500", bottomNav: true },
    { id: "store", label: "Nexus Store", screen: "store", icon: StoreIcon, iconColor: "text-yellow-500" },
    { id: "leaderboard", label: "Leaderboard", screen: "leaderboard", icon: TrophyIcon, iconColor: "text-amber-500", bottomNav: true },
  ],
  "theory-vault": [
    { id: "theory-dashboard", label: "Dashboard", screen: "theory-dashboard", icon: LayoutDashboard, iconColor: "text-blue-500", bottomNav: true },
    { id: "theory-browse", label: "Browse Questions", screen: "theory-browse", icon: BookOpen, iconColor: "text-indigo-500", bottomNav: true },
    // Bookmarks and notes remain available in the mobile drawer. Keeping them
    // out of the bottom bar preserves the four-item, thumb-friendly mobile
    // navigation pattern used by the MCQ workspace.
    { id: "theory-bookmarks", label: "Bookmarks", screen: "theory-bookmarks", icon: Bookmark, iconColor: "text-amber-500" },
    { id: "theory-notes", label: "My Notes", screen: "theory-notes", icon: NotebookPen, iconColor: "text-emerald-500" },
    { id: "theory-revision", label: "Revision Queue", screen: "theory-revision", icon: RefreshCw, iconColor: "text-teal-500", bottomNav: true },
    { id: "theory-progress", label: "Progress", screen: "theory-progress", icon: ActivityIcon, iconColor: "text-orange-500" },
    { id: "theory-search", label: "Search", screen: "theory-search", icon: Search, iconColor: "text-sky-500" },
  ],
  "osce-hub": [],
}

export const PROFILE_NAVIGATION_ITEM: HubNavigationItem = { id: "profile", label: "Profile", screen: "profile", icon: User, iconColor: "text-slate-400", bottomNav: true }

export function getHubNavigation(hub: StudyHubId) {
  return STUDY_HUB_NAVIGATION[hub]
}
