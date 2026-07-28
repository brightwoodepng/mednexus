import type { ReactNode } from "react"
export function TutorialMobileSheet({ children, avoidBottomNavigation = false }: { children: ReactNode; avoidBottomNavigation?: boolean }) {
  return <div className={`pointer-events-auto fixed inset-x-2 z-[84] mx-auto w-auto max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card px-3.5 pt-2.5 shadow-2xl md:hidden ${avoidBottomNavigation ? "top-[max(.5rem,env(safe-area-inset-top,0px))] max-h-[44dvh]" : "bottom-[max(.5rem,env(safe-area-inset-bottom,0px))] max-h-[48dvh]"}`} style={{ paddingBottom: ".625rem" }}>{children}</div>
}
