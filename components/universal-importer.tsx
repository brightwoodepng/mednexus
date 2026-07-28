"use client"

import { useState, useRef, useCallback } from "react"
import { useQuestions } from "@/contexts/questions-context"
import type { Question, QuestionOption } from "@/lib/types"
import type { ImportExtractionSummary } from "@/lib/import-types"
import { findImportQuestionDuplicates } from "@/lib/game-question-pool"
import { importAuthHeaders, importError } from "@/lib/import-client"
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

function parseTextFallback(raw: string): RawQuestion[] {
  const lines = raw.replace(/--- Page Break ---/gi, "\n").split(/\r?\n/).map((l) => l.trim())
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
    pending = null; pendingOptions = []; collectingExplanation = false; inOptions = false
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
    if (ansM && pending) { pending.correctAnswer = ansM[1].toUpperCase(); collectingExplanation = false; continue }
    const expM = explPattern.exec(line)
    if (expM && pending) { collectingExplanation = true; pending.explanation = line.replace(explPattern, "").trim(); continue }
    const optM = optPattern.exec(line)
    if (optM && (pending || inOptions)) {
      inOptions = true
      const id = (optM[1] ?? optM[2]).toUpperCase()
      const text = optM[3].trim()
      if (!pendingOptions.find((o) => o.id === id)) pendingOptions.push({ id, text })
      collectingExplanation = false; continue
    }
    if (inOptions && pendingOptions.length > 0 && pending && !collectingExplanation) {
      if (!/^(?:Question\s+|Q\.?\s*)?\d{1,4}[.):\s]/.test(line)) {
        pendingOptions[pendingOptions.length - 1].text += " " + line; continue
      }
    }
    const qM = /^(?:Question\s+|Q\.?\s*)?(\d{1,4})[.):\s]+(.+)/.exec(line)
    if (qM) { flush(); pending = { module: currentModule, discipline: currentDiscipline, vignette: qM[2].trim(), correctAnswer: "A", explanation: "" }; continue }
    if (pending) {
      if (collectingExplanation) pending.explanation = (pending.explanation ?? "") + " " + line
      else if (!inOptions) pending.vignette = (pending.vignette ?? "") + " " + line
    }
  }
  flush()
  return results
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

