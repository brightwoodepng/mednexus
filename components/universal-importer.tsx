"use client"

import { useState, useRef, useCallback } from "react"
import { useQuestions } from "@/contexts/questions-context"
import type { Question, QuestionOption } from "@/lib/types"
import type { ImportExtractionSummary } from "@/lib/import-types"
import { findImportQuestionDuplicates } from "@/lib/game-question-pool"
import { importAuthHeaders, importError } from "@/lib/import-client"
import { parseMednexusText } from "@/lib/mednexus-text-parser"
import {
  PLAIN_TEXT_IMPORT_CHAR_LIMIT,
  plainTextImportFileType,
  readPlainTextImportFile,
  type PlainTextImportFileType,
} from "@/lib/plain-text-import"
import {
  createResumableBatches,
  deleteImportSession,
  failedQuestionRanges,
  fingerprintFile,
  loadImportSession,
  mergeCompletedBatchQuestions,
  runWithImportRetry,
  saveImportSession,
  stableImportQuestionId,
  type ImportSourceImage,
  type ResumableImportBatch,
  type ResumableImportSession,
} from "@/lib/resumable-import"
import {
  XIcon,
  CheckIcon,
  AlertTriangleIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshCwIcon,
  DownloadIcon,
  UploadIcon,
  ArrowUpDownIcon,
  ImageIcon,
  InfoIcon,
  HashIcon,
  ListChecksIcon,
  BookOpenIcon,
  ClipboardListIcon,
} from "@/components/icons"

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 20 }: { size?: number }) {
  return (
    <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

// ── Question-block splitter + 25-question batcher ────────────────────────────
const QUESTION_BOUNDARY = /^(?:(?:Question\s+|Q\.?\s*)?\d{1,4}[.):\s]|\(\d{1,4}\))/i

function countNumberedQuestions(text: string): number {
  return text
    .split(/\r?\n/)
    .filter((line) => QUESTION_BOUNDARY.test(line.trimStart()))
    .length
}

// Splits a document into individual question blocks (one per numbered question),
// then groups them into batches of `batchSize`. Any preamble text (MODULE:,
// DISCIPLINE: tags before the first question) is prepended to the first batch.
// Returns [] if no numbered questions are detected (caller falls back to word-chunking).
function splitIntoQuestionBatches(text: string, batchSize = 25): string[] {
  const lines = text.split(/\r?\n/)
  const questionBlocks: string[] = []
  let preamble = ""
  let current = ""
  let inQuestion = false

  for (const line of lines) {
    if (QUESTION_BOUNDARY.test(line.trimStart())) {
      if (current.trim()) questionBlocks.push(current)
      // Prepend preamble (MODULE/DISCIPLINE tags before Q1) into the first block
      current = (!inQuestion && preamble ? preamble : "") + line + "\n"
      preamble = ""
      inQuestion = true
    } else {
      if (inQuestion) {
        current += line + "\n"
      } else {
        preamble += line + "\n"
      }
    }
  }
  if (current.trim()) questionBlocks.push(current)
  if (questionBlocks.length === 0) return []

  // Group individual question blocks into batches of batchSize
  const batches: string[] = []
  for (let i = 0; i < questionBlocks.length; i += batchSize) {
    batches.push(questionBlocks.slice(i, i + batchSize).join("\n"))
  }
  return batches
}

// ── Word-count fallback chunker (used when no Q-boundaries found) ─────────────
function chunkText(text: string, targetWords = 1500): string[] {
  const Q_BOUNDARY = /^(?:(?:Question\s+|Q\.?\s*)?\d{1,4}[.):\s]|\(\d{1,4}\))/i
  const lines = text.split(/\r?\n/)
  const chunks: string[] = []
  let current = ""
  let wordCount = 0
  for (const line of lines) {
    const words = line.split(/\s+/).filter(Boolean).length
    if (wordCount >= targetWords && Q_BOUNDARY.test(line.trimStart()) && current) {
      chunks.push(current)
      current = ""
      wordCount = 0
    }
    current += line + "\n"
    wordCount += words
  }
  if (current.trim()) chunks.push(current)
  return chunks.filter((c) => c.trim())
}

// ── Regex fallback parser ─────────────────────────────────────────────────────
interface RawQuestion {
  module: string
  discipline: string
  vignette: string
  options: QuestionOption[]
  correctAnswer: string
  explanation: string
}

function parseTextFallback(
  raw: string,
  fallbackModule: string | null = null,
  fallbackDiscipline: string | null = null,
): RawQuestion[] {
  return parseMednexusText(raw, fallbackModule, fallbackDiscipline).map((question) => ({
    module: question.module,
    discipline: question.discipline,
    vignette: question.vignette,
    options: question.options,
    correctAnswer: question.correctAnswer ?? "",
    explanation: question.explanation ?? "",
  }))
}

