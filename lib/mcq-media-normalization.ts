import { createHash, randomUUID } from "crypto"
import sharp from "sharp"
import type { Pool, PoolClient } from "pg"
import type { Question, QuestionMedia } from "@/lib/types"
import { publicMcqMediaUrl, putMcqMedia } from "@/lib/mcq-media-storage"

type Queryable = Pick<Pool | PoolClient, "query">
const dataUri = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i
const MAX_DIMENSION = 4096
const MAX_ENCODED_BYTES = 3 * 1024 * 1024

function storageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim()
    || process.env.VERCEL_OIDC_TOKEN?.trim(),
  )
}

/** Convert legacy inline question images into immutable object-storage assets. */
export async function externalizeLegacyQuestionMedia(
  db: Queryable,
  questions: readonly Question[],
  createdBy: string,
): Promise<Question[]> {
  if (!storageConfigured()) return [...questions]

  return Promise.all(questions.map(async question => {
    if (!question.mediaBase64) return question
    const match = dataUri.exec(question.mediaBase64)
    if (!match) throw new Error(`Question ${question.id} contains an invalid embedded image.`)

    let mimeType = match[1].toLowerCase()
    let bytes = new Uint8Array(Buffer.from(match[2], "base64"))
    let metadata = await sharp(bytes, { animated: true, limitInputPixels: 25_000_000 }).metadata()
    if (!metadata.width || !metadata.height) throw new Error(`Question ${question.id} contains an invalid image.`)
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION || bytes.byteLength > MAX_ENCODED_BYTES) {
      bytes = new Uint8Array(await sharp(bytes, { animated: true, limitInputPixels: 25_000_000 })
        .rotate()
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toBuffer())
      mimeType = "image/webp"
      metadata = await sharp(bytes, { animated: true }).metadata()
    }
    if (bytes.byteLength > MAX_ENCODED_BYTES) throw new Error(`Question ${question.id} image remains larger than 3 MB after optimization.`)

    const id = randomUUID()
    const checksum = createHash("sha256").update(bytes).digest("hex")
    const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1]
    const objectKey = `mcq-media/${checksum}.${extension}`
    const objectLocation = await putMcqMedia(objectKey, bytes, mimeType, checksum)
    await db.query(
      `INSERT INTO mednexus_mcq_media_assets
        (id,question_id,object_key,mime_type,byte_size,checksum_sha256,width,height,caption,alt_text,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'',$9,$10)`,
      [id, question.id, objectLocation, mimeType, bytes.byteLength, checksum, metadata.width, metadata.height, "Clinical question image", createdBy],
    )
    const asset: QuestionMedia = {
      id,
      url: publicMcqMediaUrl(objectLocation) ?? `/api/mcq/media/${id}`,
      kind: "image",
      placement: "stem",
      alt: "Clinical question image",
      sortOrder: question.media?.length ?? 0,
      mimeType,
      byteSize: bytes.byteLength,
      checksum,
      width: metadata.width,
      height: metadata.height,
    }
    const { mediaBase64: _embedded, ...withoutEmbedded } = question
    return { ...withoutEmbedded, media: [...(question.media ?? []), asset] }
  }))
}
