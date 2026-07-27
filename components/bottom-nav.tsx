"use client"

import type { Screen } from "@/lib/view"
import type { StudyHubId } from "@/components/study-hub-switcher"
import { getHubNavigation } from "@/components/navigation/study-hub-navigation"

interface BottomNavProps { screen: Screen; activeHub: StudyHubId; onNavigate: (s: Screen) => void; hidden?: boolean }

/** A compact, responsive projection of the same hub navigation used by the sidebar. */
export function BottomNav({ screen, activeHub, onNavigate, hidden }: BottomNavProps) {
  if (hidden) return null
  const tabs = getHubNavigation(activeHub).filter((item) => item.bottomNav)
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} aria-label="Primary navigation">
    <div className="grid grid-cols-4 items-stretch">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = screen === tab.screen
        return <button key={tab.id} type="button" onClick={() => onNavigate(tab.screen)} aria-current={active ? "page" : undefined} aria-label={tab.label} className="flex min-h-16 min-w-0 flex-col items-center justify-center px-0.5">
          <span className={`flex min-w-0 max-w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-1.5 py-1.5 transition-all duration-200 ${active ? "bg-primary/10 shadow-sm" : "bg-transparent"}`}><Icon size={19} className={active ? "text-primary" : (tab.iconColor ?? "text-muted-foreground")} /><span className={`max-w-full truncate text-[9px] font-semibold leading-none min-[360px]:text-[10px] ${active ? "font-bold text-primary" : "text-muted-foreground"}`}>{tab.mobileLabel ?? tab.label}</span></span>
        </button>
      })}
    </div>
  </nav>
}
