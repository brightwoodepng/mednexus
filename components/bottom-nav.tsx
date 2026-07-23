"use client"

import type { Screen } from "@/lib/view"
import type { StudyHubId } from "@/components/study-hub-switcher"
import { getHubNavigation, PROFILE_NAVIGATION_ITEM } from "@/components/navigation/study-hub-navigation"

interface BottomNavProps { screen: Screen; activeHub: StudyHubId; onNavigate: (s: Screen) => void; hidden?: boolean }

/** A compact, responsive projection of the same hub navigation used by the sidebar. */
export function BottomNav({ screen, activeHub, onNavigate, hidden }: BottomNavProps) {
  if (hidden) return null
  const tabs = [...getHubNavigation(activeHub).filter((item) => item.bottomNav), PROFILE_NAVIGATION_ITEM]
  return <nav className="fixed bottom-0 left-0 right-0 z-50 overflow-x-auto border-t border-border bg-background/95 backdrop-blur-md md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Primary navigation">
    <div className="flex min-w-max items-stretch">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = screen === tab.screen
        return <button key={tab.id} type="button" onClick={() => onNavigate(tab.screen)} aria-current={active ? "page" : undefined} aria-label={tab.label} className="flex min-h-16 min-w-[76px] flex-1 flex-col items-center justify-center px-1">
          <span className={`flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 transition-all duration-200 ${active ? "bg-primary/10 shadow-sm" : "bg-transparent"}`}><Icon size={20} className={active ? "text-primary" : "text-muted-foreground"} /><span className={`text-[10px] font-semibold leading-none ${active ? "font-bold text-primary" : "text-muted-foreground"}`}>{tab.label}</span></span>
        </button>
      })}
    </div>
  </nav>
}
