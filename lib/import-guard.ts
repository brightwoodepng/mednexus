import "server-only"

import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { authenticateRequest, type RequestAuth } from "@/lib/request-auth"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"

export const IMPORT_LIMITS = {
  // Multipart overhead needs room above the file ceiling; JSON endpoints have
  // tighter semantic limits below (chunk text and decoded image bytes).
  requestBytes: 30 * 1024 * 1024,
  fileBytes: 25 * 1024 * 1024,
  textChars: 120_000,
  chunkChars: 24_000,
  imageCount: 20,
  imageBytes: 8 * 1024 * 1024,
  responseBytes: 4 * 1024 * 1024,
  chunksPerImport: 80,
  childProcessMs: 25_000,
} as const

type GuardResult = { auth: RequestAuth } | { response: NextResponse }

const quotas: Record<string, { limit: number; windowSeconds: number }> = {
  "extract-single-chunk": { limit: 20, windowSeconds: 60 },
  "parse-pdf": { limit: 8, windowSeconds: 60 },
  "parse-docx": { limit: 12, windowSeconds: 60 },
  "parse-pdf-file": { limit: 8, windowSeconds: 60 },
}

function tooLarge(message: string) { return NextResponse.json({ error: message, code: "PAYLOAD_TOO_LARGE" }, { status: 413 }) }

/** Authenticates and atomically consumes a durable, per-user endpoint quota. */
export async function guardImportRequest(req: NextRequest, endpoint: keyof typeof quotas): Promise<GuardResult> {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return { response: await adminAccessDenied(req) }
  const auth = authenticateRequest(req.headers) ?? { uid: admin.uid, role: admin.role, permissions: new Set(), isGuest: false }
  const length = Number(req.headers.get("content-length") ?? 0)
  if (Number.isFinite(length) && length > IMPORT_LIMITS.requestBytes) return { response: tooLarge("Request body exceeds the allowed size.") }

  const quota = quotas[endpoint]
  try {
    const result = await pool.query<{ request_count: number; window_start: string }>(`
      INSERT INTO mednexus_import_rate_limits (user_id, endpoint, window_start, request_count)
      VALUES ($1, $2, NOW(), 1)
      ON CONFLICT (user_id, endpoint) DO UPDATE SET
        request_count = CASE WHEN mednexus_import_rate_limits.window_start <= NOW() - ($3 * INTERVAL '1 second') THEN 1 ELSE mednexus_import_rate_limits.request_count + 1 END,
        window_start = CASE WHEN mednexus_import_rate_limits.window_start <= NOW() - ($3 * INTERVAL '1 second') THEN NOW() ELSE mednexus_import_rate_limits.window_start END
      RETURNING request_count, window_start`, [auth.uid, endpoint, quota.windowSeconds])
    if (result.rows[0].request_count > quota.limit) {
      const retryAfter = Math.max(1, quota.windowSeconds - Math.floor((Date.now() - new Date(result.rows[0].window_start).getTime()) / 1000))
      return { response: NextResponse.json({ error: "Rate limit exceeded. Please wait before trying again.", code: "RATE_LIMITED", retryAfter }, { status: 429, headers: { "Retry-After": String(retryAfter) } }) }
    }
  } catch (error) {
    // Do not silently downgrade to an in-memory limiter: durable enforcement is required.
    console.error("[import-rate-limit] unavailable", error)
    return { response: NextResponse.json({ error: "Import service is temporarily unavailable.", code: "SERVICE_UNAVAILABLE" }, { status: 503 }) }
  }
  return { auth }
}

export function validateImages(images: unknown): string | null {
  if (images === undefined) return null
  if (!Array.isArray(images) || images.length > IMPORT_LIMITS.imageCount) return "Too many decoded images were supplied."
  let bytes = 0
  for (const image of images) {
    if (!image || typeof image !== "object" || typeof (image as { id?: unknown }).id !== "string" || typeof (image as { dataUri?: unknown }).dataUri !== "string") return "Invalid image payload."
    const uri = (image as { dataUri: string }).dataUri
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(uri)
    if (!match) return "Unsupported image type or malformed image data."
    bytes += Buffer.byteLength(match[2], "base64")
    if (bytes > IMPORT_LIMITS.imageBytes) return "Decoded images exceed the allowed size."
  }
  return null
}

export function boundedJson(payload: unknown, status = 200): NextResponse {
  const json = JSON.stringify(payload)
  if (Buffer.byteLength(json) > IMPORT_LIMITS.responseBytes) return NextResponse.json({ error: "Processed result exceeds the allowed response size.", code: "RESPONSE_TOO_LARGE" }, { status: 413 })
  return new NextResponse(json, { status, headers: { "content-type": "application/json" } })
}

export function isPdf(buffer: Buffer) {
  // A PDF must have a header, EOF marker and a structural xref/trailer indicator.
  return buffer.subarray(0, 8).toString("ascii").startsWith("%PDF-") && buffer.subarray(-2048).includes(Buffer.from("%%EOF")) && (buffer.includes(Buffer.from("xref")) || buffer.includes(Buffer.from("/Type /XRef")))
}

export function isDocx(buffer: Buffer) {
  // DOCX is an OPC ZIP package, not merely a file whose name ends in .docx.
  if (buffer.length < 22 || buffer.readUInt32LE(0) !== 0x04034b50) return false
  return buffer.includes(Buffer.from("[Content_Types].xml")) && buffer.includes(Buffer.from("word/document.xml")) && buffer.includes(Buffer.from("PK\x05\x06"))
}
