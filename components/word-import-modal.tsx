"use client"

import { useState, useRef, useCallback } from "react"
import type { Question } from "@/lib/types"
import {
  XIcon, CheckIcon, AlertTriangleIcon, PlusIcon, TrashIcon,
  ChevronDownIcon, ChevronRightIcon, RefreshCwIcon,
} from "@/components/icons"

// ── Format tips tailored to the Gemini AI pipeline ───────────────────────────
const FORMAT_TIPS = [
  { text: "Use standard numbering (e.g. 1., 2., Q1.) for question stems.", color: "text-emerald-500" },
  { text: "Format options clearly (e.g. A. text, B. text) below the stem.", color: "text-emerald-500" },
  { text: "For clinical vignettes, place the shared passage or table immediately above the group of questions it belongs to.", color: "text-emerald-500" },
  { text: "You can paste medical images (X-rays, ECGs) directly into the Word document next to the relevant text.", color: "text-sky-500" },
  { text: "If answer keys are omitted, questions are imported as Drafts for manual review.", color: "text-violet-500" },
]

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

// ── Word file icon ────────────────────────────────────────────────────────────
function DocxIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <polyline points="8 9 10 13 12 9 14 13 16 9" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </svg>
  )
}

// ── Preview Card (mirrors PDF modal's PreviewCard exactly) ────────────────────
function PreviewCard({ q, index, onRemove }: { q: Question; index: number; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div
        className="flex cursor-pointer items-start gap-2.5 px-4 py-3 hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
        role="button" tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
      >
        <div className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Q{index + 1}</span>
            {q.correctAnswer ? (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{q.correctAnswer}</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">No answer — Draft</span>
            )}
            {q.module && (
              <span className="rounded-full bg-violet-100/80 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{q.module}</span>
            )}
            <span className="rounded-full bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">{q.subject}</span>
          </div>
          <p className="line-clamp-1 text-sm text-foreground">{q.vignette}</p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <TrashIcon size={12} />
        </button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-border bg-muted/20 px-4 py-3">
          <p className="text-xs text-foreground leading-relaxed">{q.vignette}</p>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {q.options.map((o) => (
              <span
                key={o.id}
                className={`text-xs ${o.id === q.correctAnswer ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}
              >
                {o.id}. {o.text}
              </span>
            ))}
          </div>
          {q.explanation?.details && (
            <p className="mt-1 border-t border-border pt-2 text-xs italic text-muted-foreground">{q.explanation.details}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared GeminiQuestion shape returned by /api/parse-docx ──────────────────
interface DocxQuestion {
  contextId?: string | null
  questionType?: string
  subject?: string
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string | null
  explanation: {
    objective: string
    details: string
    incorrectReasoning: string
  } | null
}

function makeQuestion(q: DocxQuestion, index: number, moduleName: string): Question {
  return {
    id: `docx-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    module: moduleName || undefined,
    subject: q.subject?.trim() || moduleName || "Imported",
    vignette: q.vignette,
    options: q.options,
    correctAnswer: q.correctAnswer ?? null,
    explanation: q.explanation ?? null,
    contextId: q.contextId ?? null,
    questionType: (q.questionType as any) ?? "STANDARD_MCQ",
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface WordImportModalProps {
  defaultModule?: string
  onImport: (questions: Question[]) => void
  onClose: () => void
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function WordImportModal({ defaultModule = "", onImport, onClose }: WordImportModalProps) {
  const [step, setStep] = useState<"upload" | "review">("upload")
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([])
  const [moduleName, setModuleName] = useState(defaultModule)
  const [aiParsed, setAiParsed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Please select a .docx Word document.")
      return
    }
    if (file.size > 25 * 1024 * 1024) {
      setError("File too large. Maximum size is 25 MB.")
      return
    }

    setError("")
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      const mod = moduleName.trim() || "Imported Module"
      formData.append("moduleName", mod)

      const res = await fetch("/api/parse-docx", { method: "POST", body: formData })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as any).error ?? `Server error ${res.status}`)
      }

      const data = await res.json() as {
        source: "gemini" | "fallback"
        questions: DocxQuestion[]
        extractedText?: string
      }

      if (!data.questions || data.questions.length === 0) {
        setError("No questions could be extracted. Make sure the document contains numbered MCQ content.")
        return
      }

      const questions = data.questions.map((q, i) => makeQuestion(q, i, mod))
      setParsedQuestions(questions)
      setAiParsed(data.source === "gemini")
      setStep("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process document.")
    } finally {
      setLoading(false)
    }
  }, [moduleName])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (fileInputRef.current) fileInputRef.current.value = ""
    if (file) processFile(file)
  }

  function handleConfirmImport() {
    onImport(parsedQuestions)
    onClose()
  }

  const draftCount = parsedQuestions.filter((q) => !q.correctAnswer).length
  const liveCount = parsedQuestions.length - draftCount

  return (
    <div className="glass-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="glass-modal flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">

        {/* Header */}
        <div className="glass-modal-header flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground">
                {step === "upload" ? "Import from Word (.docx)" : `Review Questions (${parsedQuestions.length})`}
              </h3>
              {step === "review" && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${aiParsed ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                  {aiParsed ? "✦ AI parsed" : "Fallback parsed"}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {step === "upload"
                ? "Gemini AI extracts questions, options, and clinical contexts automatically"
                : "Remove any mis-parsed questions, then confirm import"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {step === "upload" ? (
            <div className="space-y-5 p-6">

              {/* Module name */}
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Module Name{" "}
                  <span className="normal-case font-normal text-muted-foreground/70">
                    (all imported questions will be assigned here)
                  </span>
                </label>
                <input
                  type="text"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="e.g. Level 400 Clinicals"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !loading && fileInputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all
                  ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/20"}
                  ${loading ? "pointer-events-none opacity-70" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {loading ? <Spinner size={28} /> : <DocxIcon size={28} />}
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {loading ? "AI is extracting questions…" : "Drop your Word document here"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {loading
                      ? "Gemini is reading your clinical MCQs — this may take a moment"
                      : "Accepts .docx only · or click to browse"}
                  </p>
                </div>

                {/* Processing pulse dots */}
                {loading && (
                  <div className="flex items-center gap-1.5 mt-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                        style={{ animationDelay: `${i * 200}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangleIcon size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Format tips */}
              <div className="rounded-2xl border border-border bg-muted/30 p-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Format Tips</p>
                <ul className="space-y-2">
                  {FORMAT_TIPS.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                      <CheckIcon size={11} className={`mt-0.5 shrink-0 ${tip.color}`} />
                      {tip.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          ) : (
            <div className="space-y-2 p-6">
              {/* Summary */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {liveCount > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {liveCount} with answer key
                  </span>
                )}
                {draftCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {draftCount} draft — no answer key
                  </span>
                )}
              </div>

              {parsedQuestions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <AlertTriangleIcon size={32} className="text-amber-500" />
                  <p className="font-semibold">All questions removed</p>
                  <button
                    type="button"
                    onClick={() => { setStep("upload"); setError("") }}
                    className="text-sm text-primary hover:underline"
                  >
                    Go back to upload
                  </button>
                </div>
              ) : (
                parsedQuestions.map((q, i) => (
                  <PreviewCard
                    key={q.id}
                    q={q}
                    index={i}
                    onRemove={() => setParsedQuestions((prev) => prev.filter((_, j) => j !== i))}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4">
          {step === "review" ? (
            <>
              <button
                type="button"
                onClick={() => { setStep("upload"); setError("") }}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCwIcon size={13} /> Try another file
              </button>
              <button
                type="button"
                disabled={parsedQuestions.length === 0}
                onClick={handleConfirmImport}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <PlusIcon size={14} />
                Import {parsedQuestions.length} as Draft{parsedQuestions.length !== 1 ? "s" : ""}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="ml-auto rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
