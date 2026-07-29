import type { Question } from "@/lib/types"

export const QUESTION_SAVE_CHUNK_MAX_COUNT = 25
export const QUESTION_SAVE_CHUNK_MAX_BYTES = 1_500_000
export const QUESTION_SAVE_MAX_ATTEMPTS = 3

export interface QuestionSaveAttemptResult {
  ok: boolean
  error?: string
}

export interface QuestionSaveProgress {
  saved: number
  total: number
  completedChunks: number
  totalChunks: number
}

export interface QuestionSaveResult {
  ok: boolean
  savedQuestions: Question[]
  failedQuestions: Question[]
  error?: string
}

function jsonBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

/**
 * Split imports by both question count and serialized request size. Images remain
 * embedded on every question that uses them; this only keeps each HTTP request
 * below common proxy/body limits.
 */
export function createQuestionSaveChunks(
  questions: Question[],
  maxCount = QUESTION_SAVE_CHUNK_MAX_COUNT,
  maxBytes = QUESTION_SAVE_CHUNK_MAX_BYTES,
): Question[][] {
  const chunks: Question[][] = []
  let current: Question[] = []

  for (const question of questions) {
    const candidate = [...current, question]
    const candidateBytes = jsonBytes({ questions: candidate })
    if (current.length > 0 && (candidate.length > maxCount || candidateBytes > maxBytes)) {
      chunks.push(current)
      current = [question]
    } else {
      current = candidate
    }
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

export async function saveQuestionChunks(
  questions: Question[],
  saveChunk: (chunk: Question[]) => Promise<QuestionSaveAttemptResult>,
  onProgress?: (progress: QuestionSaveProgress) => void,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<QuestionSaveResult> {
  const chunks = createQuestionSaveChunks(questions)
  const savedQuestions: Question[] = []
  const failedQuestions: Question[] = []
  const errors: string[] = []

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex]
    let result: QuestionSaveAttemptResult = { ok: false, error: "Unknown save error." }

    for (let attempt = 1; attempt <= QUESTION_SAVE_MAX_ATTEMPTS; attempt += 1) {
      result = await saveChunk(chunk)
      if (result.ok) break
      if (attempt < QUESTION_SAVE_MAX_ATTEMPTS) {
        await wait(attempt === 1 ? 1_000 : 3_000)
      }
    }

    if (result.ok) {
      savedQuestions.push(...chunk)
    } else {
      failedQuestions.push(...chunk)
      errors.push(result.error ?? `Chunk ${chunkIndex + 1} failed after three attempts.`)
    }

    onProgress?.({
      saved: savedQuestions.length,
      total: questions.length,
      completedChunks: chunkIndex + 1,
      totalChunks: chunks.length,
    })
  }

  return {
    ok: failedQuestions.length === 0,
    savedQuestions,
    failedQuestions,
    error: errors[0],
  }
}
