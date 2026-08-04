"use client"

import type { Screen } from "@/lib/view"
import type { StudyHubId } from "@/components/study-hub-switcher"
import { getHubNavigation } from "@/components/navigation/study-hub-navigation"

interface BottomNavProps { screen: Screen; activeHub: StudyHubId; onNavigate: (s: Screen) => void; hidden?: boolean }

/** A compact, responsive projection of the same hub navigation used by the sidebar. */
export function BottomNav({ screen, activeHub, onNavigate, hidden }: BottomNavProps) {
  if (hidden) return null
  const tabs = getHubNavigation(activeHub).filter((item) => item.bottomNav)
  return <nav
    data-tutorial-anchor="mobile-bottom-navigation"
    className="fixed inset-x-3 z-50 mx-auto max-w-md rounded-[2rem] border border-border/80 bg-background/95 p-1.5 shadow-[0_12px_36px_rgba(15,23,42,0.22)] backdrop-blur-xl md:hidden"
    style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
    aria-label="Primary navigation"
  >
    <div className="grid grid-cols-4 items-stretch gap-0.5">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = screen === tab.screen
        return <button key={tab.id} data-tutorial-anchor={`mobile-bottom-nav-${tab.id}`} type="button" onClick={() => onNavigate(tab.screen)} aria-current={active ? "page" : undefined} aria-label={tab.label} className="flex min-h-14 min-w-0 flex-col items-center justify-center rounded-[1.4rem] px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <span className={`flex h-12 w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-[1.15rem] px-2 py-1.5 transition-[background-color,color,box-shadow] duration-200 ${active ? "bg-primary/15 shadow-sm" : "bg-transparent"}`}><Icon size={19} className={`shrink-0 transition-colors duration-200 ${active ? "text-primary" : (tab.iconColor ?? "text-muted-foreground")}`} /><span className={`max-w-full truncate text-[9px] font-semibold leading-none transition-colors duration-200 min-[360px]:text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>{tab.mobileLabel ?? tab.label}</span></span>
        </button>
      })}
    </div>
  </nav>
}
