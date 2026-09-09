import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const profile = readFileSync("components/profile-history.tsx", "utf8")
const header = profile.slice(profile.indexOf("function ProfileHeader"), profile.indexOf("// ── Continuous Module Review"))

describe("profile study-hub separation", () => {
  it("keeps only the spendable NP balance in the identity card", () => {
    expect(header).toContain("NP Balance")
    expect(header).not.toContain("Lifetime NP")
    expect(header).not.toContain("Lifetime XP")
    expect(header).not.toContain("clinicalRanks")
  })

  it("shows only the active vault in overview and navigation", () => {
    expect(profile).toContain('const isTheory = activeHub === "theory-vault"')
    expect(profile).toContain("{!isTheory && (")
    expect(profile).toContain("{isTheory && (")
    expect(profile).toContain('activeHub === "theory-vault" ? { id: "theory", label: "Theory Vault" } : { id: "mcq", label: "MCQ Vault" }')
  })

  it("does not request Theory profile data in MCQ mode", () => {
    expect(profile).toContain('if (!isTheory) { setTheory(null); return }')
  })
})
