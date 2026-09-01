const SUBQUESTION_LABEL = /(?:^|\s)[A-H][.)]\s+(?=[A-Z])/g

export function formatTheorySubquestions(source: string) {
  const labels = source.match(SUBQUESTION_LABEL)
  if (!labels || labels.length < 2) return source
  return source.replace(/([^\n])\s+([A-H][.)])\s+(?=[A-Z])/g, "$1\n\n$2 ")
}
