"use client"

import { useApp } from "@/contexts/app-context"
import { UserIcon, ListChecksIcon, TargetIcon, FlameIcon, CheckIcon, XIcon, EyeOffIcon } from "@/components/icons"
import type { HistoryEntry } from "@/lib/types"

export function ProfileHistory() {
  const { user, progress, cloudEnabled } = useApp()
  const accuracy = progress.totalAnswered ? Math.round((progress.totalCorrect / progress.totalAnswered) * 100) : 0

  return (
    <div className="mx-auto max-w-4xl">
      {/* Profile header */}
      <header className="mb-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <UserIcon size={30} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight">{user?.name ?? "Clinician"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {cloudEnabled ? "☁ Synced to cloud" : "Saving locally…"}
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-px border-t border-border bg-border">
          <MiniStat icon={<ListChecksIcon size={16} />} label="Answered" value={progress.totalAnswered} />
          <MiniStat icon={<TargetIcon size={16} />} label="Accuracy" value={`${accuracy}%`} />
          <MiniStat icon={<FlameIcon size={16} />} label="Streak" value={`${progress.streak}d`} />
        </div>
      </header>

      {/* History log */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Per-Question History</h2>
        <span className="text-sm text-muted-foreground">{progress.history.length} entries</span>
      </div>

      {progress.history.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No history yet. Complete a study block and your answers will appear here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {progress.history.map((entry) => (
            <HistoryRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  )
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const omitted = entry.selectedOption === null
  const correct = entry.isCorrect
  const accent = omitted ? "bg-muted-foreground/40" : correct ? "bg-success" : "bg-destructive"

  return (
    <li className="flex overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <span className={`w-1.5 shrink-0 ${accent}`} aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {entry.subject}
            </span>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              {entry.mode === "trial" ? "Tutor" : "Exam"}
            </span>
            <span className="text-[11px] text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
          </div>
          <p className="text-sm leading-snug text-foreground text-pretty">{entry.vignetteSnippet}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <AnswerPill
            label="You"
            value={omitted ? "—" : entry.selectedOption!}
            tone={omitted ? "neutral" : correct ? "correct" : "incorrect"}
          />
          <AnswerPill label="Key" value={entry.correctOption} tone="correct" />
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              omitted
                ? "bg-muted text-muted-foreground"
                : correct
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive"
            }`}
          >
            {omitted ? <EyeOffIcon size={16} /> : correct ? <CheckIcon size={16} /> : <XIcon size={16} />}
          </span>
        </div>
      </div>
    </li>
  )
}

function AnswerPill({ label, value, tone }: { label: string; value: string; tone: "correct" | "incorrect" | "neutral" }) {
  const toneClass =
    tone === "correct"
      ? "border-success/40 bg-success/10 text-success"
      : tone === "incorrect"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border bg-muted text-muted-foreground"
  return (
    <div className={`flex flex-col items-center rounded-lg border px-2.5 py-1 ${toneClass}`}>
      <span className="text-[10px] font-medium uppercase opacity-70">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  )
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center bg-card px-3 py-4 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="mt-1 text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
