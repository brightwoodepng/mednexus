export type TheoryMediaItem = {
  type: "image" | "diagram"
  url: string
  alt?: string
}

export const THEORY_MEDIA_MAX_ITEMS = 6
export const THEORY_MEDIA_MAX_BYTES = 8 * 1024 * 1024

export function isSafeTheoryMediaUrl(value: string) {
  return /^https:\/\//i.test(value)
    || value.startsWith("/")
    || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)
}

export function sanitizeTheoryMedia(value: unknown): TheoryMediaItem[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw new Error("Question media must be an array.")
  if (value.length > THEORY_MEDIA_MAX_ITEMS) throw new Error(`A question can contain at most ${THEORY_MEDIA_MAX_ITEMS} images.`)

  let encodedBytes = 0
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Image ${index + 1} is invalid.`)
    const record = entry as Record<string, unknown>
    const type = record.type === "diagram" ? "diagram" : "image"
    const url = typeof record.url === "string" ? record.url.trim() : ""
    if (!url || !isSafeTheoryMediaUrl(url)) {
      throw new Error(`Image ${index + 1} must use HTTPS, an internal path, or a PNG/JPEG/WebP upload.`)
    }
    if (url.startsWith("data:")) {
      const payload = url.slice(url.indexOf(",") + 1)
      encodedBytes += Math.floor(payload.length * 0.75)
      if (encodedBytes > THEORY_MEDIA_MAX_BYTES) throw new Error("Question images exceed the 8 MB combined limit.")
    }
    const alt = typeof record.alt === "string" ? record.alt.trim().slice(0, 300) : ""
    return { type, url, ...(alt ? { alt } : {}) }
  })
}
