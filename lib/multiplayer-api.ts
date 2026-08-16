"use client"

export class MultiplayerApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message)
  }
}

function authHeaders(json: boolean): HeadersInit {
  const headers: Record<string, string> = {}
  if (json) headers["Content-Type"] = "application/json"
  if (typeof window === "undefined") return headers
  const session = localStorage.getItem("mednexus-user-token")
  const guest = localStorage.getItem("mednexus-guest-token")
  // Guest mode is the active identity whenever its token exists. A previous
  // registered token can remain stored when users switch modes on one device.
  if (guest) headers["x-guest-token"] = guest
  else if (session) headers["x-session-token"] = session
  return headers
}

/** The sole browser transport for multiplayer room endpoints. */
export async function multiplayerApi<T>(url: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined
  const response = await fetch(url, { ...init, headers: { ...authHeaders(hasBody), ...init.headers } })
  const payload = await response.json().catch(() => null) as { error?: string; message?: string; code?: string } | null
  if (!response.ok) {
    throw new MultiplayerApiError(payload?.message ?? payload?.error ?? `Room request failed (${response.status})`, response.status, payload?.code)
  }
  return payload as T
}
