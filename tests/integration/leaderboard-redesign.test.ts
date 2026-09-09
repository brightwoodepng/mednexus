import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const componentPath = new URL("../../components/leaderboard-screen.tsx", import.meta.url)
const apiPath = new URL("../../app/api/leaderboard/route.ts", import.meta.url)
const navigationPath = new URL("../../components/mednexus-app.tsx", import.meta.url)
const stylesPath = new URL("../../app/globals.css", import.meta.url)

describe("MCQ leaderboard redesign", () => {
  it("offers monthly, season, and all-time rankings", async () => {
    const [component, api] = await Promise.all([readFile(componentPath, "utf8"), readFile(apiPath, "utf8")])
    expect(component).toContain('{ id: "monthly", label: "Monthly"')
    expect(component).toContain('{ id: "season", label: "Season"')
    expect(component).toContain('{ id: "alltime", label: "All-time"')
    expect(component).not.toContain('{ id: "weekly", label: "Weekly"')
    expect(component).toContain('role="tablist"')
    expect(component).not.toContain('aria-label="Refresh rankings"')
    expect(component.match(/>Rankings<\/h1>/g)).toHaveLength(2)
    expect(component).toContain('hidden text-center md:block')
    expect(api).toContain('type RankingTab = "season" | "monthly" | "alltime"')
    expect(api).toContain("async function monthlyLeaderboard")
    expect(api).toContain("async function seasonLeaderboard")
    expect(api).toContain("async function allTimeLeaderboard")
  })

  it("uses an exact authenticated viewer rank and protects public entries", async () => {
    const api = await readFile(apiPath, "utf8")
    expect(api).toContain("1 + COUNT(*)::int AS exact_rank")
    expect(api).toContain("r.is_private = FALSE")
    expect(api).toContain("r.status = 'approved'")
    expect(api).not.toContain("entries.length + 1")
    expect(api).toContain("data.entries.filter((entry) => entry.uid !== viewerUid)")
    expect(api).not.toContain("entries: data.viewerEntry ? [data.viewerEntry] : []")
  })

  it("keeps profile interactions and routes the viewer CTA to modules", async () => {
    const [component, navigation] = await Promise.all([readFile(componentPath, "utf8"), readFile(navigationPath, "utf8")])
    expect(component).toContain("<PublicProfileModal")
    expect(component).toContain('onNavigate?.("modules")')
    expect(navigation).toContain("<LeaderboardScreen onNavigate={handleScreenNavigation} />")
  })

  it("centers mobile public profiles and renders the equipped highlight", async () => {
    const profile = await readFile(new URL("../../components/public-profile-modal.tsx", import.meta.url), "utf8")
    expect(profile).toContain("flex items-center justify-center")
    expect(profile).toContain("max-h-[calc(100dvh-1.5rem)]")
    expect(profile).toContain('<CosmeticHighlight cosmeticId={entry.equippedHighlight}')
    expect(profile).not.toContain("Cosmetics owned")
  })

  it("uses larger avatars below the podium", async () => {
    const component = await readFile(componentPath, "utf8")
    expect(component).toContain('size="h-16 w-16 sm:h-[72px] sm:w-[72px]"')
    expect(component).toContain('avatar: "h-[98px] w-[98px] sm:h-28 sm:w-28"')
    expect(component).toContain("h-5 min-w-5")
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

  it("ranks monthly, seasonal, and lifetime competition from verified XP", async () => {
    const api = await readFile(apiPath, "utf8")
    expect(api).toContain("FROM mednexus_xp_transactions")
    expect(api).toContain("created_at >= $1::timestamptz")
    expect(api).toContain("COALESCE(xp.total_xp, 0) AS total_xp")
    expect(api).toContain("SUM(amount)::bigint AS total_xp")
    expect(api).toContain("competitive=TRUE")
    expect(api).not.toContain("ORDER BY COALESCE(w.balance")
  })
})
