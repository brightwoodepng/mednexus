import { randomUUID } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])
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
  if (file.size <= 0 || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Images must be smaller than 8 MB." }, { status: 413 })
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!validSignature(bytes, file.type)) return NextResponse.json({ error: "The file contents do not match the selected image type." }, { status: 415 })
  const id = randomUUID()
  const caption = String(form.get("caption") ?? "").trim().slice(0, 300)
  const alt = String(form.get("alt") ?? "Clinical question image").trim().slice(0, 300) || "Clinical question image"
  const questionId = String(form.get("questionId") ?? "").trim() || null
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  await pool.query("INSERT INTO mednexus_mcq_media_assets (id,question_id,mime_type,data,caption,alt_text,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)", [id, questionId, file.type, Buffer.from(bytes), caption, alt, admin.uid])
  await auditAdmin(pool, admin.uid, "upload", "mcq_media", id, { questionId, mimeType: file.type, size: file.size })
  return NextResponse.json({ asset: { id, url: "/api/mcq/media/" + id, kind: "image", caption, alt } }, { status: 201 })
}
