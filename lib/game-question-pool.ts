import type { Question } from "@/lib/types"

export interface GameQuestionSelection {
  effectiveModule?: string | null
  discipline?: string | null
}

export interface QuestionPoolDiagnostics {
  inputCount: number
  eligibleCount: number
  idDuplicateCount: number
  contentDuplicateCount: number
}

export interface GameQuestionPool {
  questions: Question[]
  diagnostics: QuestionPoolDiagnostics
}

/** The legacy bank used the discipline as its module before `module` was added. */
export function getEffectiveQuestionModule(question: Question): string {
  return question.module?.trim() || question.subject.trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&(?:amp|#38);/gi, "&")
    .replace(/&(?:lt|#60);/gi, "<")
    .replace(/&(?:gt|#62);/gi, ">")
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&#x([0-9a-f]+);|&#([0-9]+);/gi, (_, hex, decimal) =>
      String.fromCodePoint(Number.parseInt(hex || decimal, hex ? 16 : 10)),
    )
}

/** Normalizes HTML/Markdown remnants and typographic variation without answer data. */
export function normalizeQuestionContent(value: string): string {
  return decodeEntities(value)
    .normalize("NFKC")
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, " $1 ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, " $1 ")
    .replace(/[`*_~^|\\]/g, " ")
    .toLocaleLowerCase("en")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** A client-safe content identity: it deliberately excludes the answer key. */
export function createQuestionContentFingerprint(question: Question): string {
  const options = question.options
    .map((option) => normalizeQuestionContent(option.text))
    .join("\u001f")
  return [
    normalizeQuestionContent(question.vignette),
    options,
    normalizeQuestionContent(getEffectiveQuestionModule(question)),
    normalizeQuestionContent(question.subject),
  ].join("\u001e")
}

export function isSupportedSoloQuestion(question: Question): boolean {
  const answer = Array.isArray(question.correctAnswer)
    ? question.correctAnswer.length === 1 ? question.correctAnswer[0] : null
    : question.correctAnswer
  return (!question.status || question.status === "live")
    && (!question.moduleStatus || question.moduleStatus === "live")
    && (!question.questionType || question.questionType === "STANDARD_MCQ")
    && typeof answer === "string"
    && question.options.length >= 2
    && question.options.some((option) => option.id === answer)
}

function canonicalOrder(left: Question, right: Question): number {
  return left.id.localeCompare(right.id)
    || createQuestionContentFingerprint(left).localeCompare(createQuestionContentFingerprint(right))
}

/** Builds the authoritative solo pool and reports every discarded duplicate. */
export function buildGameQuestionPool(
  allQuestions: Question[],
  selection: GameQuestionSelection = {},
): GameQuestionPool {
  const eligible = allQuestions.filter((question) => {
    if (!isSupportedSoloQuestion(question)) return false
    if (selection.effectiveModule && getEffectiveQuestionModule(question) !== selection.effectiveModule) return false
    if (selection.discipline && question.subject !== selection.discipline) return false
    return true
  })

  const byId = new Map<string, Question>()
  for (const question of [...eligible].sort(canonicalOrder)) {
    if (!byId.has(question.id)) byId.set(question.id, question)
  }

  const byFingerprint = new Map<string, Question>()
  for (const question of [...byId.values()].sort(canonicalOrder)) {
    const fingerprint = createQuestionContentFingerprint(question)
    if (!byFingerprint.has(fingerprint)) byFingerprint.set(fingerprint, question)
  }

  return {
    questions: [...byFingerprint.values()],
    diagnostics: {
      inputCount: allQuestions.length,
      eligibleCount: eligible.length,
      idDuplicateCount: eligible.length - byId.size,
      contentDuplicateCount: byId.size - byFingerprint.size,
    },
  }
}

export interface ImportDuplicateReport {
  duplicateCount: number
  duplicateCandidateIds: Set<string>
}

/** Detects duplicates within an import and against the existing bank. */
export function findImportQuestionDuplicates(candidates: Question[], existing: Question[] = []): ImportDuplicateReport {
  const seenIds = new Set(existing.map((question) => question.id))
  const seenFingerprints = new Set(existing.map(createQuestionContentFingerprint))
  const duplicateCandidateIds = new Set<string>()
  let duplicateCount = 0
  for (const candidate of candidates) {
    const fingerprint = createQuestionContentFingerprint(candidate)
    if (seenIds.has(candidate.id) || seenFingerprints.has(fingerprint)) {
      duplicateCount++
      duplicateCandidateIds.add(candidate.id)
    } else {
      seenIds.add(candidate.id)
      seenFingerprints.add(fingerprint)
    }
  }
  return { duplicateCount, duplicateCandidateIds }
}
