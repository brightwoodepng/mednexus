import type { Question } from "@/lib/types"

const DB_NAME = "mednexus-offline"
const DB_VERSION = 2
const PACKS = "content-packs"
const THEORY = "theory-cache"
const OUTBOX = "sync-outbox"

export type OfflinePack = {
  id: string
  kind: "mcq-module"
  ownerId: string
  title: string
  questions: Question[]
  downloadedAt: string
  updatedAt: string | null
  bytes: number
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("Offline storage is unavailable in this browser."))
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PACKS)) db.createObjectStore(PACKS, { keyPath: "id" })
      if (!db.objectStoreNames.contains(THEORY)) db.createObjectStore(THEORY, { keyPath: "id" })
      if (!db.objectStoreNames.contains(OUTBOX)) db.createObjectStore(OUTBOX, { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline storage."))
  })
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("Offline storage request failed."))
  })
}

export function mcqPackId(ownerId: string, module: string) {
  return `mcq:${ownerId}:${module}`
}

export async function saveMcqPack(ownerId: string, module: string, questions: Question[], updatedAt: string | null) {
  const db = await openOfflineDb()
  const serialised = JSON.stringify(questions)
  const pack: OfflinePack = {
    id: mcqPackId(ownerId, module), kind: "mcq-module", ownerId, title: module, questions,
    downloadedAt: new Date().toISOString(), updatedAt, bytes: new Blob([serialised]).size,
  }
  await requestResult(db.transaction(PACKS, "readwrite").objectStore(PACKS).put(pack))
  db.close()
  return pack
}

export async function loadMcqPack(ownerId: string, module: string): Promise<OfflinePack | null> {
  const db = await openOfflineDb()
  const result = await requestResult(db.transaction(PACKS).objectStore(PACKS).get(mcqPackId(ownerId, module))) as OfflinePack | undefined
  db.close()
  return result ?? null
}

export async function listOfflinePacks(ownerId: string): Promise<OfflinePack[]> {
  const db = await openOfflineDb()
  const all = await requestResult(db.transaction(PACKS).objectStore(PACKS).getAll()) as OfflinePack[]
  db.close()
  return all.filter(pack => pack.ownerId === ownerId).sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt))
}

export async function deleteOfflinePack(id: string) {
  const db = await openOfflineDb()
  await requestResult(db.transaction(PACKS, "readwrite").objectStore(PACKS).delete(id))
  db.close()
}

function currentOwnerId() {
  return typeof localStorage === "undefined" ? "anonymous" : localStorage.getItem("mednexus-uid") ?? "anonymous"
}

export async function cacheTheoryResponse(url: string, payload: unknown) {
  const db = await openOfflineDb()
  const ownerId = currentOwnerId()
  await requestResult(db.transaction(THEORY, "readwrite").objectStore(THEORY).put({ id: `${ownerId}:${url}`, ownerId, url, payload, cachedAt: new Date().toISOString() }))
  db.close()
}

export async function loadTheoryResponse<T>(url: string): Promise<T | null> {
  const db = await openOfflineDb()
  const result = await requestResult(db.transaction(THEORY).objectStore(THEORY).get(`${currentOwnerId()}:${url}`)) as { payload: T } | undefined
  db.close()
  return result?.payload ?? null
}

export async function queueTheoryMutation(url: string, init: RequestInit) {
  const db = await openOfflineDb()
  const ownerId = currentOwnerId()
  const item = { id: crypto.randomUUID(), ownerId, url, method: init.method ?? "POST", headers: init.headers ?? {}, body: init.body ?? null, createdAt: new Date().toISOString() }
  await requestResult(db.transaction(OUTBOX, "readwrite").objectStore(OUTBOX).put(item))
  db.close()
}

export async function flushOfflineOutbox() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0
  const db = await openOfflineDb()
  const all = await requestResult(db.transaction(OUTBOX).objectStore(OUTBOX).getAll()) as Array<{ id: string; ownerId: string; url: string; method: string; headers: HeadersInit; body: BodyInit | null }>
  let sent = 0
  for (const item of all.filter(entry => entry.ownerId === currentOwnerId())) {
    try {
      const response = await fetch(item.url, { method: item.method, headers: item.headers, body: item.body })
      if (response.ok) {
        await requestResult(db.transaction(OUTBOX, "readwrite").objectStore(OUTBOX).delete(item.id))
        sent += 1
      }
    } catch { break }
  }
  db.close()
  return sent
}

export async function offlineTheoryFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET"
  if (method === "GET") {
    try {
      const response = await fetch(url, { cache: "no-store", ...init })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? "Something went wrong.")
      await cacheTheoryResponse(url, data)
      return data as T
    } catch (error) {
      const cached = await loadTheoryResponse<T>(url)
      if (cached !== null) return cached
      throw error
    }
  }
  try {
    const response = await fetch(url, init)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error ?? "Something went wrong.")
    return data as T
  } catch (error) {
    await queueTheoryMutation(url, init ?? { method })
    return { queued: true, offline: true } as T
  }
}
