import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const profile = readFileSync("components/profile-history.tsx", "utf8")
const sidebar = readFileSync("components/sidebar.tsx", "utf8")
const header = profile.slice(profile.indexOf("function ProfileHeader"), profile.indexOf("// ── Continuous Module Review"))
const overview = profile.slice(profile.indexOf("function UnifiedOverview"), profile.indexOf("function Milestone"))

describe("profile study-hub separation", () => {
  it("keeps balances and sync status out of the identity card", () => {
    expect(header).not.toContain("NP Balance")
    expect(header).not.toContain("Lifetime NP")
    expect(header).not.toContain("Lifetime XP")
    expect(header).not.toContain("Synced to cloud")
    expect(header).not.toContain("Saving locally")
    expect(header).toContain("clinicalRank.name")
  })

  it("opens the profile from both expanded and compact sidebar identities", () => {
    expect(sidebar.match(/onClick=\{\(\) => nav\("profile"\)\}/g)).toHaveLength(2)
    expect(sidebar.match(/aria-label="Open profile"/g)).toHaveLength(2)
  })

  it("keeps vault-specific data separate from the overview", () => {
    expect(profile).toContain('const isTheory = activeHub === "theory-vault"')
    expect(profile).toContain('activeHub === "theory-vault" ? { id: "theory", label: "Theory Activity", icon: ClipboardList } : { id: "mcq", label: "MCQ Activity", icon: ClipboardList }')
    expect(overview).not.toContain("Question performance")
    expect(overview).not.toContain("Reading and revision")
    expect(overview).not.toContain("View vault")
  })

  it("shows clinical-rank progression in the overview", () => {
    expect(overview).toContain('aria-label="Clinical rank progress"')
    expect(overview).toContain("XP to ${nextClinicalRank.name}")
    expect(overview).toContain("View all 12 clinical ranks")
  })

  it("uses the compact icon-based profile navigation dock", () => {
    expect(profile).toContain('aria-label="Profile sections"')
    expect(profile).toContain("grid-cols-4")
    expect(profile).toContain('aria-label="More profile actions"')
  })

  it("does not request Theory profile data in MCQ mode", () => {
    expect(profile).toContain('if (!isTheory) { setTheory(null); return }')
  })
})
