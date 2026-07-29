import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { createHash } from "node:crypto"
import {
  boundedJson,
  guardImportRequest,
  IMPORT_LIMITS,
  isDocx,
  summarizeExtractedImport,
  validateExtractedImport,
} from "@/lib/import-guard"

// Extracts raw text AND embedded images from a .docx file.
// Images are returned as base64 data URIs; their positions in the text are
// marked with [IMAGE_1], [IMAGE_2] … placeholders so the client can later
// associate each image with the question it belongs to.
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const guarded = await guardImportRequest(req, "parse-docx")
    if ("response" in guarded) return guarded.response
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required (multipart/form-data)" }, { status: 400 })
    }
    if (file.type && file.type !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return NextResponse.json({ error: "Unsupported DOCX MIME type.", code: "UNSUPPORTED_MEDIA" }, { status: 415 })
    }
    if (file.size > IMPORT_LIMITS.fileBytes) {
      return NextResponse.json(
        { error: `File too large — max ${IMPORT_LIMITS.fileBytes / 1024 / 1024} MB`, code: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (!isDocx(buffer)) return NextResponse.json({ error: "Unsupported or malformed DOCX file.", code: "UNSUPPORTED_MEDIA" }, { status: 415 })

    // Collect images as they are encountered during conversion
    const images: { id: string; dataUri: string }[] = []
    let imageCounter = 0
    const imageIdsByHash = new Map<string, string>()

    const result = await mammoth.convertToHtml(
      { buffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          try {
            const base64 = await image.read("base64")
            // Default to image/png if mammoth can't determine the MIME type —
            // an invalid content-type produces a broken data URI.
            const mime = image.contentType && image.contentType !== "undefined"
              ? image.contentType
              : "image/png"
            const hash = createHash("sha256")
              .update(mime)
              .update(":")
              .update(base64)
              .digest("hex")
            const existingId = imageIdsByHash.get(hash)
            if (existingId) return { src: existingId, alt: existingId }

            imageCounter++
            const id = `IMAGE_${imageCounter}`
            const dataUri = `data:${mime};base64,${base64}`
            images.push({ id, dataUri })
            imageIdsByHash.set(hash, id)
            // Embed placeholder in the HTML so we can locate it in the text
            return { src: id, alt: id }
          } catch (imgErr) {
            // Log the failure so it's visible in server logs, but keep going
            console.warn("[parse-docx] Failed to extract image:", imgErr)
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

    const limitError = validateExtractedImport(text, images)
    if (limitError) return NextResponse.json({ error: limitError, code: "PAYLOAD_TOO_LARGE" }, { status: 413 })
    return boundedJson({ text, images, summary: summarizeExtractedImport(text, images) })
  } catch (err) {
    console.error("[parse-docx]", err)
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 })
  }
}
