"use client"

/** Credentials used by protected import endpoints. */
export function importAuthHeaders(contentType = false): HeadersInit {
  const headers: Record<string, string> = {}
  if (contentType) headers["Content-Type"] = "application/json"
  const guest = localStorage.getItem("mednexus-guest-token")
  const session = localStorage.getItem("mednexus-user-token")
  if (guest) headers["x-guest-token"] = guest
  else if (session) headers["x-session-token"] = session
  return headers
}

export async function importError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string }
  if (body.error) return body.error
  if (response.status === 401) return "You need to sign in before importing content."
  if (response.status === 413) return "This import is too large. Reduce the file, images, or text and try again."
  if (response.status === 415) return "This file type is unsupported or malformed."
  if (response.status === 429) return "Import rate limit reached. Please wait before trying again."
  if (response.status >= 500) return "The import provider is temporarily unavailable. Please try again later."
  return `Import failed (HTTP ${response.status}).`
}
