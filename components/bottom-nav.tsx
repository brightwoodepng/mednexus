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
function BarChartIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
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
  { id: "dashboard", label: "Home",     icon: HomeIcon,     screen: "dashboard"   as Screen },
  { id: "modules",   label: "Modules",  icon: LayersIcon,   screen: "modules"     as Screen },
  { id: "practice",  label: "Practice", icon: ZapIcon,      screen: "weak-areas"  as Screen },
  { id: "stats",     label: "Stats",    icon: BarChartIcon, screen: "profile"     as Screen },
  { id: "profile",   label: "Profile",  icon: UserIcon,     screen: "profile"     as Screen },
] as const

type TabId = typeof TABS[number]["id"]

/** Derive the canonical bottom-tab id from the current app screen. */
function screenToTab(s: Screen): TabId | null {
  if (s === "dashboard")  return "dashboard"
  if (s === "modules")    return "modules"
  if (s === "weak-areas") return "practice"
  if (s === "profile")    return "stats"   // Stats is the canonical profile tab
  return null   // quiz, game, results, etc. — keep whatever tab is already active
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
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors active:bg-muted/60 ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {/* Icon with filled/outlined states */}
              <span className={`relative flex h-6 w-6 items-center justify-center transition-transform ${isActive ? "scale-110" : ""}`}>
                <Icon size={22} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </span>
              <span className={`text-[10px] font-semibold leading-none ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
