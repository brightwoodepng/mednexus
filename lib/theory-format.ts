const SUBQUESTION_LABEL = /(?:^|\s)(?:\*\*|__)?[A-H][.)](?:\*\*|__)?\s+(?=\S)/gm
const SECTION_LABEL = /^\s*(?:#{1,6}\s*)?(?:[-*+]\s*)?(?:\*\*|__)?(?:question\s+)?([A-H]|\d{1,2})(?:[.)]|:)(?:\*\*|__)?(?:\s|$)/i

export function formatTheorySubquestions(source: string) {
  const labels = source.match(SUBQUESTION_LABEL)
  if (!labels || labels.length < 2) return source
  let firstLabel = true
  return source.replace(/(^|\s+)((?:\*\*|__)?[A-H][.)](?:\*\*|__)?)\s+(?=\S)/gm, (_match, spacing: string, label: string) => {
    if (firstLabel) {
      firstLabel = false
      return `${spacing}${label} `
    }
    return `\n\n${label} `
  })
}

export function theorySectionKey(value: string) {
  return value.match(SECTION_LABEL)?.[1]?.toUpperCase() ?? null
}

export function theorySectionKeys(source: string) {
  const keys = new Set<string>()
  for (const line of formatTheorySubquestions(source).split(/\n+/u)) {
    const key = theorySectionKey(line)
    if (key) keys.add(key)
  }
  return [...keys]
}
