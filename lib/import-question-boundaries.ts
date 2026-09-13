/**
 * Recognise question headings without treating ordinary numbered medical text
 * (for example, "24 hours" or "2023 guidelines") as a new question.
 */
export const IMPORT_QUESTION_BOUNDARY = /^(?:(?:Question\s+|Q\.?\s*)\d{1,4}(?=$|[.):]\s*|\s+\S)|\d{1,4}[.):](?=$|\s)|\(\d{1,4}\)(?=$|\s))/i

const IMPORT_QUESTION_BOUNDARY_GLOBAL = /^(?:(?:Question\s+|Q\.?\s*)\d{1,4}(?=$|[.):]\s*|\s+\S)|\d{1,4}[.):](?=$|\s)|\(\d{1,4}\)(?=$|\s))/gim

/** Return the zero-based question containing a marker at `markerOffset`. */
export function importQuestionIndexAtOffset(text: string, markerOffset: number): number {
  const beforeMarker = text.slice(0, Math.max(0, markerOffset))
  return Math.max(0, [...beforeMarker.matchAll(IMPORT_QUESTION_BOUNDARY_GLOBAL)].length - 1)
}
