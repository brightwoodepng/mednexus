const SUBQUESTION_LABEL = /(?:^|\s)(?:\*\*|__)?[A-H][.)](?:\*\*|__)?\s+(?=\S)/gm

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
