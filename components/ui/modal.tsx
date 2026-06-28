"use client"

import { useEffect, type ReactNode } from "react"
import { XIcon } from "@/components/icons"

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Tailwind max-width class, e.g. "max-w-lg". */
  widthClass?: string
  /** When false, hides the default header. */
  showHeader?: boolean
}

/** Accessible centered modal with backdrop, escape-to-close, and scroll lock. */
export function Modal({ open, onClose, title, children, widthClass = "max-w-lg", showHeader = true }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="glass-modal-overlay absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-in fade-in"
      />
      <div
        className={`glass-modal relative w-full ${widthClass} max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card text-card-foreground shadow-2xl animate-ios-sheet`}
      >
        {showHeader && (
          <div className="glass-modal-header sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4">
            <h2 className="text-lg font-semibold text-balance">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <XIcon size={20} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
