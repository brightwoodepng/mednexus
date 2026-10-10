import { describe, expect, it, vi } from "vitest"
import { createAutomaticModuleCache } from "@/lib/automatic-module-cache"
import type { Question } from "@/lib/types"

const questions = [{ id: "a", subject: "Anatomy" }, { id: "b", subject: "Pathology" }] as Question[]
const content = { questions, updatedAt: "2026-10-10T00:00:00Z" }
const now = Date.parse("2026-10-10T12:00:00Z")
function setup(saved: any = null) {
  const deps = { read: vi.fn().mockResolvedValue(saved), fetch: vi.fn().mockResolvedValue(content), save: vi.fn().mockResolvedValue(undefined), online: vi.fn().mockReturnValue(true), now: () => now }
  return { deps, cache: createAutomaticModuleCache(deps) }
}

describe("automatic module downloads", () => {
  it("downloads and saves a full module once for concurrent opens", async () => {
    const { cache, deps } = setup()
    expect(await Promise.all([cache.load("u", "Year"), cache.load("u", "Year")])).toEqual([content, content])
    expect(deps.fetch).toHaveBeenCalledTimes(1)
    expect(deps.save).toHaveBeenCalledWith("u", "Year", content)
    await cache.load("u", "Year")
    expect(deps.fetch).toHaveBeenCalledTimes(1)
  })
  it("returns stored questions while an update remains pending", async () => {
    const saved = { ...content, downloadedAt: "2026-10-09T00:00:00Z" }
    const { cache, deps } = setup(saved)
    deps.fetch.mockReturnValue(new Promise(() => {}))
    expect(await cache.load("u", "Year")).toEqual(saved)
    expect(deps.fetch).toHaveBeenCalledTimes(1)
  })
  it("opens downloaded modules offline without a request", async () => {
    const { cache, deps } = setup({ ...content, downloadedAt: "2026-10-09T00:00:00Z" })
    deps.online.mockReturnValue(false)
    expect((await cache.load("u", "Year")).questions).toEqual(questions)
    expect(deps.fetch).not.toHaveBeenCalled()
  })
  it("does not reuse one account's questions for another", async () => {
    const { cache, deps } = setup()
    await cache.load("u", "Year"); await cache.load("v", "Year")
    expect(deps.read).toHaveBeenCalledWith("v", "Year")
    expect(deps.fetch).toHaveBeenCalledTimes(2)
  })
  it("keeps studying available if browser storage is full", async () => {
    const { cache, deps } = setup()
    deps.save.mockRejectedValue(new Error("Quota exceeded"))
    expect(await cache.load("u", "Year")).toEqual(content)
  })
  it("rejects an uncached failed request instead of using unrelated questions", async () => {
    const { cache, deps } = setup()
    deps.fetch.mockResolvedValue(null)
    await expect(cache.load("u", "Year")).rejects.toThrow("Questions could not be loaded")
    expect(deps.save).not.toHaveBeenCalled()
  })
})
