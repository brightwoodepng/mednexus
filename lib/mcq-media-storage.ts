import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for MCQ media storage`)
  return value
}

function config() {
  return { bucket: required("MCQ_MEDIA_S3_BUCKET"), region: process.env.MCQ_MEDIA_S3_REGION?.trim() || "auto", endpoint: process.env.MCQ_MEDIA_S3_ENDPOINT?.trim() || undefined }
}

function client() {
  const value = config()
  return new S3Client({ region: value.region, endpoint: value.endpoint, forcePathStyle: process.env.MCQ_MEDIA_S3_FORCE_PATH_STYLE === "true", credentials: process.env.MCQ_MEDIA_S3_ACCESS_KEY_ID ? { accessKeyId: required("MCQ_MEDIA_S3_ACCESS_KEY_ID"), secretAccessKey: required("MCQ_MEDIA_S3_SECRET_ACCESS_KEY") } : undefined })
}

export async function putMcqMedia(key: string, bytes: Uint8Array, mimeType: string, checksum: string) {
  const { bucket } = config()
  await client().send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mimeType, CacheControl: IMMUTABLE_CACHE_CONTROL, ChecksumSHA256: Buffer.from(checksum, "hex").toString("base64"), Metadata: { sha256: checksum } }))
}

export async function deleteMcqMedia(key: string) {
  const { bucket } = config()
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

export function publicMcqMediaUrl(key: string) {
  const base = process.env.MCQ_MEDIA_CDN_BASE_URL?.trim().replace(/\/$/, "")
  return base ? `${base}/${key.split("/").map(encodeURIComponent).join("/")}` : null
}

export async function deliveryMcqMediaUrl(key: string) {
  const publicUrl = publicMcqMediaUrl(key)
  if (publicUrl) return publicUrl
  const { bucket } = config()
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 })
}

export async function readMcqMedia(key: string) {
  const { bucket } = config()
  const result = await client().send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  if (!result.Body) throw new Error(`Object ${key} has no body`)
  return new Uint8Array(await result.Body.transformToByteArray())
}
