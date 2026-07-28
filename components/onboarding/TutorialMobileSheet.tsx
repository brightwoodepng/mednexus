import type { ReactNode } from "react"
export function TutorialMobileSheet({ children, avoidBottomNavigation = false }: { children: ReactNode; avoidBottomNavigation?: boolean }) {
  return <div className={`pointer-events-auto fixed inset-x-2 z-[84] overflow-y-auto rounded-2xl border border-border bg-card px-4 pt-4 shadow-2xl md:hidden ${avoidBottomNavigation ? "top-[max(.5rem,env(safe-area-inset-top,0px))] max-h-[58dvh]" : "bottom-0 max-h-[min(72dvh,36rem)]"}`} style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}>{children}</div>
}
