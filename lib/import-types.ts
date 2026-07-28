export interface ImportExtractionSummary {
  textChars: number
  imageCount: number
  limits: {
    textChars: number
    imageCount: number
  }
  withinLimits: boolean
}
