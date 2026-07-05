import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"

// Extracts raw text AND embedded images from a .docx file.
// Images are returned as base64 data URIs; their positions in the text are
// marked with [IMAGE_1], [IMAGE_2] … placeholders so the client can later
// associate each image with the question it belongs to.
export const maxDuration = 30

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required (multipart/form-data)" }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ error: "Only .docx files are supported" }, { status: 415 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large — max ${MAX_FILE_BYTES / 1024 / 1024} MB` },
        { status: 413 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Collect images as they are encountered during conversion
    const images: { id: string; dataUri: string }[] = []
    let imageCounter = 0

    const result = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          try {
            imageCounter++
            const id = `IMAGE_${imageCounter}`
            const base64 = await image.read("base64")
            const dataUri = `data:${image.contentType};base64,${base64}`
            images.push({ id, dataUri })
            // Embed placeholder in the HTML so we can locate it in the text
            return { src: id, alt: id }
          } catch {
            // If a single image fails, skip it gracefully
            return { src: "", alt: "" }
          }
        }),
      },
    )

    // Convert HTML → plain text, keeping image placeholders
    let text = result.value
      // Replace <img> tags with [IMAGE_N] inline markers
      .replace(/<img[^>]+alt="(IMAGE_\d+)"[^>]*>/gi, "\n[$1]\n")
      // Strip all remaining HTML tags
      .replace(/<[^>]+>/g, "\n")
      // Decode common HTML entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse excessive blank lines
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!text) {
      return NextResponse.json({ error: "The document appears to be empty" }, { status: 422 })
    }

    return NextResponse.json({ text, images })
  } catch (err) {
    console.error("[parse-docx]", err)
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 })
  }
}
