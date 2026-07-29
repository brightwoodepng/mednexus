export interface ParsedMednexusQuestion {
  module: string
  discipline: string
  vignette: string
  options: { id: string; text: string }[]
  correctAnswer: string | null
  explanation: string | null
  sourceQuestionNumber: number
}

type ParserState = "vignette" | "options" | "answer" | "explanation"

interface PendingQuestion {
  module: string
  discipline: string
  sourceQuestionNumber: number
  vignette: string[]
  options: { id: string; text: string }[]
  correctAnswer: string | null
  explanation: string[]
  state: ParserState
}

const QUESTION_PATTERN = /^(?:Question\s+|Q\.?\s*)?(\d{1,4})[.):\s]+(.+)$/i
const OPTION_PATTERN = /^(?:\(([A-E])\)|([A-E])[.):\-])\s*(.+)$/i
const ANSWER_PATTERN = /^(?:correct[\s_]?answer|answer|ans(?:wer)?|key)\s*[:.—-]\s*([A-E])?\s*$/i
const EXPLANATION_PATTERN = /^(?:explanation|rationale|discussion|reason|solution)\s*[:.—-]\s*(.*)$/i

/**
 * Parses the documented MedNexus text format without an AI provider.
 *
 * The parser is intentionally strict enough to avoid inventing questions, but
 * accepts the two answer layouts produced by Word extraction:
 *
 *   Answer: C
 *   Answer:
 *   C
 */
export function parseMednexusText(
  raw: string,
  fallbackModule: string | null = null,
  fallbackDiscipline: string | null = null,
): ParsedMednexusQuestion[] {
  const lines = raw
    .replace(/--- Page Break ---/gi, "\n")
    .split(/\r?\n/)
    .map((line) => line.trim())

  const results: ParsedMednexusQuestion[] = []
  let currentModule = fallbackModule?.trim() ?? ""
  let currentDiscipline = fallbackDiscipline?.trim() ?? ""
  let pending: PendingQuestion | null = null
  let markersBeforeQuestion: string[] = []

  const flush = () => {
    const active = pending
    if (active && active.vignette.length > 0 && active.options.length >= 2) {
      const validAnswer = active.correctAnswer &&
        active.options.some((option) => option.id === active.correctAnswer)
        ? active.correctAnswer
        : null
      results.push({
        module: active.module,
        discipline: active.discipline,
        vignette: active.vignette.join("\n").trim(),
        options: active.options.map((option) => ({ ...option, text: option.text.trim() })),
        correctAnswer: validAnswer,
        explanation: active.explanation.length > 0
          ? active.explanation.join(" ").replace(/\s+/g, " ").trim()
          : null,
        sourceQuestionNumber: active.sourceQuestionNumber,
      })
    }
    pending = null
  }

  for (const line of lines) {
    if (!line) continue

    const moduleMatch = /^MODULE\s*[:.-]\s*(.+)$/i.exec(line)
    if (moduleMatch) {
      flush()
      currentModule = moduleMatch[1].trim()
      continue
    }

    const disciplineMatch = /^(?:DISCIPLINE|SUBJECT|TOPIC)\s*[:.-]\s*(.+)$/i.exec(line)
    if (disciplineMatch) {
      flush()
      currentDiscipline = disciplineMatch[1].trim()
      continue
    }

    const questionMatch = QUESTION_PATTERN.exec(line)
    if (questionMatch) {
      flush()
      pending = {
        module: currentModule,
        discipline: currentDiscipline,
        sourceQuestionNumber: Number(questionMatch[1]),
        vignette: [...markersBeforeQuestion, questionMatch[2].trim()],
        options: [],
        correctAnswer: null,
        explanation: [],
        state: "vignette",
      }
      markersBeforeQuestion = []
      continue
    }

    if (!pending) {
      if (/^\[IMAGE_\d+\]$/i.test(line)) markersBeforeQuestion.push(line)
      continue
    }

    const explanationMatch = EXPLANATION_PATTERN.exec(line)
    if (explanationMatch) {
      pending.state = "explanation"
      if (explanationMatch[1].trim()) pending.explanation.push(explanationMatch[1].trim())
      continue
    }

    if (pending.state !== "explanation") {
      const answerMatch = ANSWER_PATTERN.exec(line)
      if (answerMatch) {
        pending.state = "answer"
        pending.correctAnswer = answerMatch[1]?.toUpperCase() ?? null
        continue
      }

      if (pending.state === "answer" && /^[A-E]$/i.test(line)) {
        pending.correctAnswer = line.toUpperCase()
        continue
      }

      const optionMatch = OPTION_PATTERN.exec(line)
      if (optionMatch) {
        pending.state = "options"
        const id = (optionMatch[1] ?? optionMatch[2]).toUpperCase()
        if (!pending.options.some((option) => option.id === id)) {
          pending.options.push({ id, text: optionMatch[3].trim() })
        }
        continue
      }
    }

    if (pending.state === "explanation") {
      pending.explanation.push(line)
    } else if (pending.state === "options" && pending.options.length > 0) {
      pending.options[pending.options.length - 1].text += ` ${line}`
    } else if (pending.state !== "answer") {
      pending.vignette.push(line)
    }
  }

  flush()
  return results
}
