"use client"

import { useState, useRef } from "react"
import type { Question, QuestionOption } from "@/lib/types"
import {
  XIcon, CheckIcon, AlertTriangleIcon, PlusIcon, TrashIcon,
  ChevronDownIcon, ChevronRightIcon, RefreshCwIcon,
} from "@/components/icons"

// ── Format tips (match what both the regex and Gemini parsers support) ────────
const FORMAT_TIPS = [
  {
    text: 'Start a module section with:  MODULE: Module Name  on its own line',
    color: "text-emerald-500",
  },
  {
    text: 'Start a discipline section with:  DISCIPLINE: Name  (or SUBJECT: / TOPIC:)',
    color: "text-emerald-500",
  },
  {
    text: 'Number questions as:  1.  or  1)  or  Q1.  or  Q1)',
    color: "text-emerald-500",
  },
  {
    text: 'Format options as:  A. text  or  A) text  or  (A) text  — one per line',
    color: "text-emerald-500",
  },
  {
    text: 'Mark the correct answer:  Answer: A  or  Correct Answer: B  or  Key: C',
    color: "text-emerald-500",
  },
  {
    text: 'Add an explanation starting with:  Explanation: …  or  Rationale: …',
    color: "text-emerald-500",
  },
  {
    text: 'For shared clinical vignettes, place the passage immediately above the group of questions it belongs to — Gemini will group them automatically',
    color: "text-sky-500",
  },
  {
    text: 'You can embed images (X-rays, ECGs, tables) directly in the Word document — Gemini reads them as visual context',
    color: "text-sky-500",
  },
  {
    text: 'If answer keys are omitted, questions are imported as Drafts for manual review',
    color: "text-violet-500",
  },
]

// ── Client-side regex fallback (same parser as PDF modal) ─────────────────────
interface RawQuestion {
  module: string
  discipline: string
  vignette: string
  options: QuestionOption[]
  correctAnswer: string
  explanation: string
}

function parseTextFallback(raw: string): RawQuestion[] {
  const lines = raw
    .replace(/--- Page Break ---/gi, "\n")
    .split(/\r?\n/)
    .map((l) => l.trim())
  const results: RawQuestion[] = []

  let currentModule = ""
  let currentDiscipline = ""
  let pending: Partial<RawQuestion> | null = null
  let pendingOptions: QuestionOption[] = []
  let collectingExplanation = false
  let inOptions = false

  const flush = () => {
    if (pending?.vignette && pendingOptions.length >= 2) {
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
    inOptions = false
  }

  const optPattern = /^(?:\(([A-Ea-e])\)|([A-Ea-e])[.):\-])[ \t]*(.+)$/
  const ansPattern = /^(?:correct[\s_]?answer|answer|ans(?:wer)?|key)[\s.:—-]*([A-Ea-e])\b/i
  const explPattern = /^(?:explanation|rationale|discussion|reason|solution)[.:\s—-]/i

  for (const line of lines) {
    if (!line) continue

    const modM = /^MODULE\s*[:.-]\s*(.+)/i.exec(line)
    if (modM) { flush(); currentModule = modM[1].trim(); continue }

    const discM = /^(?:DISCIPLINE|SUBJECT|TOPIC)\s*[:.-]\s*(.+)/i.exec(line)
    if (discM) { flush(); currentDiscipline = discM[1].trim(); continue }

    const ansM = ansPattern.exec(line)
    if (ansM && pending) {
      pending.correctAnswer = ansM[1].toUpperCase()
      collectingExplanation = false
      continue
    }

    const expM = explPattern.exec(line)
    if (expM && pending) {
      collectingExplanation = true
      pending.explanation = line.replace(explPattern, "").trim()
      continue
    }

    const optM = optPattern.exec(line)
    if (optM && (pending || inOptions)) {
      inOptions = true
      const id = (optM[1] ?? optM[2]).toUpperCase()
      const text = optM[3].trim()
      if (!pendingOptions.find((o) => o.id === id)) pendingOptions.push({ id, text })
      collectingExplanation = false
      continue
    }

    if (inOptions && pendingOptions.length > 0 && pending && !collectingExplanation) {
      if (!/^(?:Question\s+|Q\.?\s*)?\d{1,4}[.):\s]/.test(line)) {
        pendingOptions[pendingOptions.length - 1].text += " " + line
        continue
      }
    }

    const qM = /^(?:Question\s+|Q\.?\s*)?(\d{1,4})[.):\s]+(.+)/.exec(line)
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

    if (pending) {
      if (collectingExplanation) {
        pending.explanation = (pending.explanation ?? "") + " " + line
      } else if (!inOptions) {
        pending.vignette = (pending.vignette ?? "") + " " + line
      }
    }
  }

  flush()
  return results
}

// ── Build Question from Gemini output ────────────────────────────────────────
interface ServerContext {
  id: string
  type: string
  content: string
}

