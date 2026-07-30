import { del, put } from "@vercel/blob"

export const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"
const IMMUTABLE_CACHE_SECONDS = 31_536_000

/**
 * Store immutable public MCQ media in Vercel Blob and return its permanent URL.
 * The database persists this URL rather than binary image data.
 */
export async function putMcqMedia(
  pathname: string,
  bytes: Uint8Array,
  mimeType: string,
  _checksum: string,
) {
  const blob = await put(pathname, Buffer.from(bytes), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: mimeType,
    cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
  })
  return blob.url
}

export async function deleteMcqMedia(location: string) {
  await del(location)
}

export function publicMcqMediaUrl(location: string) {
  return /^https:\/\/.+\.blob\.vercel-storage\.com\//i.test(location)
    ? location
    : null
}

export async function deliveryMcqMediaUrl(location: string) {
  const publicUrl = publicMcqMediaUrl(location)
  if (!publicUrl) throw new Error("MCQ media does not have a Vercel Blob URL")
  return publicUrl
}

export async function readMcqMedia(location: string) {
  const publicUrl = publicMcqMediaUrl(location)
  if (!publicUrl) throw new Error("MCQ media does not have a Vercel Blob URL")
  const response = await fetch(publicUrl, { cache: "no-store" })
  if (!response.ok) throw new Error(`Unable to read MCQ media (${response.status})`)
  return new Uint8Array(await response.arrayBuffer())
}
