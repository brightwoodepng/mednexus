import type { ReactNode } from "react"
export function TutorialCoachmark({ children, style }: { children: ReactNode; style?: React.CSSProperties }) { return <div style={style} className="pointer-events-auto fixed z-[84] hidden max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl md:block">{children}</div> }
