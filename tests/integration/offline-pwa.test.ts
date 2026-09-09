import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(path, "utf8")

describe("offline PWA", () => {
  it("ships an installable app shell without caching authenticated APIs", () => {
    expect(read("app/manifest.ts")).toContain('display: "standalone"')
    expect(read("components/offline-status.tsx")).toContain('navigator.serviceWorker.register("/sw.js")')
    expect(read("public/sw.js")).toContain('url.pathname.startsWith("/api/")')
  })

  it("stores selective MCQ downloads in IndexedDB and falls back to them", () => {
    expect(read("lib/offline-storage.ts")).toContain('const PACKS = "content-packs"')
    expect(read("contexts/questions-context.tsx")).toContain("await loadMcqPack(owner, filter.module)")
    expect(read("components/module-library.tsx")).toContain("Download for offline")
  })

  it("caches downloaded Theory questions sets and queues offline mutations", () => {
    expect(read("components/theory-vault.tsx")).toContain("is ready for offline study")
    expect(read("lib/offline-storage.ts")).toContain("queueTheoryMutation")
    expect(read("components/offline-status.tsx")).toContain("flushOfflineOutbox")
  })

  it("keeps connected-only experiences guarded", () => {
    expect(read("components/mednexus-app.tsx")).toContain("ONLINE_ONLY_SCREENS")
    expect(read("components/sidebar.tsx")).toContain("Group Study requires an internet connection")
  })
})
