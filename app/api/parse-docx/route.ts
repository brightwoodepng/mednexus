import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"

// This route only extracts raw text from the .docx and returns it immediately.
// All AI parsing has been moved to /api/extract-single-chunk so that this
// endpoint always resolves in <2 s and never hits a gateway timeout.
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
    const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) })

    if (!result.value.trim()) {
      return NextResponse.json({ error: "The document appears to be empty" }, { status: 422 })
    }

    return NextResponse.json({ text: result.value })
  } catch (err) {
    console.error("[parse-docx]", err)
    return NextResponse.json({ error: "Failed to process document" }, { status: 500 })
  }
}
