import type { Question } from "@/lib/types"
import type { ImportExtractionSummary } from "@/lib/import-types"
import type { PlainTextImportFileType } from "@/lib/plain-text-import"

export type ImportBatchStatus = "waiting" | "processing" | "completed" | "retrying" | "failed"

export interface ImportSourceImage {
  id: string
  dataUri: string
}

export interface ResumableImportBatch {
  index: number
  startQuestion: number
  endQuestion: number
  text: string
  fallbackModule: string | null
  fallbackDiscipline: string | null
  status: ImportBatchStatus
  attempts: number
  error: string | null
  questions: Question[]
  source?: "structured" | "ai"
}

export interface ResumableImportSession {
  version: 1
  fingerprint: string
  fileName: string
  fileSize: number
  fileType: "docx" | "pdf" | PlainTextImportFileType
  usingQuestionBatches: boolean
  images: ImportSourceImage[]
  summary: ImportExtractionSummary | null
  batches: ResumableImportBatch[]
  createdAt: string
  updatedAt: string
}

const DB_NAME = "mednexus-import-recovery"
const DB_VERSION = 1
const STORE_NAME = "sessions"

function openRecoveryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Browser recovery storage is unavailable."))
      return
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "fingerprint" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Could not open browser recovery storage."))
  })
}

export async function saveImportSession(session: ResumableImportSession): Promise<void> {
  const database = await openRecoveryDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite")
      transaction.objectStore(STORE_NAME).put({ ...session, updatedAt: new Date().toISOString() })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not save import recovery data."))
      transaction.onabort = () => reject(transaction.error ?? new Error("Import recovery save was cancelled."))
    })
  } finally {
    database.close()
  }
}

export async function loadImportSession(fingerprint: string): Promise<ResumableImportSession | null> {
  const database = await openRecoveryDatabase()
  try {
    return await new Promise<ResumableImportSession | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly")
      const request = transaction.objectStore(STORE_NAME).get(fingerprint)
      request.onsuccess = () => resolve((request.result as ResumableImportSession | undefined) ?? null)
      request.onerror = () => reject(request.error ?? new Error("Could not read import recovery data."))
    })
  } finally {
    database.close()
  }
}

export async function deleteImportSession(fingerprint: string): Promise<void> {
  const database = await openRecoveryDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite")
      transaction.objectStore(STORE_NAME).delete(fingerprint)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error("Could not clear import recovery data."))
    })
  } finally {
    database.close()
  }
}

export async function fingerprintFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function stableImportQuestionId(
  fingerprint: string,
  batchIndex: number,
  questionIndex: number,
  sourceQuestionNumber: number,
): string {
  return `import-${fingerprint.slice(0, 20)}-q${sourceQuestionNumber}-b${batchIndex + 1}-p${questionIndex + 1}`
}

function lastTag(text: string, pattern: RegExp): string | null {
  let value: string | null = null
  for (const match of text.matchAll(pattern)) value = match[1].trim()
  return value
}

export function createResumableBatches(
  texts: string[],
  usingQuestionBatches: boolean,
  countQuestions: (text: string) => number,
): ResumableImportBatch[] {
  let module: string | null = null
  let discipline: string | null = null
  let nextQuestion = 1

  return texts.map((text, index) => {
    const questionCount = usingQuestionBatches ? countQuestions(text) : 0
    const startQuestion = usingQuestionBatches ? nextQuestion : index + 1
    const endQuestion = usingQuestionBatches ? nextQuestion + Math.max(questionCount, 1) - 1 : index + 1
    const batch: ResumableImportBatch = {
      index,
      startQuestion,
      endQuestion,
      text,
      fallbackModule: module,
      fallbackDiscipline: discipline,
      status: "waiting",
      attempts: 0,
      error: null,
      questions: [],
    }
    module = lastTag(text, /^MODULE\s*[:.-]\s*(.+)$/gim) ?? module
    discipline = lastTag(text, /^(?:DISCIPLINE|SUBJECT|TOPIC)\s*[:.-]\s*(.+)$/gim) ?? discipline
    nextQuestion = endQuestion + 1
    return batch
  })
}

export function mergeCompletedBatchQuestions(batches: ResumableImportBatch[]): Question[] {
  return [...batches]
    .sort((left, right) => left.index - right.index)
    .filter((batch) => batch.status === "completed")
    .flatMap((batch) => batch.questions)
}

export function failedQuestionRanges(batches: ResumableImportBatch[]): string[] {
  return batches
    .filter((batch) => batch.status === "failed")
    .map((batch) => batch.startQuestion === batch.endQuestion
      ? `${batch.startQuestion}`
      : `${batch.startQuestion}–${batch.endQuestion}`)
}

export async function runWithImportRetry<T>(
  operation: (attempt: number) => Promise<T>,
  onAttempt: (attempt: number) => void,
  delays = [2_000, 5_000],
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
    onAttempt(attempt)
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (attempt <= delays.length) await wait(delays[attempt - 1])
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Batch processing failed.")
}
