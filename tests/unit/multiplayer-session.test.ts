import { beforeEach, describe, expect, it, vi } from "vitest"

describe("multiplayer room recovery", () => {
  const values = new Map<string, string>()

  beforeEach(() => {
    values.clear()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    })
    vi.stubGlobal("sessionStorage", { removeItem: vi.fn() })
  })

  it("survives browser storage and validates the account", async () => {
    const { loadActiveRoomSession, saveActiveRoomSession } = await import("@/lib/multiplayer-session")
    saveActiveRoomSession({ pin: "123456", uid: "learner-1", mode: "clash", isHost: true, isCohortHost: false })
    expect(loadActiveRoomSession("learner-1")).toMatchObject({ pin: "123456", mode: "clash" })
    expect(loadActiveRoomSession("learner-2")).toBeNull()
  })

  it("rejects malformed and expired pointers", async () => {
    const { loadActiveRoomSession } = await import("@/lib/multiplayer-session")
    values.set("mednexus-active-room:v2", JSON.stringify({ version: 2, savedAt: Date.now() - 25 * 60 * 60 * 1000,
      pin: "123456", uid: "learner-1", mode: "clash", isHost: false, isCohortHost: false }))
    expect(loadActiveRoomSession("learner-1")).toBeNull()
  })
})
