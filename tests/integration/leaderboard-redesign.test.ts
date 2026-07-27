import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const componentPath = new URL("../../components/leaderboard-screen.tsx", import.meta.url)
const apiPath = new URL("../../app/api/leaderboard/route.ts", import.meta.url)
const navigationPath = new URL("../../components/mednexus-app.tsx", import.meta.url)
const stylesPath = new URL("../../app/globals.css", import.meta.url)

describe("MCQ leaderboard redesign", () => {
  it("offers weekly, monthly, and all-time rankings", async () => {
    const [component, api] = await Promise.all([readFile(componentPath, "utf8"), readFile(apiPath, "utf8")])
    expect(component).toContain('{ id: "monthly", label: "Monthly"')
    expect(component).toContain('role="tablist"')
    expect(api).toContain('type RankingTab = "weekly" | "monthly" | "alltime"')
    expect(api).toContain('tab === "weekly" ? 6 : 29')
  })

  it("uses an exact authenticated viewer rank and protects public entries", async () => {
    const api = await readFile(apiPath, "utf8")
    expect(api).toContain("1 + COUNT(*)::int AS exact_rank")
    expect(api).toContain("r.is_private = FALSE")
    expect(api).toContain("r.status = 'approved'")
    expect(api).not.toContain("entries.length + 1")
  })

  it("keeps profile interactions and routes the viewer CTA to modules", async () => {
    const [component, navigation] = await Promise.all([readFile(componentPath, "utf8"), readFile(navigationPath, "utf8")])
    expect(component).toContain("<PublicProfileModal")
    expect(component).toContain('onNavigate?.("modules")')
    expect(navigation).toContain("<LeaderboardScreen onNavigate={handleScreenNavigation} />")
  })

  it("supports animated and reduced-motion presentations", async () => {
    const styles = await readFile(stylesPath, "utf8")
    expect(styles).toContain("@keyframes leaderboard-rise")
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)")
  })
})
