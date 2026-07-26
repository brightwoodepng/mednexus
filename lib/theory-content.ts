export function calculateTheoryMarks(keyMarkingPoints: string[]) {
  return keyMarkingPoints.filter(point => point.trim()).length * 2
}

export function deriveTheoryTitle(prompt: string, suppliedTitle = "") {
  const supplied = suppliedTitle.trim().replace(/\s+/g, " ")
  if (supplied) return supplied.slice(0, 200)

  const cleaned = prompt
    .replace(/^\s*(?:#{1,6}\s*)?(?:question(?:\s+\d+)?[:.)-]?\s*)/i, "")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const firstThought = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned
  if (firstThought.length <= 96) return firstThought
  const shortened = firstThought.slice(0, 93)
  const lastSpace = shortened.lastIndexOf(" ")
  return `${shortened.slice(0, lastSpace > 60 ? lastSpace : 93).trim()}…`
}
