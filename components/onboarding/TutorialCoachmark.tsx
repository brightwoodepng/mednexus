import type { ReactNode } from "react"
export function TutorialCoachmark({ children, style }: { children: ReactNode; style?: React.CSSProperties }) { return <div style={style} className="pointer-events-auto fixed z-[84] hidden w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-5 shadow-2xl md:block">{children}</div> }
