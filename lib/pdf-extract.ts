// Client-side PDF text extraction using pdfjs-dist
// Runs entirely in the browser — no server round-trip for extraction.

let pdfjsLib: typeof import("pdfjs-dist") | null = null

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib
  pdfjsLib = await import("pdfjs-dist")
  // Use the bundled legacy worker to avoid CORS issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`
  return pdfjsLib
}

export interface PdfExtractResult {
  text: string
  pageCount: number
}

export async function extractTextFromPdf(file: File): Promise<PdfExtractResult> {
  const pdfjs = await getPdfjs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const pageCount = pdf.numPages
  const pageTexts: string[] = []

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const lines: string[] = []
    let lastY: number | null = null

    for (const item of content.items) {
      if ("str" in item) {
        const y = (item as { transform: number[] }).transform[5]
        if (lastY !== null && Math.abs(y - lastY) > 5) {
          lines.push("\n")
        }
        lines.push(item.str)
        lastY = y
      }
    }

    pageTexts.push(lines.join(""))
  }

  return {
    text: pageTexts.join("\n\n--- Page break ---\n\n"),
    pageCount,
  }
}