interface ServerQuestion {
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

function makeQuestionFromServer(
  q: ServerQuestion,
  index: number,
  moduleName: string,
  contextMap: Map<string, string>,
): Question {
  const ctxId = q.contextId ?? null
  return {
    id: `docx-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    module: moduleName || undefined,
    subject: q.subject?.trim() || moduleName || "Imported",
    vignette: q.vignette,
    options: q.options,
    correctAnswer: q.correctAnswer ?? null,
    explanation: q.explanation ?? null,
    contextId: ctxId,
    // Denormalize the shared context content so the quiz/exam can render it
    // without a separate fetch — same pattern used by the live assessment flow.
    contextContent: ctxId ? (contextMap.get(ctxId) ?? null) : null,
    questionType: (q.questionType as any) ?? "STANDARD_MCQ",
  }
}

function makeQuestionFromRaw(r: RawQuestion, index: number, moduleName: string): Question {
  return {
    id: `docx-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    module: r.module || moduleName || undefined,
    subject: r.discipline || r.module || moduleName || "Imported",
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

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

// ── Preview Card (mirrors PDF modal exactly) ──────────────────────────────────
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
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Draft — no answer key</span>
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

// ── Parse step labels ─────────────────────────────────────────────────────────
type ParseStep = "idle" | "uploading" | "parsing-ai" | "parsing-regex"
const parseStatusLabel: Record<ParseStep, string> = {
  idle: "",
  uploading: "Extracting document content…",
  "parsing-ai": "AI is reading your questions…",
  "parsing-regex": "Parsing with fallback parser…",
}

// ── Source badge config ───────────────────────────────────────────────────────
type ParseSource = "ai" | "regex" | null
const sourceLabel: Record<string, { label: string; color: string }> = {
  ai: { label: "✦ AI parsed", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" },
  regex: { label: "Fallback parsed", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
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
  const [parseStep, setParseStep] = useState<ParseStep>("idle")
  const [error, setError] = useState("")
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([])
  const [moduleName, setModuleName] = useState(defaultModule)
  const [parseSource, setParseSource] = useState<ParseSource>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isProcessing = parseStep !== "idle"

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Please select a .docx Word document.")
      return
    }

    setError("")
    const mod = moduleName.trim() || "Imported Module"

    try {
      setParseStep("uploading")
      const formData = new FormData()
      formData.append("file", file)
      formData.append("moduleName", mod)

      const res = await fetch("/api/parse-docx", { method: "POST", body: formData })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as any).error ?? `Server error ${res.status}`)
      }

      const data = await res.json() as {
        source: "gemini" | "fallback"
        questions?: ServerQuestion[]
        contexts?: ServerContext[]
        extractedText?: string
      }

      // ── Gemini succeeded (or server-side fallback returned structured data) ──
      if (data.source === "gemini" && data.questions && data.questions.length > 0) {
        setParseStep("parsing-ai")
        // Build contextId → content map so each question gets its shared passage/table/image
        const contextMap = new Map<string, string>(
          (data.contexts ?? []).map((c) => [c.id, c.content])
        )
        const questions = data.questions.map((q, i) => makeQuestionFromServer(q, i, mod, contextMap))
        setParsedQuestions(questions)
        setParseSource("ai")
        setStep("review")
        return
      }

      // ── Gemini unavailable — use returned extractedText with client regex ──
      setParseStep("parsing-regex")
      const text = data.extractedText ?? ""
      if (!text.trim()) {
        setError("The document appears to be empty or could not be read.")
        return
      }

      const raw = parseTextFallback(text)
      if (raw.length === 0) {
        setError(
          "No questions detected. Check the format tips below — make sure questions are numbered (1., Q1., etc.) and options are labelled (A., B., etc.)."
        )
        return
      }

      const questions = raw.map((r, i) => makeQuestionFromRaw(r, i, mod))
      setParsedQuestions(questions)
      setParseSource("regex")
      setStep("review")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process document.")
    } finally {
      setParseStep("idle")
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const src = parseSource ? sourceLabel[parseSource] : null

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
              {step === "review" && src && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${src.color}`}>{src.label}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {step === "upload"
                ? "Imported questions are staged as drafts — review before publishing"
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
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all
                  ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/20"}
                  ${isProcessing ? "pointer-events-none opacity-70" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) processFile(f)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }}
                />

                {/* Icon */}
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  {isProcessing ? <Spinner size={28} /> : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <polyline points="8 9 10 13 12 9 14 13 16 9"/>
                      <line x1="8" y1="17" x2="14" y2="17"/>
                    </svg>
                  )}
                </div>

                <div>
                  <p className="font-semibold text-foreground">
                    {isProcessing ? parseStatusLabel[parseStep] : "Drop your Word document here"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isProcessing
                      ? parseStep === "parsing-ai"
                        ? "Gemini is reading your clinical MCQs — this may take a moment"
                        : "Please wait…"
                      : "Accepts .docx only · or click to browse"}
                  </p>
                </div>

                {/* Progress dots */}
                {isProcessing && (
                  <div className="flex items-center gap-2 mt-1">
                    {(["uploading", "parsing-ai", "parsing-regex"] as ParseStep[]).map((s) => (
                      <div
                        key={s}
                        className={`h-1.5 rounded-full transition-all ${parseStep === s ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
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

                {/* Sample structure */}
                <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Example Structure</p>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/70">{`MODULE: Internal Medicine
DISCIPLINE: Cardiology

1. A 55-year-old man presents with crushing chest pain…
A. ST-elevation myocardial infarction
B. Unstable angina
C. Aortic dissection
D. Pulmonary embolism
Answer: A
Explanation: Elevated troponin and ST changes confirm…

2. Which finding best supports the diagnosis?
A. Troponin I > 2.0 ng/mL
B. Normal ECG
C. SpO₂ of 99%
D. Clear lung fields
Answer: A`}</pre>
                </div>
              </div>
            </div>

          ) : (
            <div className="space-y-2 p-6">
              {parsedQuestions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <AlertTriangleIcon size={32} className="text-amber-500" />
                  <p className="font-semibold">All questions removed</p>
                  <button
                    type="button"
                    onClick={() => { setStep("upload"); setParseSource(null) }}
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
                onClick={() => { setStep("upload"); setParseSource(null) }}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
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
