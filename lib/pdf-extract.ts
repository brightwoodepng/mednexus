let pdfjsLib: typeof import("pdfjs-dist") | null = null

async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib
  pdfjsLib = await import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`
  return pdfjsLib
}

export interface PdfExtractResult {
  text: string
  pageCount: number
}

function cleanStr(s: string): string {
  return s
    .replace(/\uFB00/g, "ff").replace(/\uFB01/g, "fi").replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi").replace(/\uFB04/g, "ffl")
    .replace(/\u2013/g, "-").replace(/\u2014/g, "--")
    .replace(/\u2018|\u2019/g, "'").replace(/\u201C|\u201D/g, '"')
    .replace(/\u00A0/g, " ")
}

export async function extractTextFromPdf(file: File): Promise<PdfExtractResult> {
  const pdfjs = await getPdfjs()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const pageCount = pdf.numPages
  const pageTexts: string[] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    type Item = { str: string; x: number; y: number; width: number; height: number }
    const items: Item[] = []

    for (const raw of content.items) {
      if (!("str" in raw) || !(raw as { str: string }).str.trim()) continue
      const t = (raw as { transform: number[] }).transform
      items.push({
        str: cleanStr((raw as { str: string }).str),
        x: t[4],
        y: t[5],
        width: (raw as { width?: number }).width ?? 0,
        height: (raw as { height?: number }).height ?? 12,
      })
    }

    // Group items into lines by Y coordinate (tolerance = line height / 2, min 4px)
    const Y_TOLERANCE = 4
    const lineMap = new Map<number, Item[]>()
    for (const item of items) {
      let matched = false
      for (const [ky] of lineMap) {
        if (Math.abs(item.y - ky) <= Y_TOLERANCE) {
          lineMap.get(ky)!.push(item)
          matched = true
          break
        }
      }
      if (!matched) lineMap.set(item.y, [item])
    }

    // Sort lines top-to-bottom (Y descending in PDF coords)
    const sortedLines = Array.from(lineMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, lineItems]) => lineItems.sort((a, b) => a.x - b.x))

    // Build text lines, inserting a space between items unless they overlap
    const textLines: string[] = []
    for (const lineItems of sortedLines) {
      let line = ""
      let lastRight = -Infinity
      for (const item of lineItems) {
        if (line.length > 0) {
          const gap = item.x - lastRight
          if (gap > 8) line += "  "
          else if (gap > 1) line += " "
        }
        line += item.str
        lastRight = item.x + item.width
      }
      const trimmed = line.trim()
      if (trimmed) textLines.push(trimmed)
    }

    pageTexts.push(textLines.join("\n"))
  }

  return {
    text: pageTexts.join("\n\n--- Page Break ---\n\n"),
    pageCount,
  }
}
