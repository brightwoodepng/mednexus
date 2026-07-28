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
    expect(api).toContain('tab === "weekly" ? 7 : 30')
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

  it("uses tapered podiums, framed rank badges, and layered reduced-motion-safe decoration", async () => {
    const [component, styles] = await Promise.all([readFile(componentPath, "utf8"), readFile(stylesPath, "utf8")])
    expect(component).toContain("leaderboard-pedestal")
    expect(component).toContain("leaderboard-pedestal-surface")
    expect(component).toContain("leaderboard-particle")
    expect(component).toContain("leaderboard-star")
    expect(component).toContain("leaderboard-crown")
    expect(component).not.toContain(">#{entry.rank}</span>")
    expect(styles).toContain("clip-path: polygon")
    expect(styles).toContain("@keyframes leaderboard-crown-float")
    expect(styles).toContain("@keyframes leaderboard-orbit-reverse")
    expect(styles).toContain("@keyframes leaderboard-twinkle")
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)")
  })

  it("keeps the signed-in learner ranking visible for every rank", async () => {
    const component = await readFile(componentPath, "utf8")
    expect(component).toContain("const showViewer = viewerEntry && !loading && !error")
    expect(component).not.toContain("viewerEntry.rank > 10")
    expect(component).toContain("Your ranking")
  })

  it("ranks timed periods from the ledger and all-time from lifetime earnings", async () => {
    const api = await readFile(apiPath, "utf8")
    expect(api).toContain("FROM mednexus_np_transactions")
    expect(api).toContain("created_at >= $1::timestamptz")
    expect(api).toContain("w.lifetime_earned")
    expect(api).not.toContain("ORDER BY COALESCE(w.balance")
  })
})
