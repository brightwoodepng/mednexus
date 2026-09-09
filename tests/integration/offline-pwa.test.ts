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
    const modules = read("components/module-library.tsx")
    expect(read("lib/offline-storage.ts")).toContain('const PACKS = "content-packs"')
    expect(read("contexts/questions-context.tsx")).toContain("await loadMcqPack(owner, filter.module)")
    expect(modules).toContain("Download for offline")
    expect(modules).toContain("Available offline")
    expect(modules).not.toContain("Available offline · Remove")
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

  it("keeps the offline status above mobile navigation", () => {
    expect(read("components/offline-status.tsx")).toContain("bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))]")
    expect(read("components/offline-status.tsx")).toContain("md:bottom-4")
  })

  it("offers installation and a confirmed download-all summary in profile overview", () => {
    const downloads = read("components/offline-downloads.tsx")
    const profile = read("components/profile-history.tsx")
    expect(read("components/offline-status.tsx")).toContain("beforeinstallprompt")
    expect(downloads).toContain("Download for device")
    expect(downloads).toContain('role="dialog"')
    expect(downloads).toContain("Add to Home Screen")
    expect(downloads).toContain("Download everything")
    expect(downloads).toContain("Estimated size")
    expect(downloads).toContain("Confirm download")
    expect(downloads).toContain("Each module download automatically includes all of its sets")
    expect(downloads).toContain("Downloaded modules")
    expect(downloads).toContain("group-open:rotate-180")
    expect(downloads).toContain("Remove this module from offline downloads?")
    expect(downloads).not.toContain('label="Theory sets"')
    expect(profile.indexOf("<OfflineDownloads />")).toBeLessThan(profile.indexOf("function Milestone"))
  })
})
