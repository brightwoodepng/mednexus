import type { Question } from "@/lib/types"

type Content = { questions: Question[]; updatedAt: string | null }
type SavedContent = Content & { downloadedAt: string }
type Dependencies = {
  read: (owner: string, module: string) => Promise<SavedContent | null>
  fetch: (owner: string, module: string) => Promise<Content | null>
  save: (owner: string, module: string, content: Content) => Promise<unknown>
  online: () => boolean
  now?: () => number
}

/** Full modules only: a discipline subset must never overwrite an offline pack. */
export function createAutomaticModuleCache(deps: Dependencies) {
  const memory = new Map<string, SavedContent>()
  const loading = new Map<string, Promise<Content>>()
  const refreshing = new Map<string, Promise<Content>>()
  const now = deps.now ?? Date.now
  let generation = 0
  const keyFor = (owner: string, module: string) => JSON.stringify([owner, module])

  function refresh(owner: string, module: string): Promise<Content> {
    const key = keyFor(owner, module)
    const existing = refreshing.get(key)
    if (existing) return existing
    const version = generation
    const task = (async () => {
      const content = await deps.fetch(owner, module)
      if (!content) throw new Error("Questions could not be loaded. Check your connection and try again.")
      if (version === generation) {
        memory.set(key, { ...content, downloadedAt: new Date(now()).toISOString() })
        // Storage/media failures must not prevent studying successfully loaded questions.
        void deps.save(owner, module, content).catch(() => {})
      }
      return content
    })()
    refreshing.set(key, task)
    void task.finally(() => { if (refreshing.get(key) === task) refreshing.delete(key) }).catch(() => {})
    return task
  }

  function load(owner: string, module: string): Promise<Content> {
    const key = keyFor(owner, module)
    const existing = loading.get(key)
    if (existing) return existing
    const version = generation
    const task = (async () => {
      const saved = memory.get(key) ?? await deps.read(owner, module).catch(() => null)
      if (version !== generation) throw new Error("The study session changed. Open the module again.")
      if (saved) {
        if (version === generation) memory.set(key, saved)
        if (deps.online() && now() - Date.parse(saved.downloadedAt) > 5 * 60_000) {
          void refresh(owner, module).catch(() => {})
        }
        return saved
      }
      if (!deps.online()) throw new Error("Connect once to download this module for offline study.")
      return refresh(owner, module)
    })()
    loading.set(key, task)
    void task.finally(() => { if (loading.get(key) === task) loading.delete(key) }).catch(() => {})
    return task
  }

  return {
    load,
    clear() { generation++; memory.clear(); loading.clear(); refreshing.clear() },
    invalidate(owner: string, module: string) { generation++; memory.delete(keyFor(owner, module)) },
  }
}
