import { createHash, randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { publicMcqMediaUrl, putMcqMedia } from "@/lib/mcq-media-storage"
import { auditAdmin } from "@/lib/platform-settings"
import { runtimePool } from "@/lib/runtime-db"

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
const MAX_INPUT_BYTES = 12 * 1024 * 1024
const MAX_ENCODED_BYTES = 3 * 1024 * 1024
const MAX_DIMENSION = 4096
const MAX_PIXELS = 25_000_000
function validSignature(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (mime === "image/gif") return String.fromCharCode(...bytes.slice(0, 3)) === "GIF"
  if (mime === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  return false
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 })
  if (!allowed.has(file.type)) return NextResponse.json({ error: "Use a JPEG, PNG, WebP, or GIF image." }, { status: 415 })
  if (file.size <= 0 || file.size > MAX_INPUT_BYTES) return NextResponse.json({ error: "Images must be smaller than 12 MB." }, { status: 413 })
  let bytes = new Uint8Array(await file.arrayBuffer())
  if (!validSignature(bytes, file.type)) return NextResponse.json({ error: "The file contents do not match the selected image type." }, { status: 415 })
  let metadata
  try { metadata = await sharp(bytes, { animated: true, limitInputPixels: MAX_PIXELS }).metadata() } catch { return NextResponse.json({ error: "The image could not be decoded safely." }, { status: 415 }) }
  if (!metadata.width || !metadata.height) return NextResponse.json({ error: "The image has invalid dimensions." }, { status: 415 })
  let mimeType = file.type
  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION || bytes.byteLength > MAX_ENCODED_BYTES) {
    bytes = new Uint8Array(await sharp(bytes, { animated: true, limitInputPixels: MAX_PIXELS }).rotate().resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toBuffer())
    mimeType = "image/webp"
    metadata = await sharp(bytes, { animated: true }).metadata()
  }
  if (bytes.byteLength > MAX_ENCODED_BYTES) return NextResponse.json({ error: "The optimized image is still larger than 3 MB." }, { status: 413 })
  const id = randomUUID()
  const checksum = createHash("sha256").update(bytes).digest("hex")
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]
  const objectKey = `mcq-media/${checksum}.${extension}`
  const caption = String(form.get("caption") ?? "").trim().slice(0, 300)
  const alt = String(form.get("alt") ?? "Clinical question image").trim().slice(0, 300) || "Clinical question image"
  const questionId = String(form.get("questionId") ?? "").trim() || null
  const pool = await runtimePool()
  const objectLocation = await putMcqMedia(objectKey, bytes, mimeType, checksum)
  await pool.query("INSERT INTO mednexus_mcq_media_assets (id,question_id,object_key,mime_type,byte_size,checksum_sha256,width,height,caption,alt_text,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [id, questionId, objectLocation, mimeType, bytes.byteLength, checksum, metadata.width, metadata.height, caption, alt, admin.uid])
  await auditAdmin(pool, admin.uid, "upload", "mcq_media", id, { questionId, mimeType, size: bytes.byteLength, checksum, width: metadata.width, height: metadata.height })
  return NextResponse.json({ asset: { id, url: publicMcqMediaUrl(objectLocation) ?? "/api/mcq/media/" + id, kind: "image", caption, alt, mimeType, byteSize: bytes.byteLength, checksum, width: metadata.width, height: metadata.height } }, { status: 201 })
}
