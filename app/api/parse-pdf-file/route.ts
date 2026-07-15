import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { writeFile, unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"

export const maxDuration = 60

const execFileAsync = promisify(execFile)

const MAX_FILE_BYTES = 50 * 1024 * 1024 // 50 MB

export async function POST(req: NextRequest) {
  let tmpPath: string | null = null
  try {
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required (multipart/form-data)" }, { status: 400 })
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only .pdf files are supported" }, { status: 415 })
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large — max ${MAX_FILE_BYTES / 1024 / 1024} MB` },
        { status: 413 },
      )
    }

    // Write PDF to a temp file so the Python script can open it
    const arrayBuffer = await file.arrayBuffer()
    tmpPath = join(tmpdir(), `mednexus-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`)
    await writeFile(tmpPath, Buffer.from(arrayBuffer))

    // Run the PyMuPDF extraction script
    const scriptPath = join(process.cwd(), "scripts", "extract_pdf_images.py")
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [scriptPath, tmpPath],
      { maxBuffer: 100 * 1024 * 1024 }, // 100 MB for large image payloads
    )

    if (stderr) {
      console.warn("[parse-pdf-file] Python stderr:", stderr.slice(0, 500))
    }

    const result = JSON.parse(stdout) as
      | { text: string; images: { id: string; dataUri: string }[] }
      | { error: string }

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }

    if (!result.text?.trim()) {
      return NextResponse.json({ error: "The document appears to be empty or could not be read." }, { status: 422 })
    }

    return NextResponse.json({ text: result.text, images: result.images ?? [] })
  } catch (err) {
    console.error("[parse-pdf-file]", err)
    return NextResponse.json(
      { error: "Failed to process PDF. The file may be encrypted, corrupted, or contain unsupported content." },
      { status: 500 },
    )
  } finally {
    // Always clean up the temp file
    if (tmpPath) {
      await unlink(tmpPath).catch(() => {})
    }
  }
}
