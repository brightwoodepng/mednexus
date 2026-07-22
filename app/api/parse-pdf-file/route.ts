import { NextRequest, NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { writeFile, unlink } from "fs/promises"
import { tmpdir } from "os"
import { join } from "path"
import { boundedJson, guardImportRequest, IMPORT_LIMITS, isPdf, validateImages } from "@/lib/import-guard"

export const maxDuration = 60

const execFileAsync = promisify(execFile)

export async function POST(req: NextRequest) {
  let tmpPath: string | null = null
  try {
    const guarded = await guardImportRequest(req, "parse-pdf-file")
    if ("response" in guarded) return guarded.response
    const formData = await req.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required (multipart/form-data)" }, { status: 400 })
    }
    if (file.type && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Unsupported PDF MIME type.", code: "UNSUPPORTED_MEDIA" }, { status: 415 })
    }
    if (file.size > IMPORT_LIMITS.fileBytes) {
      return NextResponse.json(
        { error: `File too large — max ${IMPORT_LIMITS.fileBytes / 1024 / 1024} MB`, code: "PAYLOAD_TOO_LARGE" },
        { status: 413 },
      )
    }

    // Write PDF to a temp file so the Python script can open it
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (!isPdf(buffer)) return NextResponse.json({ error: "Unsupported or malformed PDF file.", code: "UNSUPPORTED_MEDIA" }, { status: 415 })
    tmpPath = join(tmpdir(), `mednexus-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`)
    await writeFile(tmpPath, buffer)

    // Run the PyMuPDF extraction script
    const scriptPath = join(process.cwd(), "scripts", "extract_pdf_images.py")
    const { stdout, stderr } = await execFileAsync(
      "python3",
      [scriptPath, tmpPath],
      { maxBuffer: IMPORT_LIMITS.responseBytes, timeout: IMPORT_LIMITS.childProcessMs, killSignal: "SIGKILL" },
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

    const imageError = validateImages(result.images ?? [])
    if (result.text.length > IMPORT_LIMITS.textChars || (result.images?.length ?? 0) > IMPORT_LIMITS.imageCount || imageError) return NextResponse.json({ error: imageError ?? "Document exceeds import limits.", code: "PAYLOAD_TOO_LARGE" }, { status: 413 })
    return boundedJson({ text: result.text, images: result.images ?? [] })
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
