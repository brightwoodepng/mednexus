import { describe, expect, it, vi } from "vitest"
import { ACTIVE_THEORY_QUESTION_KEY, clearPersistedTheoryQuestion } from "@/lib/theory-navigation"

describe("Theory navigation state", () => {
  it("removes the persisted active question during explicit navigation", () => {
    const removeItem = vi.fn()

    clearPersistedTheoryQuestion({ removeItem })

    expect(removeItem).toHaveBeenCalledOnce()
    expect(removeItem).toHaveBeenCalledWith(ACTIVE_THEORY_QUESTION_KEY)
  })
})
