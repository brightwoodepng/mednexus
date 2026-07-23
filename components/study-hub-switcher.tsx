"use client"

import { BookOpenIcon, LockKeyholeIcon, StethoscopeIcon } from "lucide-react"

export type StudyHubId = "mcq-qbank" | "theory-vault" | "osce-hub"

export const STUDY_HUBS: ReadonlyArray<{
  id: StudyHubId
  name: string
  description: string
  available: boolean
}> = [
  { id: "mcq-qbank", name: "MCQ Q-Bank", description: "Questions, practice and exams", available: true },
  { id: "theory-vault", name: "Theory Vault", description: "Core notes and revision guides", available: false },
  { id: "osce-hub", name: "OSCE Hub", description: "Clinical stations and feedback", available: false },
]

function HubIcon({ hub, size = 16 }: { hub: StudyHubId; size?: number }) {
  if (hub === "osce-hub") return <StethoscopeIcon size={size} aria-hidden="true" />
  return <BookOpenIcon size={size} aria-hidden="true" />
}

/**
 * Product-level study destination picker. This is deliberately independent of
 * StudyModeContext, which continues to control MCQ Tutor/Exam quiz behaviour.
 */
export function StudyHubSwitcher({
  activeHub,
  onSelect,
  compact = false,
  className = "",
}: {
  activeHub: StudyHubId
  onSelect: (hub: StudyHubId) => void
  compact?: boolean
  className?: string
}) {
  if (compact) {
    return (
      <div className={`flex items-center rounded-xl border border-border bg-muted/40 p-1 ${className}`} aria-label="Study hub">
        {STUDY_HUBS.filter((hub) => hub.available).map((hub) => {
          const active = hub.id === activeHub
          return <button key={hub.id} type="button" onClick={() => onSelect(hub.id)} aria-current={active ? "page" : undefined} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-background"}`}>
            <HubIcon hub={hub.id} size={14} />
            <span>{hub.name}</span>
          </button>
        })}
      </div>
    )
  }

  return (
    <section className={`rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-2 ${className}`} aria-labelledby="study-hubs-title">
      <div className="flex items-center justify-between px-2 pb-1.5">
        <p id="study-hubs-title" className="text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/55">Study hubs</p>
        <span className="text-[10px] text-sidebar-foreground/50">Choose workspace</span>
      </div>
      <div className="space-y-1">
        {STUDY_HUBS.map((hub) => {
          const active = hub.id === activeHub
          return (
            <button
              key={hub.id}
              type="button"
              disabled={!hub.available}
              onClick={() => onSelect(hub.id)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:cursor-not-allowed disabled:opacity-65 ${
                active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? "bg-white/15" : "bg-sidebar-primary/10 text-sidebar-primary"}`}>
                {hub.available ? <HubIcon hub={hub.id} size={15} /> : <LockKeyholeIcon size={14} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold leading-tight">{hub.name}</span>
                <span className={`mt-0.5 block text-[10px] leading-tight ${active ? "text-sidebar-primary-foreground/70" : "text-sidebar-foreground/55"}`}>{hub.description}</span>
              </span>
              {!hub.available && <span className="rounded-full border border-sidebar-border bg-background/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sidebar-foreground/65">Soon</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
