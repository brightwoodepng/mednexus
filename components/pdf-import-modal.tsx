"use client"

import { useState, useRef } from "react"
import type { Question, QuestionOption } from "@/lib/types"
import {
  XIcon, CheckIcon, AlertTriangleIcon, PlusIcon, TrashIcon,
  ChevronDownIcon, ChevronRightIcon, RefreshCwIcon,
} from "@/components/icons"

// ── PDF text extraction (pdfjs-dist, browser-side) ───────────────────────────
async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Reconstruct lines by grouping items with the same Y coordinate
    const yMap = new Map<number, string[]>()
    for (const item of content.items) {
      if ("str" in item) {
        const y = Math.round((item as any).transform[5])
        if (!yMap.has(y)) yMap.set(y, [])
        yMap.get(y)!.push((item as any).str)
      }
    }
    const sortedYs = Array.from(yMap.keys()).sort((a, b) => b - a)
    pages.push(sortedYs.map((y) => yMap.get(y)!.join(" ")).join("\n"))
  }
  return pages.join("\n\n")
}

// ── Parser patterns (each has a human-readable tip) ──────────────────────────
// These are the ACTUAL patterns the parser uses — tips are derived directly from them.
const PARSER_PATTERNS = [
  { re: /^MODULE\s*[:.-]\s*(.+)/i,          tip: 'Start a module section with: MODULE: Module Name on its own line' },
  { re: /^(?:DISCIPLINE|SUBJECT|TOPIC)\s*[:.-]\s*(.+)/i, tip: 'Start a discipline section with: DISCIPLINE: Name (or SUBJECT: / TOPIC:)' },
  { re: /^\s*(\d{1,4})[\.\)]\s+\S/,         tip: 'Number questions as: 1. Question text... or 1) Question text...' },
  { re: /^\s*([A-E])[\.\)]\s+\S/,           tip: 'Format each option as: A. Option text or A) Option text — one per line' },
  { re: /^(?:correct[\s_]?answer|answer|ans)\s*[:.-]?\s*([A-E])/i, tip: 'Mark the correct answer as: Answer: A or Correct Answer: B on its own line' },
  { re: /^(?:explanation|rationale|reason|discussion)\s*[:.-]?\s*/i, tip: 'Add explanation starting with: Explanation: ... or Rationale: ...' },
]

// ── Text parser ──────────────────────────────────────────────────────────────
interface RawQuestion {
  module: string
  discipline: string
  vignette: string
  options: QuestionOption[]
  correctAnswer: string
  explanation: string
}

function parseText(raw: string): RawQuestion[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim())
  const results: RawQuestion[] = []

  let currentModule = ""
  let currentDiscipline = ""
  let pending: Partial<RawQuestion> | null = null
  let pendingOptions: QuestionOption[] = []
  let collectingExplanation = false

  const flush = () => {
    if (pending && pending.vignette && pendingOptions.length >= 2) {
      results.push({
        module: pending.module ?? currentModule,
        discipline: pending.discipline ?? currentDiscipline,
        vignette: pending.vignette,
        options: [...pendingOptions],
        correctAnswer: pending.correctAnswer ?? pendingOptions[0]?.id ?? "A",
        explanation: pending.explanation ?? "",
      })
    }
    pending = null
    pendingOptions = []
    collectingExplanation = false
  }

  for (const line of lines) {
    if (!line) continue

    // Module header
    const modM = PARSER_PATTERNS[0].re.exec(line)
    if (modM) { flush(); currentModule = modM[1].trim(); continue }

    // Discipline header
    const discM = PARSER_PATTERNS[1].re.exec(line)
    if (discM) { flush(); currentDiscipline = discM[1].trim(); continue }

    // Correct answer line
    const ansM = /^(?:correct[\s_]?answer|answer|ans(?:wer)?)\s*[:.-]?\s*([A-E])/i.exec(line)
    if (ansM && pending) { pending.correctAnswer = ansM[1].toUpperCase(); collectingExplanation = false; continue }

    // Explanation line
    const expM = /^(?:explanation|rationale|reason|discussion)\s*[:.-]?\s*(.*)/i.exec(line)
    if (expM && pending) {
      collectingExplanation = true
      pending.explanation = expM[1].trim()
      continue
    }

    // Option line
    const optM = /^\s*([A-E])[\.\)]\s+(.+)/.exec(line)
    if (optM && pending) {
      const id = optM[1].toUpperCase()
      const text = optM[2].trim()
      pendingOptions.push({ id, text })
      collectingExplanation = false
      continue
    }

    // Question number line
    const qM = /^\s*(\d{1,4})[\.\)]\s+(.+)/.exec(line)
    if (qM) {
      flush()
      pending = {
        module: currentModule,
        discipline: currentDiscipline,
        vignette: qM[2].trim(),
        correctAnswer: "A",
        explanation: "",
      }
      continue
    }

    // Continuation of current state
    if (pending) {
      if (collectingExplanation) {
        pending.explanation = (pending.explanation ?? "") + " " + line
      } else if (pendingOptions.length === 0) {
        // Vignette continuation (multi-line question stem)
        pending.vignette = (pending.vignette ?? "") + " " + line
      }
    }
  }

  flush()
  return results
}