function makeFromChunk(q: ChunkQuestion, index: number, fallbackModule: string | null): Question {
  return {
    id: `import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 5)}`,
    module: q.module?.trim() || fallbackModule || undefined,
    subject: q.discipline?.trim() || "",
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

  // ── Categorization gate ──────────────────────────────────────────────────────
  const [rawMaster, setRawMaster] = useState<Question[]>([])
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [categorizeModule, setCategorizeModule] = useState("")
  const [categorizeDiscipline, setCategorizeDiscipline] = useState("")

  // ── Format Tips accordion ─────────────────────────────────────────────────────
  const [openTip, setOpenTip] = useState<string | null>(null)
  const [rulesCopied, setRulesCopied] = useState(false)
  function toggleTip(id: string) { setOpenTip((prev) => (prev === id ? null : id)) }

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

  // ── DOCX handler — sequential image-aware 25-question batch processor ────────
  async function processDocxFile(file: File) {
    setError("")
    setImportSummary(null)
    setIsProcessing(true)
    setProgressMessage("Extracting document text and images…")

    try {
      const formData = new FormData()
      formData.append("file", file)
      const extractRes = await fetch("/api/parse-docx", { method: "POST", body: formData, headers: importAuthHeaders() })
      if (!extractRes.ok) {
        throw new Error(await importError(extractRes))
      }
      const { text, images = [], summary } = await extractRes.json() as {
        text: string
        images: { id: string; dataUri: string }[]
        summary?: ImportExtractionSummary
      }
      if (!text?.trim()) throw new Error("The document appears to be empty or could not be read.")

      // Build IMAGE_N → data URI lookup map
      const imageMap = new Map<string, string>(images.map((img) => [img.id, img.dataUri]))

      // Split into strict 25-question batches; fall back to word-chunking if no
      // numbered question boundaries are found in the document.
      const batches = splitIntoQuestionBatches(text, 25)
      const usingQuestionBatches = batches.length > 0
      const finalBatches = usingQuestionBatches ? batches : chunkText(text, 2000)

      if (finalBatches.length === 0) throw new Error("No content found in the document.")
      if (finalBatches.length > 80) throw new Error("This import has too many chunks. Split the document into smaller imports.")

      if (summary) {
        setImportSummary({
          ...summary,
          detectedQuestions: usingQuestionBatches ? countNumberedQuestions(text) : null,
          processingBatches: finalBatches.length,
        })
      }

      const batchLabel = usingQuestionBatches
        ? `${finalBatches.length} batch${finalBatches.length !== 1 ? "es" : ""} of up to 25 questions`
        : `${finalBatches.length} batch${finalBatches.length !== 1 ? "es" : ""}`

      if (images.length > 0) {
        setProgressMessage(`Found ${images.length} image${images.length !== 1 ? "s" : ""} — preparing ${batchLabel}…`)
      } else {
        setProgressMessage(`Preparing ${batchLabel}…`)
      }

      let runningModule: string | null = null
      let runningDiscipline: string | null = null
      const master: Question[] = []
      let questionIndex = 0
      let failedBatches = 0

      for (let i = 0; i < finalBatches.length; i++) {
        const startQ = i * 25 + 1
        const endQ = Math.min((i + 1) * 25, usingQuestionBatches ? questionIndex + 25 : (i + 1) * 25)
        setProgressMessage(
          usingQuestionBatches
            ? `Processing batch ${i + 1} of ${finalBatches.length} (questions ${startQ}–${endQ})…`
            : `Processing batch ${i + 1} of ${finalBatches.length}…`
        )

        // ── Per-batch recovery: a single failed batch is skipped, not fatal ──
        // Pass images for this batch so the server can do marker-based
        // reconciliation (more reliable than position counting).
        const batchText = finalBatches[i]
        const batchImages = images.filter((img) => batchText.includes(`[${img.id}]`))

        let chunkQuestions: ChunkQuestion[] = []
        try {
          const chunkRes = await fetch("/api/extract-single-chunk", {
            method: "POST",
            headers: importAuthHeaders(true),
            body: JSON.stringify({
              textChunk: batchText,
              fallbackModule: runningModule,
              fallbackDiscipline: runningDiscipline,
              images: batchImages,
            }),
          })
          if (!chunkRes.ok) {
            console.warn(`[import] Batch ${i + 1} failed (HTTP ${chunkRes.status}) — skipping`)
            failedBatches++
            continue
          }
          const chunkData = await chunkRes.json() as { questions?: ChunkQuestion[] }
          chunkQuestions = chunkData.questions ?? []
        } catch (batchErr) {
          console.warn(`[import] Batch ${i + 1} network error — skipping`, batchErr)
          failedBatches++
          continue
        }

        const lastItem = chunkQuestions.at(-1)
        if (lastItem?.module) runningModule = lastItem.module
        if (lastItem?.discipline) runningDiscipline = lastItem.discipline

        // ── Image assignment ────────────────────────────────────────────────
        // Primary: server-side marker reconciliation already set q.mediaBase64.
        // Fallback: position-based count for images between question boundaries
        // (e.g. images that appear in the document before the question stem).
        const Q_BOUNDARY_GLOBAL = /^(?:(?:Question\s+|Q\.?\s*)?\d{1,4}[.):\s]|\(\d{1,4}\))/gim
        const questionImageMap = new Map<number, string>()

        for (const match of batchText.matchAll(/\[IMAGE_(\d+)\]/g)) {
          const imageDataUri = imageMap.get(`IMAGE_${match[1]}`)
          if (!imageDataUri) continue
          const textBefore = batchText.slice(0, match.index ?? 0)
          const qIdx = Math.max(0, [...textBefore.matchAll(Q_BOUNDARY_GLOBAL)].length - 1)
          if (!questionImageMap.has(qIdx)) questionImageMap.set(qIdx, imageDataUri)
        }

        for (let j = 0; j < chunkQuestions.length; j++) {
          const q = makeFromChunk(chunkQuestions[j], questionIndex++, null)
          q.vignette = q.vignette.replace(/\[IMAGE_\d+\]/gi, "").replace(/\s{2,}/g, " ").trim()
          // Prefer server-side reconciliation; fall back to position-based
          if (!q.mediaBase64) {
            const imgForQ = questionImageMap.get(j)
            if (imgForQ) q.mediaBase64 = imgForQ
          }
          master.push(q)
        }
      }

      if (master.length === 0) {
        // AI returned nothing — regex fallback
        setProgressMessage("AI returned no questions — using fallback parser…")
        const raw = parseTextFallback(text)
        if (raw.length === 0) {
          setIsProcessing(false)
          setProgressMessage("")
          setError("No questions detected. Check that questions are numbered (1., Q1.) and options are labelled (A., B., etc.).")
          return
        }
        setIsProcessing(false)
        setProgressMessage("")
        stageQuestions(raw.map((r, i) => makeFromRaw(r, i, null)), "regex")
        return
      }

      // ── Categorization gate ─────────────────────────────────────────────────
      // Any question missing a module OR discipline requires user input before
      // the batch can proceed to the preview stage.
      const uncategorized = master.filter((q) => !q.module || !q.subject)
      if (uncategorized.length > 0) {
        setIsProcessing(false)
        setProgressMessage("")
        setRawMaster(master)
        setUncategorizedCount(uncategorized.length)
        setCategorizeModule("")
        setCategorizeDiscipline("")
        setView("categorize")
        return
      }

      setIsProcessing(false)
      setProgressMessage("")
      if (failedBatches > 0) {
        setPartialImportWarning(
          `${failedBatches} of ${finalBatches.length} batch${failedBatches > 1 ? "es" : ""} failed (timeout or API error) — ${master.length} question${master.length !== 1 ? "s" : ""} recovered below. Re-import the document to pick up the rest.`
        )
      }
      stageQuestions(master, "ai")
    } catch (err) {
      setIsProcessing(false)
      setProgressMessage("")
      setError(err instanceof Error ? err.message : "Upload failed or timed out. Connection closed safely to protect bandwidth.")
    }
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

  // ── PDF handler — server-side image-aware batch processor ───────────────────
  // Mirrors processDocxFile exactly: uploads the raw file to a server route that
  // uses PyMuPDF to extract both text and embedded images, then feeds the result
  // through the same 25-question batch pipeline with image assignment.
  async function processPdfFile(file: File) {
    setError("")
    setImportSummary(null)
    setIsProcessing(true)
    setProgressMessage("Extracting PDF text and images…")

    try {
      const formData = new FormData()
      formData.append("file", file)
      const extractRes = await fetch("/api/parse-pdf-file", { method: "POST", body: formData, headers: importAuthHeaders() })
      if (!extractRes.ok) {
        throw new Error(await importError(extractRes))
      }
      const { text, images = [], summary } = await extractRes.json() as {
        text: string
        images: { id: string; dataUri: string }[]
        summary?: ImportExtractionSummary
      }
      if (!text?.trim()) throw new Error("The document appears to be empty or could not be read.")

      // Build IMAGE_N → data URI lookup map
      const imageMap = new Map<string, string>(images.map((img) => [img.id, img.dataUri]))

      // Split into strict 25-question batches; fall back to word-chunking if no
      // numbered question boundaries are found in the document.
      const batches = splitIntoQuestionBatches(text, 25)
      const usingQuestionBatches = batches.length > 0
      const finalBatches = usingQuestionBatches ? batches : chunkText(text, 2000)

      if (finalBatches.length === 0) throw new Error("No content found in the document.")
      if (finalBatches.length > 80) throw new Error("This import has too many chunks. Split the document into smaller imports.")

      if (summary) {
        setImportSummary({
          ...summary,
          detectedQuestions: usingQuestionBatches ? countNumberedQuestions(text) : null,
          processingBatches: finalBatches.length,
        })
      }

      const batchLabel = usingQuestionBatches
        ? `${finalBatches.length} batch${finalBatches.length !== 1 ? "es" : ""} of up to 25 questions`
        : `${finalBatches.length} batch${finalBatches.length !== 1 ? "es" : ""}`

      if (images.length > 0) {
        setProgressMessage(`Found ${images.length} image${images.length !== 1 ? "s" : ""} — preparing ${batchLabel}…`)
      } else {
        setProgressMessage(`Preparing ${batchLabel}…`)
      }

      let runningModule: string | null = null
      let runningDiscipline: string | null = null
      const master: Question[] = []
      let questionIndex = 0
      let failedBatches = 0

      for (let i = 0; i < finalBatches.length; i++) {
        const startQ = i * 25 + 1
        const endQ = Math.min((i + 1) * 25, usingQuestionBatches ? questionIndex + 25 : (i + 1) * 25)
        setProgressMessage(
          usingQuestionBatches
            ? `Processing batch ${i + 1} of ${finalBatches.length} (questions ${startQ}–${endQ})…`
            : `Processing batch ${i + 1} of ${finalBatches.length}…`
        )

        // ── Per-batch recovery: a single failed batch is skipped, not fatal ──
        const batchText = finalBatches[i]
        const batchImages = images.filter((img) => batchText.includes(`[${img.id}]`))

        let chunkQuestions: ChunkQuestion[] = []
        try {
          const chunkRes = await fetch("/api/extract-single-chunk", {
            method: "POST",
            headers: importAuthHeaders(true),
            body: JSON.stringify({
              textChunk: batchText,
              fallbackModule: runningModule,
              fallbackDiscipline: runningDiscipline,
              images: batchImages,
            }),
          })
          if (!chunkRes.ok) {
            console.warn(`[import] Batch ${i + 1} failed (HTTP ${chunkRes.status}) — skipping`)
            failedBatches++
            continue
          }
          const chunkData = await chunkRes.json() as { questions?: ChunkQuestion[] }
          chunkQuestions = chunkData.questions ?? []
        } catch (batchErr) {
          console.warn(`[import] Batch ${i + 1} network error — skipping`, batchErr)
          failedBatches++
          continue
        }

        const lastItem = chunkQuestions.at(-1)
        if (lastItem?.module) runningModule = lastItem.module
        if (lastItem?.discipline) runningDiscipline = lastItem.discipline

        // ── Image assignment ──────────────────────────────────────────────────
        // Primary: server-side marker reconciliation already set q.mediaBase64.
        // Fallback: position-based count for images not found via markers.
        const Q_BOUNDARY_GLOBAL = /^(?:(?:Question\s+|Q\.?\s*)?\d{1,4}[.):\s]|\(\d{1,4}\))/gim
        const questionImageMap = new Map<number, string>()

        for (const match of batchText.matchAll(/\[IMAGE_(\d+)\]/g)) {
          const imageDataUri = imageMap.get(`IMAGE_${match[1]}`)
          if (!imageDataUri) continue
          const textBefore = batchText.slice(0, match.index ?? 0)
          const qIdx = Math.max(0, [...textBefore.matchAll(Q_BOUNDARY_GLOBAL)].length - 1)
          if (!questionImageMap.has(qIdx)) questionImageMap.set(qIdx, imageDataUri)
        }

        for (let j = 0; j < chunkQuestions.length; j++) {
          const q = makeFromChunk(chunkQuestions[j], questionIndex++, null)
          q.vignette = q.vignette.replace(/\[IMAGE_\d+\]/gi, "").replace(/\s{2,}/g, " ").trim()
          if (!q.mediaBase64) {
            const imgForQ = questionImageMap.get(j)
            if (imgForQ) q.mediaBase64 = imgForQ
          }
          master.push(q)
        }
      }

      if (master.length === 0) {
        setProgressMessage("AI returned no questions — using fallback parser…")
        const raw = parseTextFallback(text)
        if (raw.length === 0) {
          setIsProcessing(false)
          setProgressMessage("")
          setError("No questions detected. Check that questions are numbered (1., Q1.) and options are labelled (A., B., etc.).")
          return
        }
        setIsProcessing(false)
        setProgressMessage("")
        stageQuestions(raw.map((r, i) => makeFromRaw(r, i, null)), "regex")
        return
      }

      // ── Categorization gate ───────────────────────────────────────────────────
      const uncategorized = master.filter((q) => !q.module || !q.subject)
      if (uncategorized.length > 0) {
        setIsProcessing(false)
        setProgressMessage("")
        setRawMaster(master)
        setUncategorizedCount(uncategorized.length)
        setCategorizeModule("")
        setCategorizeDiscipline("")
        setView("categorize")
        return
      }

      setIsProcessing(false)
      setProgressMessage("")
      if (failedBatches > 0) {
        setPartialImportWarning(
          `${failedBatches} of ${finalBatches.length} batch${failedBatches > 1 ? "es" : ""} failed (timeout or API error) — ${master.length} question${master.length !== 1 ? "s" : ""} recovered below. Re-import the document to pick up the rest.`
        )
      }
      stageQuestions(master, "ai")
    } catch (err) {
      setIsProcessing(false)
      setProgressMessage("")
      setError(err instanceof Error ? err.message : "Upload failed or timed out. Connection closed safely to protect bandwidth.")
    }
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
    } else {
      setError("Unsupported file type. Please drop a .json, .docx, or .pdf file.")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

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
                  accept=".json,.docx,.pdf,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
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
                      : "Accepts .json · .docx · .pdf"}
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

              {/* ── Format Rules accordion ────────────────────────────────── */}
              {(() => {
                const sections: {
                  id: string
                  label: string
                  accent: string
                  iconBg: string
                  icon: React.ReactNode
                  rules: { good?: string; bad?: string; note?: string }[]
                  example?: string
                }[] = [
                  {
                    id: "workflow",
                    label: "Your Workflow (how to use this)",
                    accent: "border-emerald-400/40 dark:border-emerald-600/30",
                    iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
                    icon: <BookOpenIcon size={12} />,
                    rules: [
                      { good: "Reformat the questions compilation to match the MedNexus formatting rules (single module tag, continuous numbering, discipline tags per section, A–E options, Answer: line, Explanation: line) and export as a clean .docx/.txt for import" },
                      { note: "Rule 3 — Question Numbering: numbering runs continuously across the ENTIRE document, never restarting at each new DISCIPLINE tag" },
                      { bad: "Blank line between the question number and the vignette text" },
                      { bad: "A second MODULE tag anywhere in the document — only one, at the top" },
                      { bad: "DISCIPLINE tag placed mid-question (between stem and options)" },
                      { bad: "Answer: line placed before the options" },
                      { bad: "Sub-numbering or bullet points inside options (A. 1. sub-item)" },
                      { bad: "Question number duplicated at the start of the vignette text (1. 1. A patient…)" },
                      { bad: "Question numbering restarting at 1 for each new discipline" },
                    ],
                  },
                  {
                    id: "module",
                    label: "MODULE — extracted from your title",
                    accent: "border-emerald-400/40 dark:border-emerald-600/30",
                    iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
                    icon: <HashIcon size={12} />,
                    rules: [
                      { good: "MODULE: <name>  —  appears ONCE, at the very top of the document" },
                      { good: "Applies to every question in the file, regardless of discipline" },
                      { good: "Separator after keyword: colon  :  period  .  or dash  -  (colon preferred)" },
                      { good: "Tag is case-insensitive" },
                    ],
                    example: "MODULE: UCC Entrance Examination",
                  },
                  {
                    id: "discipline",
                    label: "DISCIPLINE — from your section headings",
                    accent: "border-blue-400/40 dark:border-blue-600/30",
                    iconBg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
                    icon: <ListChecksIcon size={12} />,
                    rules: [
                      { good: "DISCIPLINE: <name>  —  own line, placed before the first question of that section" },
                      { good: "Also accepts  SUBJECT:  or  TOPIC:" },
                      { good: "Applies to every question that follows until the next DISCIPLINE tag" },
                      { good: "Use a new DISCIPLINE tag every time the subject changes (e.g. Mathematics → Chemistry → Physics → Biology → Aptitude/Reasoning)" },
                      { bad: "Do NOT repeat the MODULE tag between sections — it is set once for the whole document" },
                    ],
                    example: "DISCIPLINE: Mathematics\n...(questions 1–25)...\nDISCIPLINE: Chemistry\n...(questions 26–51)...",
                  },
                  {
                    id: "options",
                    label: "Answer Options — lowercase → uppercase",
                    accent: "border-violet-400/40 dark:border-violet-600/30",
                    iconBg: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
                    icon: <CheckIcon size={12} />,
                    rules: [
                      { good: "Each option on its own dedicated line" },
                      { good: "Accepted formats:  A. text   A) text   A: text   A- text   (A) text" },
                      { good: "Letters A–E only (uppercase or lowercase — normalised to uppercase)" },
                      { good: "Minimum 2 options (A and B) required; option E is optional" },
                      { bad: "Option label repeated inside the text, e.g.  A. (A) Aortic dissection" },
                      { bad: "All options on a single line separated by commas or slashes" },
                    ],
                    example: "A. Aortic dissection\nB. Pulmonary embolism\nC. Myocardial infarction\nD. Pericarditis",
                  },
                  {
                    id: "answer",
                    label: "Answer line — only if present",
                    accent: "border-emerald-400/40 dark:border-emerald-600/30",
                    iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
                    icon: <CheckIcon size={12} />,
                    rules: [
                      { good: "Accepted keywords (case-insensitive):  Answer   Correct Answer   Correct_Answer   Ans   Key" },
                      { good: "Separator after keyword: colon  :  period  .  space  —  or dash  -" },
                      { good: "Value: single letter A, B, C, D, or E  (uppercase or lowercase)" },
                      { good: "Must appear AFTER all options and BEFORE the Explanation" },
                      { bad: "Answer line placed before the options" },
                      { bad: "Answer written as a word, e.g.  Answer: Aortic dissection" },
                    ],
                    example: "Answer: A",
                  },
                  {
                    id: "explanation",
                    label: "Explanation — only if present",
                    accent: "border-sky-400/40 dark:border-sky-600/30",
                    iconBg: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
                    icon: <BookOpenIcon size={12} />,
                    rules: [
                      { good: "Trigger keywords (case-insensitive):  Explanation   Rationale   Discussion   Reason   Solution" },
                      { good: "Keyword must be followed by any separator: period  .  colon  :  dash  -  em-dash  —  or a space" },
                      { good: "Everything after the keyword on that line, plus every subsequent line until the next question number, is the explanation body" },
                      { good: "Multi-paragraph explanations work — lines are concatenated automatically" },
                      { good: "Maps to the 'Why the correct answer is right' field in the editor" },
                      { bad: "No trigger keyword — unlabelled paragraph after the answer will be ignored" },
                    ],
                    example: "Explanation: Aortic dissection classically presents with sudden tearing chest pain radiating to the back, with a blood-pressure differential between arms and a widened mediastinum on CXR.",
                  },
                  {
                    id: "images",
                    label: "Clinical Images (.docx only)",
                    accent: "border-amber-400/40 dark:border-amber-600/30",
                    iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
                    icon: <ImageIcon size={12} />,
                    rules: [
                      { good: "Embed the image directly in your Word document at the correct position within the question block (after the stem, before or between the options)" },
                      { good: "The system counts question boundaries to assign images — one image per question, first image wins" },
                      { good: "A document can contain up to 50 embedded images, with a combined decoded-image limit of 8 MB" },
                      { bad: "Image placed between two question numbers — it will be attached to the preceding question" },
                      { note: "Do NOT type [IMAGE_1] or any placeholder manually — those are internal markers generated by the extractor. Embedding the image in Word at the right place is all that is needed." },
                    ],
                  },
                ]

                // Raw formatting prompt — copied verbatim to clipboard when user clicks "Copy Formatting Rules for AI"
                const RAW_FORMATTING_PROMPT = `Reformat the questions compilation to match the MedNexus formatting rules (single module tag, continuous numbering, discipline tags per section, A–E options, Answer: line, Explanation: line) and export as a clean .docx/.txt for import.

MEDNEXUS DOCUMENT FORMATTING RULES
Use these rules to pre-format raw MCQ compilations before importing.
============================================================

1. MODULE TAG (ONE PER DOCUMENT)
----------------------------------
  ✓  MODULE: <name>  —  appears ONCE, at the very top of the document
  ✓  Applies to every question in the file, regardless of discipline
  ✓  Separator after keyword: colon  :  period  .  or dash  -  (colon preferred)
  ✓  Tag is case-insensitive

  Example:
    MODULE: UCC Entrance Examination

2. DISCIPLINE TAGS (ONE PER SECTION)
--------------------------------------
  ✓  DISCIPLINE: <name>  —  own line, placed before the first question of that section
  ✓  Also accepts  SUBJECT:  or  TOPIC:
  ✓  Applies to every question that follows until the next DISCIPLINE tag
  ✓  Use a new DISCIPLINE tag every time the subject changes (e.g. Mathematics → Chemistry → Physics → Biology → Aptitude/Reasoning)
  ✗  Do NOT repeat the MODULE tag between sections — it is set once for the whole document

  Example:
    DISCIPLINE: Mathematics
    ...(questions 1–25)...
    DISCIPLINE: Chemistry
    ...(questions 26–51)...

3. QUESTION NUMBERING — CONTINUOUS THROUGHOUT
-------------------------------------------------
  ✓  Numbering runs continuously across the ENTIRE document, not restarting at each discipline
  ✓  Number must start at the very beginning of the line — no leading spaces
  ✓  Accepted:  1.   1)   1:   Q1.   Q.1.   Question 1.   (1)  — numbers 1–9999
  ✓  Question text must begin on the SAME LINE as the number, immediately after the separator
  ✗  Number on one line, vignette text on the next — parser reads a blank vignette
  ✓  Multi-line vignettes are fine — continuation lines are appended automatically
  ✗  Numbering must NOT reset to 1 when a new DISCIPLINE tag appears

  Example:
    24. A man invests GH₵1000 at 10% compound interest...
    DISCIPLINE: Chemistry
    25. pH of 10⁻⁵ M HCl is:

4. ANSWER OPTIONS (A – E)
--------------------------
  ✓  Each option on its own dedicated line
  ✓  Accepted formats:  A. text   A) text   A: text   A- text   (A) text
  ✓  Letters A–E only (uppercase or lowercase — normalised to uppercase)
  ✓  Minimum 2 options (A and B) required; option E is optional
  ✗  Option label repeated inside the text, e.g.  A. (A) Aortic dissection
  ✗  All options on a single line separated by commas or slashes

  Example:
    A. Aortic dissection
    B. Pulmonary embolism
    C. Myocardial infarction
    D. Pericarditis

5. CORRECT ANSWER LINE
-----------------------
  ✓  Accepted keywords (case-insensitive):  Answer   Correct Answer   Correct_Answer   Ans   Key
  ✓  Separator after keyword: colon  :  period  .  space  —  or dash  -
  ✓  Value: single letter A, B, C, D, or E  (uppercase or lowercase)
  ✓  Must appear AFTER all options and BEFORE the Explanation
  ✗  Answer line placed before the options
  ✗  Answer written as a word, e.g.  Answer: Aortic dissection

  Example:
    Answer: A

6. EXPLANATION / RATIONALE
---------------------------
  ✓  Trigger keywords (case-insensitive):  Explanation   Rationale   Discussion   Reason   Solution
  ✓  Keyword must be followed by any separator: period  .  colon  :  dash  -  em-dash  —  or a space
  ✓  Everything after the keyword on that line, plus every subsequent line until the next question number, is the explanation body
  ✓  Multi-paragraph explanations work — lines are concatenated automatically
  ✓  Maps to the 'Why the correct answer is right' field in the editor
  ✗  No trigger keyword — unlabelled paragraph after the answer will be ignored

  Example:
    Explanation: Aortic dissection classically presents with sudden tearing chest pain radiating to the back, with a blood-pressure differential between arms and a widened mediastinum on CXR.

7. CLINICAL IMAGES (.DOCX ONLY)
--------------------------------
  ✓  Embed the image directly in your Word document at the correct position within the question block (after the stem, before or between the options)
  ✓  The system counts question boundaries to assign images — one image per question, first image wins
  ✓  Maximum 50 embedded images per document; combined decoded-image data must remain within 8 MB
  ✗  Image placed between two question numbers — it will be attached to the preceding question
  ℹ  Do NOT type [IMAGE_1] or any placeholder manually — those are internal markers generated by the extractor. Embedding the image in Word at the right place is all that is needed.

8. CRITICAL DON'TS
-------------------
  ✗  Blank line between the question number and the vignette text
  ✗  A second MODULE tag anywhere in the document — only one, at the top
  ✗  DISCIPLINE tag placed mid-question (between stem and options)
  ✗  Answer: line placed before the options
  ✗  Sub-numbering or bullet points inside options (A. 1. sub-item)
  ✗  Question number duplicated at the start of the vignette text (1. 1. A patient…)
  ✗  Question numbering restarting at 1 for each new discipline

============================================================
COMPLETE DOCUMENT STRUCTURE EXAMPLE
--------------------------------------

MODULE: UCC Entrance Examination

DISCIPLINE: Mathematics

1. A trader sells an item at a 20% profit. If he had bought it for 15%
   less and sold it for GH₵30 less, he would have gained 25%. Find the
   cost price.

A. 218
B. 250
C. 300
D. 350

Answer: A

Explanation: Let CP = x. SP₁ = 1.2x. New CP = 0.85x, New SP = 1.2x − 30.
Since new profit is 25%: 1.25(0.85x) = 1.2x − 30 → x = GH₵218.

2. If 2x + 3y = 5 and x² + y² = 10, find the maximum value of xy.
...

DISCIPLINE: Chemistry

26. pH of 10⁻⁵ M HCl is:

A. 5
B. 7
C. 9
D. 10

Answer: A

Explanation: HCl is a strong acid that fully dissociates, so [H⁺] = 10⁻⁵ M,
giving pH = 5.`

                return (
                  <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                      <InfoIcon size={13} className="text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Formatting Rules</p>
                        <p className="text-[10px] text-muted-foreground/60">Copy → paste into Claude or Gemini before your document</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5">
                        {/* Copy Formatting Rules for AI */}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(RAW_FORMATTING_PROMPT).then(() => {
                              setRulesCopied(true)
                              setTimeout(() => setRulesCopied(false), 2200)
                            })
                          }}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                            rulesCopied
                              ? "border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                          title="Copy the full formatting rules to paste into Claude or Gemini before your document"
                        >
                          {rulesCopied ? <CheckIcon size={10} /> : <ClipboardListIcon size={10} />}
                          {rulesCopied ? "Copied!" : "Copy Formatting Rules for AI"}
                        </button>
                      </div>
                    </div>

                    {/* Accordion sections */}
                    <div className="divide-y divide-border">
                      {sections.map((s) => {
                        const isOpen = openTip === s.id
                        return (
                          <div key={s.id}>
                            <button
                              type="button"
                              onClick={() => toggleTip(s.id)}
                              className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                            >
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${s.iconBg}`}>
                                {s.icon}
                              </span>
                              <span className="flex-1 text-xs font-semibold text-foreground">{s.label}</span>
                              {isOpen
                                ? <ChevronDownIcon size={13} className="shrink-0 text-muted-foreground" />
                                : <ChevronRightIcon size={13} className="shrink-0 text-muted-foreground" />
                              }
                            </button>

                            {isOpen && (
                              <div className={`border-l-2 mx-4 mb-3 rounded-r-xl ${s.accent} bg-background/60 px-4 py-3 space-y-2`}>
                                {s.rules.map((r, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    {r.good !== undefined && (
                                      <>
                                        <CheckIcon size={11} className="mt-0.5 shrink-0 text-emerald-500" />
                                        <span className="text-xs text-foreground/80">{r.good}</span>
                                      </>
                                    )}
                                    {r.bad !== undefined && (
                                      <>
                                        <XIcon size={11} className="mt-0.5 shrink-0 text-destructive" />
                                        <span className="text-xs text-foreground/70">{r.bad}</span>
                                      </>
                                    )}
                                    {r.note !== undefined && (
                                      <>
                                        <InfoIcon size={11} className="mt-0.5 shrink-0 text-amber-500" />
                                        <span className="text-xs text-amber-700 dark:text-amber-400">{r.note}</span>
                                      </>
                                    )}
                                  </div>
                                ))}
                                {s.example && (
                                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted px-3 py-2.5 font-mono text-[10px] leading-relaxed text-foreground/80">
                                    {s.example}
                                  </pre>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
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

              {partialImportWarning && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <AlertTriangleIcon size={14} className="mt-0.5 shrink-0" />
                  <span>{partialImportWarning}</span>
                </div>
              )}
              {pendingImport.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <AlertTriangleIcon size={32} className="text-amber-500" />
                  <p className="font-semibold">All questions removed</p>
                  <button
                    type="button"
                    onClick={() => { setView("input"); setParseSource(null); setPartialImportWarning(""); setImportSummary(null) }}
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
                onClick={() => { setView("input"); setParseSource(null); setPartialImportWarning(""); setImportSummary(null) }}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <RefreshCwIcon size={13} /> Try another file
              </button>
              <button
                type="button"
                disabled={pendingImport.length === 0}
                onClick={() => { onImport(pendingImport); onClose() }}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckIcon size={14} />
                Confirm & Import {pendingImport.length} to Editor
              </button>
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
