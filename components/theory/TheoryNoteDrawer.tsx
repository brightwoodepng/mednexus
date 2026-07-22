"use client"

/**
 * TheoryNoteDrawer — slide-out panel for adding/editing a personal note
 * on the current theory question. Triggered from the study interface header.
 */

import { useState, useEffect, useRef } from "react"
import { XIcon, SaveIcon, FileTextIcon } from "lucide-react"

interface Props {
  isOpen:        boolean
  onClose:       () => void
  questionPrompt: string
  initialNote:   string
  onSave:        (note: string) => Promise<void>
  isSaving:      boolean
}

export function TheoryNoteDrawer({
  isOpen,
  onClose,
  questionPrompt,
  initialNote,
  onSave,
  isSaving,
}: Props) {
  const [draft, setDraft] = useState(initialNote)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync draft when the drawer opens for a different question
  useEffect(() => {
    setDraft(initialNote)
  }, [initialNote, isOpen])

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 80)
    }
  }, [isOpen])

  const handleSave = () => onSave(draft)

  const wordCount = draft.trim() ? draft.trim().split(/\s+/).length : 0

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slides in from the right */}
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-card shadow-2xl"
        role="dialog"
        aria-label="Add note"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <FileTextIcon size={16} className="text-amber-600 dark:text-amber-400" />
            My Note
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Question preview */}
        <div className="shrink-0 border-b border-border bg-muted/40 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Question
          </p>
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {questionPrompt}
          </p>
        </div>

        {/* Textarea */}
        <div className="flex flex-1 flex-col overflow-hidden px-5 py-4">
          <label className="mb-2 text-xs font-medium text-muted-foreground">
            Your personal note
          </label>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write anything you want to remember — mnemonics, clinical pearls, personal observations…"
            className="flex-1 resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-colors"
          />
          <p className="mt-1.5 text-right text-[10px] text-muted-foreground">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </p>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <SaveIcon size={14} />
            {isSaving ? "Saving…" : draft.trim() ? "Save Note" : "Clear Note"}
          </button>
        </div>
      </div>
    </>
  )
}