// ── Build Question from parsed data ──────────────────────────────────────────
function makeQuestion(r: RawQuestion, index: number): Question {
  return {
    id: `draft-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    module: r.module || undefined,
    subject: r.discipline || r.module || "Imported",
    vignette: r.vignette,
    options: r.options,
    correctAnswer: r.correctAnswer,
    explanation: {
      objective: "",
      details: r.explanation,
      incorrectReasoning: "",
    },
  }
}

// ── Preview Card ─────────────────────────────────────────────────────────────
function PreviewCard({ q, index, onRemove }: { q: Question; index: number; onRemove: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div
        className="flex cursor-pointer items-start gap-2.5 px-4 py-3 hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
        role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
      >
        <div className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDownIcon size={13} /> : <ChevronRightIcon size={13} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Q{index + 1}</span>
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">{q.correctAnswer}</span>
            {q.module && <span className="rounded-full bg-violet-100/80 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{q.module}</span>}
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
              <span key={o.id} className={`text-xs ${o.id === q.correctAnswer ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                {o.id}. {o.text}
              </span>
            ))}
          </div>
          {q.explanation.details && (
            <p className="mt-1 border-t border-border pt-2 text-xs italic text-muted-foreground">{q.explanation.details}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
interface PdfImportModalProps {
  defaultModule?: string
  onImport: (questions: Question[]) => void
  onClose: () => void
}

export function PdfImportModal({ defaultModule = "", onImport, onClose }: PdfImportModalProps) {
  const [step, setStep] = useState<"upload" | "review">("upload")
  const [dragOver, setDragOver] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [showPaste, setShowPaste] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([])
  const [moduleName, setModuleName] = useState(defaultModule)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    setError(""); setProcessing(true)
    try {
      let text = ""
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        text = await extractTextFromPdf(file)
      } else {
        text = await file.text()
      }
      runParser(text)
    } catch (err: any) {
      setError(err?.message ?? "Could not read file. Try pasting the text directly.")
    } finally {
      setProcessing(false)
    }
  }

  function runParser(text: string) {
    setError("")
    const raw = parseText(text)
    if (raw.length === 0) {
      setError("No questions detected. Check the format tips below and try pasting the text directly.")
      return
    }
    const trimmedModule = moduleName.trim()
    const questions = raw.map((r, i) => {
      const q = makeQuestion(r, i)
      if (trimmedModule) q.module = trimmedModule
      return q
    })
    setParsedQuestions(questions)
    setStep("review")
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-bold text-foreground">
              {step === "upload" ? "Import from PDF / Text" : `Review Parsed Questions (${parsedQuestions.length})`}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {step === "upload" ? "Questions will be staged as drafts — review before making them live" : "Remove mis-parsed questions, then confirm"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
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
                  Module Name <span className="normal-case font-normal text-muted-foreground/70">(required — all imported questions will be assigned to this module)</span>
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
                onClick={() => !processing && fileInputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/20"} ${processing ? "pointer-events-none opacity-60" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,application/pdf,text/plain"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); if (fileInputRef.current) fileInputRef.current.value = "" }}
                />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  {processing ? (
                    <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="12" x2="12" y1="18" y2="12"/>
                      <line x1="9" x2="15" y1="15" y2="15"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{processing ? "Extracting text…" : "Drop your PDF or text file here"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{processing ? "Please wait" : "Accepts .pdf and .txt · or click to browse"}</p>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangleIcon size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* Paste fallback */}
              <div>
                <button type="button" onClick={() => setShowPaste((v) => !v)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  {showPaste ? <ChevronDownIcon size={11} /> : <ChevronRightIcon size={11} />}
                  Or paste text directly
                </button>
                {showPaste && (
                  <div className="mt-2 space-y-2">
                    <textarea
                      rows={7}
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      placeholder={"MODULE: Level 400 Clinicals\nDISCIPLINE: Internal Medicine\n\n1. A 45-year-old presents with...\nA. Option A\nB. Option B\nC. Option C\nD. Option D\nAnswer: B\nExplanation: Because..."}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                    />
                    <button
                      type="button"
                      disabled={!pasteText.trim()}
                      onClick={() => runParser(pasteText)}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Parse Text
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic tips — generated directly from PARSER_PATTERNS */}
              <div className="rounded-2xl border border-border bg-muted/30 p-5">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Tips for Best Results</p>
                <ul className="space-y-2">
                  {PARSER_PATTERNS.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                      <CheckIcon size={11} className="mt-0.5 shrink-0 text-emerald-500" />
                      {p.tip}
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckIcon size={11} className="mt-0.5 shrink-0 text-sky-500" />
                    Works best with text-based PDFs (not scanned images or photos)
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-6">
              {parsedQuestions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <AlertTriangleIcon size={32} className="text-amber-500" />
                  <p className="font-semibold">All questions removed</p>
                  <button type="button" onClick={() => setStep("upload")} className="text-sm text-primary hover:underline">Go back to upload</button>
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
              <button type="button" onClick={() => setStep("upload")} className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                <RefreshCwIcon size={13} /> Try another file
              </button>
              <button
                type="button"
                disabled={parsedQuestions.length === 0}
                onClick={() => { onImport(parsedQuestions); onClose() }}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <PlusIcon size={14} />
                Import {parsedQuestions.length} as Draft{parsedQuestions.length !== 1 ? "s" : ""}
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose} className="ml-auto rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
