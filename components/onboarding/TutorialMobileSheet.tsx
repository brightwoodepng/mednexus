import type { ReactNode } from "react"
export function TutorialMobileSheet({ children }: { children: ReactNode }) { return <div className="fixed inset-x-0 bottom-0 z-[84] max-h-[52dvh] overflow-y-auto rounded-t-3xl border border-border bg-card px-5 pt-5 shadow-2xl md:hidden" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}>{children}</div> }