// ── Question builders ─────────────────────────────────────────────────────────
interface ChunkQuestion {
  module?: string
  discipline?: string
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string | null
  explanation: string | null
  mediaBase64?: string | null
}

function makeFromChunk(
  q: ChunkQuestion,
  index: number,
  fallbackModule: string | null,
  stableId?: string,
  fallbackDiscipline?: string | null,
): Question {
  return {
    id: stableId ?? `import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    module: q.module?.trim() || fallbackModule || undefined,
    subject: q.discipline?.trim() || fallbackDiscipline || "",
    vignette: q.vignette,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation ? { objective: "", details: q.explanation, incorrectReasoning: "" } : null,
    questionType: "STANDARD_MCQ",
    mediaBase64: q.mediaBase64 ?? null,
  }
}

function makeFromRaw(r: RawQuestion, index: number, fallbackModule: string | null): Question {
  return {
    id: `import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    module: r.module || fallbackModule || undefined,
    subject: r.discipline || "",
    vignette: r.vignette,
    options: r.options,
    correctAnswer: r.correctAnswer,
    explanation: { objective: "", details: r.explanation, incorrectReasoning: "" },
    questionType: "STANDARD_MCQ",
    mediaBase64: null,
  }
}

// ── Preview Card ──────────────────────────────────────────────────────────────
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
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Draft</span>
            )}
            {q.module && (
              <span className="rounded-full bg-violet-100/80 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{q.module}</span>
            )}
            {q.subject && (
              <span className="rounded-full bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">{q.subject}</span>
            )}
            {q.mediaBase64 && (
              <span className="flex items-center gap-0.5 rounded-full bg-orange-100/80 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <ImageIcon size={9} />
                img
              </span>
            )}
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
        <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-3">
          {/* Image */}
          {q.mediaBase64 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <img
                src={q.mediaBase64}
                alt="Embedded diagram"
                className="max-h-48 w-full object-contain bg-white"
              />
            </div>
          )}
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

interface ImportReviewSummary extends ImportExtractionSummary {
  detectedQuestions: number | null
  processingBatches: number
}

function ImportSummaryPanel({ summary }: { summary: ImportReviewSummary }) {
  const metrics = [
    {
      label: "Questions detected",
      value: summary.detectedQuestions === null ? "Not numbered" : summary.detectedQuestions.toLocaleString("en-US"),
      icon: <ListChecksIcon size={13} />,
    },
    {
      label: "Images detected",
      value: summary.imageCount.toLocaleString("en-US"),
      icon: <ImageIcon size={13} />,
    },
    {
      label: "Processing batches",
      value: summary.processingBatches.toLocaleString("en-US"),
      icon: <ClipboardListIcon size={13} />,
    },
    {
      label: "Import capacity",
      value: summary.withinLimits ? "Within limits" : "Exceeds limits",
      icon: summary.withinLimits ? <CheckIcon size={13} /> : <AlertTriangleIcon size={13} />,
    },
  ]

  return (
    <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/70 p-3 dark:border-emerald-800/50 dark:bg-emerald-950/20">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-emerald-200/70 bg-background/70 px-2.5 py-2 dark:border-emerald-900/50">
            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              {metric.icon}
              <span className="text-[10px] font-semibold uppercase tracking-wide">{metric.label}</span>
            </div>
            <p className="mt-1 text-sm font-bold text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
        {summary.textChars.toLocaleString("en-US")} of {summary.limits.textChars.toLocaleString("en-US")} characters ·{" "}
        {summary.imageCount.toLocaleString("en-US")} of {summary.limits.imageCount.toLocaleString("en-US")} images
      </p>
    </div>
  )
}

