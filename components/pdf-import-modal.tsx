"use client"

import { useState, useRef, useCallback } from "react"
import type { Question } from "@/lib/types"
import {
  XIcon,
  CheckIcon,
  AlertTriangleIcon,
  PlusIcon,
  TrashIcon,
  RefreshCwIcon,
} from "@/components/icons"

// ── Icons inline ─────────────────────────────────────────────────────────────
function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ParsedQuestion {
  subject: string
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string
  explanation: { objective: string; details: string; incorrectReasoning: string }
}

type ImportStep = "upload" | "parsing" | "review" | "done"

interface PdfImportModalProps {
  defaultModule: string
  onImport: (questions: Question[]) => void
  onClose: () => void
}

function generateId() {
  return `q-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Step 1: Upload ────────────────────────────────────────────────────────────
function UploadStep({
  moduleName,
  onModuleChange,
  onFileSelect,
  error,
}: {
  moduleName: string
  onModuleChange: (v: string) => void
  onFileSelect: (f: File) => void
  error: string
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file?.type === "application/pdf") onFileSelect(file)
    },
    [onFileSelect],
  )

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Target Module / Subject
        </label>
        <input
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={moduleName}
          onChange={(e) => onModuleChange(e.target.value)}
          placeholder="e.g. Cardiology"
        />
        <p className="mt-1 text-xs text-muted-foreground">Questions will be imported into this module. Creates a new one if it doesn't exist.</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-12 px-6 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <div className="text-muted-foreground">
          <UploadIcon />
        </div>
        <div>
          <p className="font-semibold text-foreground">Drop your PDF here</p>
          <p className="mt-0.5 text-sm text-muted-foreground">or click to browse</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">PDF only · up to 10 MB</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelect(file)
        }}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangleIcon size={16} />
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground text-xs uppercase tracking-wide">Tips for best results</p>
        <p>• Works best with text-based PDFs (not scanned images)</p>
        <p>• Questions should be numbered (1., Q1., etc.)</p>
        <p>• Options labeled A. B. C. D. (or A) B) C) D))</p>
        <p>• Answer line: "Answer: B" or "Correct answer: B"</p>
        <p>• Explanation below the answer line</p>
      </div>
    </div>
  )
}

// ── Step 2: Review ────────────────────────────────────────────────────────────
function ReviewStep({
  questions,
  source,
  onToggle,
  selected,
  onRemove,
}: {
  questions: ParsedQuestion[]
  source: string
  onToggle: (i: number) => void
  selected: Set<number>
  onRemove: (i: number) => void
}) {
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <AlertTriangleIcon size={24} />
        </div>
        <div>
          <p className="font-semibold text-foreground">No questions detected</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The PDF format wasn't recognized. Try a PDF with clearly numbered MCQs.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">{questions.length} question{questions.length !== 1 ? "s" : ""} detected</p>
          <p className="text-xs text-muted-foreground">
            {source === "ai" ? "✨ Parsed with AI" : "Parsed with pattern recognition"} · {selected.size} selected for import
          </p>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
        {questions.map((q, i) => (
          <div
            key={i}
            className={`rounded-2xl border p-4 transition-colors ${
              selected.has(i) ? "border-primary/30 bg-primary/5" : "border-border bg-card opacity-60"
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => onToggle(i)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                  selected.has(i) ? "bg-primary border-primary text-primary-foreground" : "border-border"
                }`}
              >
                {selected.has(i) && <CheckIcon size={11} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Q{i + 1}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    {q.correctAnswer}
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {q.subject}
                  </span>
                </div>
                <p className="text-sm text-foreground line-clamp-2">{q.vignette}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {q.options.map((o) => (
                    <span
                      key={o.id}
                      className={`text-xs ${o.id === q.correctAnswer ? "font-semibold text-emerald-700" : "text-muted-foreground"}`}
                    >
                      {o.id}. {o.text.slice(0, 35)}{o.text.length > 35 ? "…" : ""}
                    </span>
                  ))}
                </div>
                {q.explanation.details && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2 italic">
                    {q.explanation.details}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <TrashIcon size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export function PdfImportModal({ defaultModule, onImport, onClose }: PdfImportModalProps) {
  const [step, setStep] = useState<ImportStep>("upload")
  const [moduleName, setModuleName] = useState(defaultModule)
  const [error, setError] = useState("")
  const [fileName, setFileName] = useState("")
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([])
  const [parseSource, setParseSource] = useState<string>("regex")
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [removedIndices, setRemovedIndices] = useState<Set<number>>(new Set())
  const [progress, setProgress] = useState("")

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (file.size > 10 * 1024 * 1024) {
        setError("File too large. Please use a PDF under 10 MB.")
        return
      }
      setError("")
      setFileName(file.name)
      setStep("parsing")
      setProgress("Extracting text from PDF…")

      try {
        // Dynamic import to avoid SSR issues
        const { extractTextFromPdf } = await import("@/lib/pdf-extract")
        const { text, pageCount } = await extractTextFromPdf(file)
        setProgress(`Extracted ${pageCount} page${pageCount !== 1 ? "s" : ""}. Parsing questions…`)

        if (!text.trim()) {
          setError("Could not extract text. The PDF may be scanned/image-based.")
          setStep("upload")
          return
        }

        const res = await fetch("/api/parse-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, moduleName: moduleName.trim() || "Imported Module" }),
        })

        if (!res.ok) throw new Error("Parse API failed")
        const data = await res.json()

        const questions: ParsedQuestion[] = data.questions ?? []
        setParsedQuestions(questions)
        setParseSource(data.source ?? "regex")
        setSelected(new Set(questions.map((_, i) => i)))
        setRemovedIndices(new Set())
        setStep("review")
      } catch (err) {
        console.error(err)
        setError("Failed to process PDF. Please try again.")
        setStep("upload")
      }
    },
    [moduleName],
  )

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function removeQuestion(i: number) {
    setRemovedIndices((prev) => new Set([...prev, i]))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(i)
      return next
    })
  }

  const visibleQuestions = parsedQuestions.filter((_, i) => !removedIndices.has(i))
  const visibleSelected = new Set(
    [...selected].filter((i) => !removedIndices.has(i)).map((origIdx) => {
      return visibleQuestions.indexOf(parsedQuestions[origIdx])
    }),
  )

  function handleImport() {
    const toImport = parsedQuestions
      .filter((_, i) => selected.has(i) && !removedIndices.has(i))
      .map((q) => ({
        id: generateId(),
        subject: moduleName.trim() || q.subject || "Imported Module",
        vignette: q.vignette,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      }))

    onImport(toImport)
    setStep("done")
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 backdrop-blur-sm p-4 pt-8 pb-8">
      <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h3 className="font-bold text-foreground">Import from PDF</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {step === "upload" && "Upload a PDF with MCQ questions"}
              {step === "parsing" && `Processing "${fileName}"…`}
              {step === "review" && `Review parsed questions from "${fileName}"`}
              {step === "done" && "Import complete!"}
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
        <div className="p-6">
          {step === "upload" && (
            <UploadStep
              moduleName={moduleName}
              onModuleChange={setModuleName}
              onFileSelect={handleFileSelect}
              error={error}
            />
          )}

          {step === "parsing" && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <SpinnerIcon />
              <p className="text-sm text-muted-foreground">{progress}</p>
            </div>
          )}

          {step === "review" && (
            <ReviewStep
              questions={visibleQuestions}
              source={parseSource}
              selected={visibleSelected}
              onToggle={(i) => {
                const origIdx = parsedQuestions.indexOf(visibleQuestions[i])
                toggleSelect(origIdx)
              }}
              onRemove={(i) => {
                const origIdx = parsedQuestions.indexOf(visibleQuestions[i])
                removeQuestion(origIdx)
              }}
            />
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CheckIcon size={28} />
              </div>
              <div>
                <p className="font-bold text-foreground text-lg">Questions imported!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.size} question{selected.size !== 1 ? "s" : ""} added to "{moduleName}"
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === "review" && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={() => { setStep("upload"); setError("") }}
              className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <RefreshCwIcon size={14} />
              Try another file
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {[...selected].filter((i) => !removedIndices.has(i)).length} selected
              </span>
              <button
                type="button"
                onClick={handleImport}
                disabled={[...selected].filter((i) => !removedIndices.has(i)).length === 0}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusIcon size={14} />
                Import {[...selected].filter((i) => !removedIndices.has(i)).length} Question{[...selected].filter((i) => !removedIndices.has(i)).length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
