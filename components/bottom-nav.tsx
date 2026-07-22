"use client"

import { useState, useEffect } from "react"
import type { Screen } from "@/lib/view"
import { getStudyHubByMode } from "@/lib/study-hubs"

// ─── Icons (self-contained, no external deps) ─────────────────────────────────
function HomeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function TrophyIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  )
}
function GamepadIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      <line x1="15" y1="13" x2="15.01" y2="13" />
      <line x1="18" y1="11" x2="18.01" y2="11" />
      <rect width="20" height="12" x="2" y="6" rx="2" />
    </svg>
  )
}
function UserIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
// MCQ bottom navigation belongs to the available MCQ hub registry entry.
const MCQ_HUB = getStudyHubByMode("MCQ")
const TABS = [
  { id: "dashboard",   label: "Home",        icon: HomeIcon,    screen: "dashboard"   as Screen },
  { id: "game",        label: "Game",        icon: GamepadIcon, screen: "game"        as Screen },
  { id: "leaderboard", label: "Rank",        icon: TrophyIcon,  screen: "leaderboard" as Screen },
  { id: "profile",     label: "Profile",     icon: UserIcon,    screen: "profile"     as Screen },
] as const

type TabId = typeof TABS[number]["id"]

/** Derive the canonical bottom-tab id from the current app screen. */
function screenToTab(s: Screen): TabId | null {
  if (s === "dashboard")   return "dashboard"
  if (s === "leaderboard") return "leaderboard"
  if (s === "game")        return "game"
  if (s === "profile")     return "profile"
  return null   // quiz, results, store, etc. — keep whatever tab is already active
}

// ─── Component ────────────────────────────────────────────────────────────────
interface BottomNavProps {
  screen: Screen
  onNavigate: (s: Screen) => void
  hidden?: boolean
}

export function BottomNav({ screen, onNavigate, hidden }: BottomNavProps) {
  if (hidden) return null
  const [active, setActive] = useState<TabId>(() => screenToTab(screen) ?? "dashboard")

  // Sync when the screen changes from external navigation (sidebar on desktop, etc.)
  useEffect(() => {
    const t = screenToTab(screen)
    if (t) setActive(t)
  }, [screen])

  function tap(tab: typeof TABS[number]) {
    setActive(tab.id)
    onNavigate(tab.screen)
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex h-16 items-stretch">
        {TABS.map((tab) => {
          const isActive = active === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => tap(tab)}
              aria-label={`${MCQ_HUB.title}: ${tab.label}`}
              /* Full-height button = 64px touch target, well above the 48px minimum */
              className="flex flex-1 flex-col items-center justify-center px-0.5"
            >
              {/* Pill container — expands on active with teal background */}
              <span
                className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-1.5 transition-all duration-200 ${
                  isActive
                    ? "bg-primary/10 shadow-sm"
                    : "bg-transparent"
                }`}
              >
                {/* Icon */}
                <span
                  className={`flex h-5 w-5 items-center justify-center transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon size={20} />
                </span>
                {/* Label */}
                <span
                  className={`text-[10px] font-semibold leading-none transition-colors duration-200 ${
                    isActive
                      ? "font-bold text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
