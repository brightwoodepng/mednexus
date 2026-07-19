"use client"

import { useState, useEffect } from "react"
import type { Screen } from "@/lib/view"

// ─── Icons (self-contained, no external deps) ─────────────────────────────────
function HomeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function LayersIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}
function ZapIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
function GamepadIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="12" x="2" y="6" rx="2.5" />
      <line x1="6" y1="12" x2="10" y2="12" />
      <line x1="8" y1="10" x2="8" y2="14" />
      {/* Face buttons as filled circles for visual weight parity */}
      <circle cx="15.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
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
const TABS = [
  { id: "dashboard", label: "Home",      icon: HomeIcon,    screen: "dashboard"  as Screen },
  { id: "modules",   label: "Modules",   icon: LayersIcon,  screen: "modules"    as Screen },
  { id: "game",      label: "Game",      icon: GamepadIcon, screen: "game"       as Screen },
  { id: "practice",  label: "Practice",  icon: ZapIcon,     screen: "weak-areas" as Screen },
  { id: "profile",   label: "Profile",   icon: UserIcon,    screen: "profile"    as Screen },
] as const

type TabId = typeof TABS[number]["id"]

/** Derive the canonical bottom-tab id from the current app screen. */
function screenToTab(s: Screen): TabId | null {
  if (s === "dashboard")  return "dashboard"
  if (s === "modules")    return "modules"
  if (s === "weak-areas") return "practice"
  if (s === "game")       return "game"
  if (s === "profile")    return "profile"
  return null   // quiz, results, store, etc. — keep whatever tab is already active
}

// ─── Component ────────────────────────────────────────────────────────────────
interface BottomNavProps {
  screen: Screen
  onNavigate: (s: Screen) => void
}

export function BottomNav({ screen, onNavigate }: BottomNavProps) {
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
              aria-label={tab.label}
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
                  className={`flex h-[22px] w-[22px] items-center justify-center transition-colors duration-200 ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon size={20} />
                </span>
                {/* Label */}
                <span
                  className={`text-[10px] leading-none transition-colors duration-200 ${
                    isActive
                      ? "font-bold text-primary"
                      : "font-semibold text-muted-foreground"
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
