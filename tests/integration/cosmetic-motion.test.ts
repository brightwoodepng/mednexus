import { describe, expect, it } from "vitest"
import { resolveCosmeticMotionState } from "@/components/cosmetics/motion"

describe("cosmetic motion policy", () => {
  it("keeps the requested state only while visible", () => {
    expect(resolveCosmeticMotionState("focused", true, false)).toBe("focused")
    expect(resolveCosmeticMotionState("celebrating", false, false)).toBe("static")
  })

  it("always provides the reduced static composition when requested by the OS", () => {
    expect(resolveCosmeticMotionState("celebrating", true, true)).toBe("reduced")
  })
})
