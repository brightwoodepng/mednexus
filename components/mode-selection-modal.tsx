"use client"

import { Modal } from "@/components/ui/modal"
import { getQuestionCount, WEAK_AREAS } from "@/lib/modules"
import { ZapIcon, TimerIcon, ArrowRightIcon } from "@/components/icons"
import type { QuizMode } from "@/lib/types"
import { useApp } from "@/contexts/app-context"

interface ModeSelectionModalProps {
  subject: string | null
  onClose: () => void
  onStart: (mode: QuizMode) => void
}

export function ModeSelectionModal({ subject, onClose, onStart }: ModeSelectionModalProps) {
  const { progress } = useApp()
  const open = subject !== null
  const count = subject ? getQuestionCount(subject, subject === WEAK_AREAS ? progress.history : undefined) : 0

  return (
    <Modal open={open} onClose={onClose} title={subject ? `Start: ${subject}` : ""} widthClass="max-w-xl">
      <p className="mb-5 text-sm text-muted-foreground">
        {count} question{count === 1 ? "" : "s"} in this block. Choose how you want to study.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          icon={<ZapIcon size={22} />}
          title="Trial Mode"
          tag="Tutor"
          description="Immediate feedback. Options turn green or red on click and the full explanation appears right away."
          onClick={() => onStart("trial")}
          accent="primary"
        />
        <ModeCard
          icon={<TimerIcon size={22} />}
          title="Exam Mode"
          tag="Timed"
          description="Simulates the real test. A countdown runs and grading stays hidden until you submit the block."
          onClick={() => onStart("exam")}
          accent="warning"
        />
      </div>
    </Modal>
  )
}

function ModeCard({
  icon,
  title,
  tag,
  description,
  onClick,
  accent,
}: {
  icon: React.ReactNode
  title: string
  tag: string
  description: string
  onClick: () => void
  accent: "primary" | "warning"
}) {
  const accentBg = accent === "primary" ? "bg-primary text-primary-foreground" : "bg-warning text-warning-foreground"
  const tagBg = accent === "primary" ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning"
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className={`inline-flex rounded-xl p-2.5 ${accentBg}`}>{icon}</div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tagBg}`}>{tag}</span>
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
        Begin
        <ArrowRightIcon size={15} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  )
}