function BatchRecoveryPanel({
  batches,
  isProcessing,
  onRetryFailed,
}: {
  batches: ResumableImportBatch[]
  isProcessing: boolean
  onRetryFailed: () => void
}) {
  const completed = batches.filter((batch) => batch.status === "completed").length
  const failed = batches.filter((batch) => batch.status === "failed")
  const ranges = failedQuestionRanges(batches)
  const statusStyle: Record<ResumableImportBatch["status"], string> = {
    waiting: "bg-muted text-muted-foreground",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    retrying: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {completed} of {batches.length} batches completed
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {failed.length > 0
              ? `Missing question range${ranges.length === 1 ? "" : "s"}: ${ranges.join(", ")}`
              : "All recovered questions are in their original order."}
          </p>
        </div>
        {failed.length > 0 && (
          <button
            type="button"
            disabled={isProcessing}
            onClick={onRetryFailed}
            className="flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? <Spinner size={13} /> : <RefreshCwIcon size={13} />}
            Retry failed batches
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {batches.map((batch) => (
          <div key={batch.index} className="rounded-lg border border-border bg-background px-2 py-1.5" title={batch.error ?? undefined}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-foreground">
                Batch {batch.index + 1}
                {batch.startQuestion !== batch.endQuestion && (
                  <span className="ml-1 text-muted-foreground">Q{batch.startQuestion}–{batch.endQuestion}</span>
                )}
              </span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${statusStyle[batch.status]}`}>
                {batch.status}
              </span>
            </div>
            {batch.status === "failed" && batch.error && (
              <p className="mt-1 line-clamp-1 text-[9px] text-destructive">{batch.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface UniversalImporterProps {
  onImport: (questions: Question[]) => void
  onClose: () => void
}

// ── Main Component ────────────────────────────────────────────────────────────
export function UniversalImporter({ onImport, onClose }: UniversalImporterProps) {
  const { questions: liveQuestions } = useQuestions()

  const [view, setView] = useState<"input" | "categorize" | "preview">("input")
  const [dragOver, setDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressMessage, setProgressMessage] = useState("")
  const [error, setError] = useState("")
  const [textInput, setTextInput] = useState("")
  const [pendingImport, setPendingImport] = useState<Question[]>([])
  const [parseSource, setParseSource] = useState<"ai" | "regex" | "json" | null>(null)
  const [partialImportWarning, setPartialImportWarning] = useState("")
  const [importSummary, setImportSummary] = useState<ImportReviewSummary | null>(null)
  const [importSession, setImportSession] = useState<ResumableImportSession | null>(null)

  // ── Categorization gate ──────────────────────────────────────────────────────
  const [rawMaster, setRawMaster] = useState<Question[]>([])
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [categorizeModule, setCategorizeModule] = useState("")
  const [categorizeDiscipline, setCategorizeDiscipline] = useState("")

  // ── Copyable AI formatting prompt ─────────────────────────────────────────────
  const [rulesCopied, setRulesCopied] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Export JSON ─────────────────────────────────────────────────────────────
  function handleExport() {
    const date = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(liveQuestions, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mednexus-questions-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Stage questions for preview ─────────────────────────────────────────────
  function stageQuestions(qs: Question[], source: "ai" | "regex" | "json") {
    const duplicates = findImportQuestionDuplicates(qs, liveQuestions)
    if (duplicates.duplicateCount > 0) {
      setPartialImportWarning((current) => [
        current,
        `${duplicates.duplicateCount} materially identical question${duplicates.duplicateCount === 1 ? "" : "s"} detected within this import or the existing bank. Review or remove duplicate content before publishing.`,
      ].filter(Boolean).join(" "))
      console.warn("[mcq-import] Material duplicates detected", { count: duplicates.duplicateCount })
    }
    setPendingImport(qs)
    setParseSource(source)
    setView("preview")
  }

  // ── JSON file handler ───────────────────────────────────────────────────────
  function processJsonFile(file: File) {
    setImportSummary(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(parsed)) throw new Error("File must contain a JSON array.")
        if (parsed.length === 0) throw new Error("The file contains no questions.")
        const invalid = parsed.find((q: unknown) => typeof (q as Question).vignette !== "string" || !Array.isArray((q as Question).options))
        if (invalid) throw new Error("One or more questions have an invalid format.")
        // Ensure IDs
        const withIds: Question[] = parsed.map((q: Question) => ({
          ...q,
          id: q.id || `json-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        }))
        stageQuestions(withIds, "json")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid JSON file.")
      }
    }
    reader.readAsText(file)
  }

  function setSummaryFromSession(session: ResumableImportSession) {
    if (!session.summary) {
      setImportSummary(null)
      return
    }
    setImportSummary({
      ...session.summary,
      detectedQuestions: session.usingQuestionBatches
        ? session.batches.reduce((total, batch) => total + countNumberedQuestions(batch.text), 0)
        : null,
      processingBatches: session.batches.length,
    })
  }

  async function persistSession(session: ResumableImportSession) {
    try {
      await saveImportSession(session)
    } catch (storageError) {
      console.warn("[mcq-import] Browser recovery state could not be saved", storageError)
    }
  }

  function finalizeBatchSession(session: ResumableImportSession) {
    const master = mergeCompletedBatchQuestions(session.batches)
    const failed = session.batches.filter((batch) => batch.status === "failed")
    setImportSession({ ...session, batches: session.batches.map((batch) => ({ ...batch })) })
    setIsProcessing(false)
    setProgressMessage("")

    if (failed.length > 0) {
      const ranges = failedQuestionRanges(session.batches)
      setPartialImportWarning(
        `${failed.length} of ${session.batches.length} batches failed after three attempts. ` +
        `${master.length} questions were safely retained. Missing question range${ranges.length === 1 ? "" : "s"}: ${ranges.join(", ")}.`
      )
      stageQuestions(master, "ai")
      return
    }

    setPartialImportWarning("")
    if (master.length === 0) {
      const raw = parseTextFallback(session.batches.map((batch) => batch.text).join("\n"))
      if (raw.length === 0) {
        setError("No questions detected. Check that questions are numbered (1., Q1.) and options are labelled (A., B., etc.).")
        setView("input")
        return
      }
      stageQuestions(raw.map((question, index) => makeFromRaw(question, index, null)), "regex")
      return
    }

    const uncategorized = master.filter((question) => !question.module || !question.subject)
    if (uncategorized.length > 0) {
      setRawMaster(master)
      setUncategorizedCount(uncategorized.length)
      setCategorizeModule("")
      setCategorizeDiscipline("")
      setView("categorize")
      return
    }
    stageQuestions(master, "ai")
  }

  async function runBatchSession(session: ResumableImportSession, batchIndexes: number[]) {
    const working: ResumableImportSession = {
      ...session,
      batches: session.batches.map((batch) => ({ ...batch, questions: [...batch.questions] })),
    }
    const imageMap = new Map(working.images.map((image) => [image.id, image.dataUri]))
    setImportSession(working)
    setView("preview")
    setIsProcessing(true)
    setError("")

    for (const batchIndex of batchIndexes) {
      const batch = working.batches[batchIndex]
      const batchImages = working.images.filter((image) => batch.text.includes(`[${image.id}]`))
      const expectedQuestions = working.usingQuestionBatches
        ? countNumberedQuestions(batch.text)
        : 0
      const structuredQuestions = parseMednexusText(
        batch.text,
        batch.fallbackModule,
        batch.fallbackDiscipline,
      )

      try {
        let chunkQuestions: ChunkQuestion[]
        if (expectedQuestions > 0 && structuredQuestions.length === expectedQuestions) {
          batch.status = "processing"
          batch.attempts = 1
          batch.error = null
          batch.source = "structured"
          setProgressMessage(
            `Reading formatted batch ${batch.index + 1} of ${working.batches.length}` +
            ` (questions ${batch.startQuestion}–${batch.endQuestion})…`
          )
          setImportSession({ ...working, batches: working.batches.map((item) => ({ ...item })) })
          chunkQuestions = structuredQuestions.map((question) => ({
            module: question.module,
            discipline: question.discipline,
            vignette: question.vignette,
            options: question.options,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            mediaBase64: null,
          }))
        } else {
          batch.source = "ai"
          chunkQuestions = await runWithImportRetry(
            async () => {
              const response = await fetch("/api/extract-single-chunk", {
                method: "POST",
                headers: importAuthHeaders(true),
                body: JSON.stringify({
                  textChunk: batch.text,
                  fallbackModule: batch.fallbackModule,
                  fallbackDiscipline: batch.fallbackDiscipline,
                  images: batchImages,
                }),
              })
              if (!response.ok) throw new Error(await importError(response))
              const data = await response.json() as { questions?: ChunkQuestion[] }
              if (!data.questions?.length) throw new Error("No questions were returned for this batch.")
              return data.questions
            },
            (attempt) => {
              batch.status = attempt === 1 ? "processing" : "retrying"
              batch.attempts = attempt
              batch.error = null
              setProgressMessage(
                `${attempt === 1 ? "Processing" : `Retrying (attempt ${attempt} of 3)`} batch ${batch.index + 1} of ${working.batches.length}` +
                (working.usingQuestionBatches ? ` (questions ${batch.startQuestion}–${batch.endQuestion})…` : "…")
              )
              setImportSession({ ...working, batches: working.batches.map((item) => ({ ...item })) })
            },
          )
        }

        const questionImageMap = new Map<number, string>()
        const questionBoundaryGlobal = /^(?:(?:Question\s+|Q\.?\s*)?\d{1,4}[.):\s]|\(\d{1,4}\))/gim
        for (const match of batch.text.matchAll(/\[IMAGE_(\d+)\]/g)) {
          const imageDataUri = imageMap.get(`IMAGE_${match[1]}`)
          if (!imageDataUri) continue
          const textBefore = batch.text.slice(0, match.index ?? 0)
          const questionIndex = Math.max(0, [...textBefore.matchAll(questionBoundaryGlobal)].length - 1)
          if (!questionImageMap.has(questionIndex)) questionImageMap.set(questionIndex, imageDataUri)
        }

        batch.questions = chunkQuestions.map((chunkQuestion, questionIndex) => {
          const question = makeFromChunk(
            chunkQuestion,
            questionIndex,
            batch.fallbackModule,
            stableImportQuestionId(
              working.fingerprint,
              batch.index,
              questionIndex,
              batch.startQuestion + questionIndex,
            ),
            batch.fallbackDiscipline,
          )
          question.vignette = question.vignette.replace(/\[IMAGE_\d+\]/gi, "").replace(/\s{2,}/g, " ").trim()
          if (!question.mediaBase64) question.mediaBase64 = questionImageMap.get(questionIndex) ?? null
          return question
        })
        batch.status = "completed"
        batch.error = null
      } catch (batchError) {
        batch.status = "failed"
        batch.questions = []
        batch.error = batchError instanceof Error ? batchError.message : "Batch processing failed."
      }

      working.updatedAt = new Date().toISOString()
      setImportSession({ ...working, batches: working.batches.map((item) => ({ ...item })) })
      await persistSession(working)
    }

    finalizeBatchSession(working)
  }

  async function processDocumentFile(file: File, fileType: "docx" | "pdf" | PlainTextImportFileType) {
    setError("")
    setPartialImportWarning("")
    setImportSummary(null)
    setImportSession(null)
    setIsProcessing(true)
    setProgressMessage("Checking for an unfinished import…")

    try {
      const fingerprint = await fingerprintFile(file)
      const recovered = await loadImportSession(fingerprint).catch(() => null)
      if (recovered?.version === 1 && recovered.batches.length > 0) {
        const completed = recovered.batches.filter((batch) => batch.status === "completed").length
        const shouldResume = window.confirm(
          completed === recovered.batches.length
            ? `A completed import session was found for "${file.name}". Restore the ${completed} processed batches without processing them again?`
            : `An unfinished import was found for "${file.name}" (${completed} of ${recovered.batches.length} batches completed). Resume only the unfinished batches?`
        )
        if (shouldResume) {
          setSummaryFromSession(recovered)
          const unfinished = recovered.batches
            .filter((batch) => batch.status !== "completed")
            .map((batch) => batch.index)
          await runBatchSession(recovered, unfinished)
          return
        }
        await deleteImportSession(fingerprint).catch(() => undefined)
      }

      setProgressMessage(
        fileType === "txt" || fileType === "md"
          ? `Reading ${fileType === "md" ? "Markdown" : "text"} file…`
          : `Extracting ${fileType === "docx" ? "document" : "PDF"} text and images…`,
      )
      let extracted: {
        text: string
        images: ImportSourceImage[]
        summary?: ImportExtractionSummary
      }
      if (fileType === "txt" || fileType === "md") {
        const text = await readPlainTextImportFile(file)
        extracted = {
          text,
          images: [],
          summary: {
            textChars: text.length,
            imageCount: 0,
            limits: { textChars: PLAIN_TEXT_IMPORT_CHAR_LIMIT, imageCount: 50 },
            withinLimits: true,
          },
        }
      } else {
        const formData = new FormData()
        formData.append("file", file)
        const route = fileType === "docx" ? "/api/parse-docx" : "/api/parse-pdf-file"
        const extractResponse = await fetch(route, { method: "POST", body: formData, headers: importAuthHeaders() })
        if (!extractResponse.ok) throw new Error(await importError(extractResponse))
        extracted = await extractResponse.json() as typeof extracted
      }
      const { text, images = [], summary } = extracted
      if (!text?.trim()) throw new Error("The document appears to be empty or could not be read.")

      const numberedBatches = splitIntoQuestionBatches(text, 25)
      const usingQuestionBatches = numberedBatches.length > 0
      const batchTexts = usingQuestionBatches ? numberedBatches : chunkText(text, 2000)
      if (batchTexts.length === 0) throw new Error("No content found in the document.")
      if (batchTexts.length > 80) throw new Error("This import has too many chunks. Split the document into smaller imports.")

      const now = new Date().toISOString()
      const session: ResumableImportSession = {
        version: 1,
        fingerprint,
        fileName: file.name,
        fileSize: file.size,
        fileType,
        usingQuestionBatches,
        images,
        summary: summary ?? null,
        batches: createResumableBatches(batchTexts, usingQuestionBatches, countNumberedQuestions),
        createdAt: now,
        updatedAt: now,
      }
      setSummaryFromSession(session)
      await persistSession(session)
      await runBatchSession(session, session.batches.map((batch) => batch.index))
    } catch (processingError) {
      setIsProcessing(false)
      setProgressMessage("")
      setError(processingError instanceof Error ? processingError.message : "Upload failed or timed out. Connection closed safely to protect bandwidth.")
    }
  }

  async function processDocxFile(file: File) {
    await processDocumentFile(file, "docx")
  }

  // ── Categorization gate: apply and proceed to preview ────────────────────────
  function applyCategorization() {
    if (!categorizeModule.trim()) {
      setError("A module name is required before you can continue.")
      return
    }
    setError("")
    const filled = rawMaster.map((q) => ({
      ...q,
      module: q.module || categorizeModule.trim(),
      subject: q.subject || categorizeDiscipline.trim(),
    }))
    setRawMaster([])
    stageQuestions(filled, "ai")
  }

  async function processPdfFile(file: File) {
    await processDocumentFile(file, "pdf")
  }

  async function processPlainTextFile(file: File, fileType: PlainTextImportFileType) {
    await processDocumentFile(file, fileType)
  }

  // ── Raw text handler ─────────────────────────────────────────────────────────
  async function processText() {
    const text = textInput.trim()
    if (!text) { setError("Paste some text first."); return }

    setError("")
    setImportSummary(null)
    setIsProcessing(true)
    setProgressMessage("Parsing text with AI…")

    try {
      const res = await fetch("/api/extract-single-chunk", {
        method: "POST",
        headers: importAuthHeaders(true),
        body: JSON.stringify({ textChunk: text, fallbackModule: null, fallbackDiscipline: null }),
      })
      if (!res.ok) throw new Error(await importError(res))
      const data = await res.json() as { questions?: ChunkQuestion[] }
      const questions = data.questions ?? []

      if (questions.length > 0) {
        stageQuestions(questions.map((q, i) => makeFromChunk(q, i, null)), "ai")
        return
      }

      // AI fallback — regex
      setProgressMessage("AI returned no questions — using fallback parser…")
      const raw = parseTextFallback(text)
      if (raw.length === 0) {
        setError("No questions detected. Make sure questions are numbered and options are labelled A–E.")
        return
      }
      stageQuestions(raw.map((r, i) => makeFromRaw(r, i, null)), "regex")
    } catch (err) {
      setIsProcessing(false)
      setProgressMessage("")
      setError(err instanceof Error ? err.message : "Upload failed or timed out. Connection closed safely to protect bandwidth.")
      return
    }
    setIsProcessing(false)
    setProgressMessage("")
  }

  // ── File routing ─────────────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    const name = file.name.toLowerCase()
    if (name.endsWith(".json")) {
      processJsonFile(file)
    } else if (name.endsWith(".docx")) {
      processDocxFile(file)
    } else if (name.endsWith(".pdf")) {
      processPdfFile(file)
    } else if (plainTextImportFileType(name)) {
      processPlainTextFile(file, plainTextImportFileType(name)!)
    } else {
      setError("Unsupported file type. Please drop a .json, .docx, .pdf, .txt, or .md file.")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  async function retryFailedBatches() {
    if (!importSession || isProcessing) return
    const failedIndexes = importSession.batches
      .filter((batch) => batch.status === "failed")
      .map((batch) => batch.index)
    if (failedIndexes.length === 0) return
    setPartialImportWarning("")
    await runBatchSession(importSession, failedIndexes)
  }

  async function completeImport(allowPartial: boolean) {
    if (pendingImport.length === 0 || isProcessing) return
    const failed = importSession?.batches.filter((batch) => batch.status === "failed") ?? []
    if (failed.length > 0 && !allowPartial) return
    if (failed.length > 0) {
      const ranges = failedQuestionRanges(importSession?.batches ?? [])
      const confirmed = window.confirm(
        `This will import ${pendingImport.length} recovered questions without the failed range${ranges.length === 1 ? "" : "s"} ${ranges.join(", ")}. Continue with this incomplete import?`
      )
      if (!confirmed) return
    }
    onImport(pendingImport)
    if (importSession) await deleteImportSession(importSession.fingerprint).catch(() => undefined)
    onClose()
  }

  const failedBatchCount = importSession?.batches.filter((batch) => batch.status === "failed").length ?? 0

  const sourceBadge =
    parseSource === "ai"
      ? { label: "✦ AI parsed", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" }
      : parseSource === "regex"
      ? { label: "Fallback parsed", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" }
      : parseSource === "json"
      ? { label: "JSON imported", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" }
      : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="glass-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="glass-modal flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">

        {/* Header */}
        <div className="glass-modal-header flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ArrowUpDownIcon size={16} className="text-primary" />
              <h3 className="font-bold text-foreground">
                {view === "input"
                  ? "Import / Export Data"
                  : view === "categorize"
                  ? "Categorization Required"
                  : `Preview — ${pendingImport.length} question${pendingImport.length !== 1 ? "s" : ""}`}
              </h3>
              {view === "preview" && sourceBadge && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sourceBadge.cls}`}>{sourceBadge.label}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {view === "input"
                ? "Drop a file or paste text to import · Export the full live question bank as JSON"
                : view === "categorize"
                ? "Assign a module and discipline to uncategorized questions before importing"
                : "Review staged questions, remove any mis-parsed entries, then confirm"}
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
          {view === "input" ? (
            <div className="space-y-4 p-6">

              {/* ── File drop zone ───────────────────────────────────────── */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all
                  ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/20"}
                  ${isProcessing ? "pointer-events-none opacity-70" : ""}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.docx,.pdf,.txt,.md,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) processFile(f)
                    if (fileInputRef.current) fileInputRef.current.value = ""
                  }}
                />

                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isProcessing ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {isProcessing ? <Spinner size={28} /> : <UploadIcon size={26} />}
                </div>

                <div>
                  <p className="font-semibold text-foreground">
                    {isProcessing ? (progressMessage || "Processing…") : "Drop file here or click to browse"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {isProcessing
                      ? "Please wait while your questions are extracted"
                      : "Accepts .json · .docx · .pdf · .txt · .md"}
                  </p>
                </div>

                {isProcessing && (
                  <div className="w-full max-w-xs">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full animate-pulse rounded-full bg-primary/60 w-full" />
                    </div>
                  </div>
                )}

                {/* File type badges */}
                {!isProcessing && (
                  <div className="flex items-center gap-2">
                    {[
                      { label: "JSON", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
                      { label: "DOCX", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
                      { label: "PDF", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
                    ].map(({ label, cls }) => (
                      <span key={label} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Divider ──────────────────────────────────────────────── */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">or paste text</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* ── Raw text textarea ─────────────────────────────────────── */}
              <div>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={`Paste raw question text here…\n\nExample:\nMODULE: Internal Medicine\nDISCIPLINE: Cardiology\n\n1. A 55-year-old man presents with chest pain…\nA. Option one\nB. Option two\nC. Option three\nD. Option four\nAnswer: A\nExplanation: …`}
                  disabled={isProcessing}
                  rows={8}
                  className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangleIcon size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}

              {/* ── Copyable AI formatting example ─────────────────────────── */}
              {(() => {
                const formattingPrompt = `Organize and reformat every MCQ in the attached slide or document to follow the exact MedNexus structure shown in the example below. Preserve every question, answer option, correct answer, explanation, discipline, and embedded clinical image from the source. Use one MODULE heading at the top, add a DISCIPLINE heading whenever the subject changes, and keep question numbering continuous throughout the entire document. Do not add, remove, solve, rewrite, or summarize any question. Return the completed work as a clean .docx or .txt file ready for MedNexus import.

EXAMPLE TO FOLLOW

MODULE: Integument II

DISCIPLINE: Dermatology

1. A 24-year-old woman presents with an intensely itchy rash affecting the flexor surfaces of both elbows. Examination shows dry, erythematous, excoriated plaques. She has a history of asthma. What is the most likely diagnosis?

A. Atopic dermatitis
B. Plaque psoriasis
C. Tinea corporis
D. Seborrhoeic dermatitis
E. Contact urticaria

Answer: A

Explanation: Atopic dermatitis commonly affects flexural surfaces and is associated with other atopic conditions such as asthma and allergic rhinitis.

2. Which layer of the epidermis contains melanocytes?

A. Stratum corneum
B. Stratum lucidum
C. Stratum granulosum
D. Stratum spinosum
E. Stratum basale

Answer: E

Explanation: Melanocytes are primarily situated in the stratum basale and produce melanin, which is transferred to surrounding keratinocytes.

DISCIPLINE: Plastic Surgery

3. Which factor is most likely to delay wound healing?

A. Adequate oxygenation
B. Good nutritional status
C. Corticosteroid treatment
D. Proper wound apposition
E. Absence of infection

Answer: C

Explanation: Corticosteroids inhibit inflammation, fibroblast proliferation and collagen synthesis, thereby delaying wound healing.`

                return (
                  <div className="overflow-hidden rounded-2xl border border-border bg-muted/30">
                    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2">
                        <InfoIcon size={14} className="shrink-0 text-primary" />
                        <div>
                          <p className="text-xs font-bold text-foreground">AI formatting prompt and example</p>
                          <p className="text-[11px] text-muted-foreground">Copy this prompt and send it to the AI together with your document.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(formattingPrompt).then(() => {
                            setRulesCopied(true)
                            setTimeout(() => setRulesCopied(false), 2200)
                          })
                        }}
                        className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors sm:ml-auto ${rulesCopied
                          ? "border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "border-border bg-background text-foreground hover:bg-muted"
                        }`}
                        title="Copy the AI prompt and MCQ example"
                      >
                        {rulesCopied ? <CheckIcon size={12} /> : <ClipboardListIcon size={12} />}
                        {rulesCopied ? "Copied!" : "Copy prompt and example"}
                      </button>
                    </div>
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-relaxed text-foreground/80">
                      {formattingPrompt}
                    </pre>
                  </div>
                )
              })()}
            </div>

          ) : view === "categorize" ? (

            /* ── Categorization gate ─────────────────────────────────────── */
            <div className="space-y-4 p-6">
              {importSummary && <ImportSummaryPanel summary={importSummary} />}

              <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/40 dark:bg-amber-900/20">
                <AlertTriangleIcon size={18} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    {uncategorizedCount} question{uncategorizedCount !== 1 ? "s" : ""} missing MODULE or DISCIPLINE tags
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                    These questions have no <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">MODULE:</code> or <code className="rounded bg-amber-100 px-1 dark:bg-amber-900/40">DISCIPLINE:</code> tag in the source document.
                    Assign them below — questions that already have tags will keep their own values.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Module <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={categorizeModule}
                    onChange={(e) => setCategorizeModule(e.target.value)}
                    placeholder="e.g. Internal Medicine"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">
                    Discipline <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={categorizeDiscipline}
                    onChange={(e) => setCategorizeDiscipline(e.target.value)}
                    placeholder="e.g. Cardiology"
                    className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangleIcon size={15} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
            </div>

          ) : (
            /* Preview staging area */
            <div className="space-y-2 p-6">
              {importSummary && <ImportSummaryPanel summary={importSummary} />}
              {importSession && (
                <BatchRecoveryPanel
                  batches={importSession.batches}
                  isProcessing={isProcessing}
                  onRetryFailed={() => { void retryFailedBatches() }}
                />
              )}

              {partialImportWarning && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangleIcon size={14} className="mt-0.5 shrink-0" />
                  <span>{partialImportWarning}</span>
                </div>
              )}
              {pendingImport.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <AlertTriangleIcon size={32} className="text-amber-500" />
                  <p className="font-semibold">
                    {failedBatchCount > 0 ? "No questions have been recovered yet" : "All questions removed"}
                  </p>
                  <button
                    type="button"
                    onClick={() => { setView("input"); setParseSource(null); setPartialImportWarning(""); setImportSummary(null); setImportSession(null) }}
                    className="text-sm text-primary hover:underline"
                  >
                    Go back to import
                  </button>
                </div>
              ) : (
                pendingImport.map((q, i) => (
                  <PreviewCard
                    key={q.id}
                    q={q}
                    index={i}
                    onRemove={() => setPendingImport((prev) => prev.filter((_, j) => j !== i))}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4">
          {view === "preview" ? (
            <>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => { setView("input"); setParseSource(null); setPartialImportWarning(""); setImportSummary(null); setImportSession(null) }}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCwIcon size={13} /> Try another file
              </button>
              <div className="flex flex-wrap justify-end gap-2">
                {failedBatchCount > 0 && pendingImport.length > 0 && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => { void completeImport(true) }}
                    className="rounded-xl border border-amber-400 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300 dark:hover:bg-amber-950/20"
                  >
                    Continue with partial import
                  </button>
                )}
                <button
                  type="button"
                  disabled={pendingImport.length === 0 || failedBatchCount > 0 || isProcessing}
                  onClick={() => { void completeImport(false) }}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckIcon size={14} />
                  {failedBatchCount > 0 ? "Complete all batches first" : `Confirm & Import ${pendingImport.length} to Editor`}
                </button>
              </div>
            </>
          ) : view === "categorize" ? (
            <>
              <button
                type="button"
                onClick={() => { setView("input"); setRawMaster([]); setError(""); setImportSummary(null) }}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCwIcon size={13} /> Start Over
              </button>
              <button
                type="button"
                disabled={!categorizeModule.trim()}
                onClick={applyCategorization}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckIcon size={14} />
                Apply & Continue to Preview
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <DownloadIcon size={14} />
                  Export JSON
                  <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {liveQuestions.length}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={isProcessing || !textInput.trim()}
                  onClick={processText}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isProcessing ? <Spinner size={14} /> : <UploadIcon size={14} />}
                  Process Import
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
