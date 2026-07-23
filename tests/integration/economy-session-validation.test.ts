import { describe, expect, it, vi } from "vitest"

const query = vi.fn()

vi.mock("@/lib/db", () => ({ default: { query, connect: vi.fn() } }))
vi.mock("server-only", () => ({}))

describe("economy session answer validation", () => {
  it("keeps multi-select answer comparison order-independent", async () => {
    const { sameAnswer } = await import("@/app/api/economy/session/route")

    expect(sameAnswer(["B", "A"], ["A", "B"])).toBe(true)
    expect(sameAnswer(["A"], ["A", "B"])).toBe(false)
    expect(sameAnswer("A", "A")).toBe(true)
  })
})
