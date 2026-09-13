import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync("components/grand-finale-modal.tsx", "utf8")

describe("Trial completion presentation", () => {
  it("uses a celebratory hero and visual score ring", () => {
    expect(source).toContain("Celebration hero")
    expect(source).toContain("conic-gradient(var(--primary)")
    expect(source).toContain("Session complete")
  })

  it("retains results, review, dashboard, and retry actions", () => {
    for (const label of ["Correct", "Missed", "Time", "Review answers", "Return to Dashboard", "Retry Block"]) {
      expect(source).toContain(label)
    }
  })
})
