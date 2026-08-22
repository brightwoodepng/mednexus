import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

const routePath = new URL("../../app/api/admin/economy-seasons/route.ts", import.meta.url)
const seasonsPath = new URL("../../lib/economy-seasons.ts", import.meta.url)

describe("Economy Seasons admin reliability", () => {
  it("uses a focused read-only schema preflight instead of the full application migration", async () => {
    const [route, seasons] = await Promise.all([readFile(routePath, "utf8"), readFile(seasonsPath, "utf8")])
    expect(route).toContain("assertEconomySeasonSchema(pool)")
    expect(route).not.toContain("ensureSchema()")
    expect(seasons).toContain("to_regclass('public.mednexus_economy_seasons')")
    expect(seasons).toContain("EconomySeasonSchemaError")
  })

  it("preserves closed-season rows for all-time rankings and audits", async () => {
    const route = await readFile(routePath, "utf8")
    expect(route).not.toContain('DELETE FROM mednexus_daily_activity WHERE season_id=$1')
    expect(route).not.toContain('DELETE FROM mednexus_game_personal_bests WHERE season_id=$1')
    expect(route).toContain("Keep the closed season's")
  })

  it("distinguishes connection failures from missing season schema", async () => {
    const route = await readFile(routePath, "utf8")
    expect(route).toContain("ECONOMY_SCHEMA_NOT_READY")
    expect(route).toContain("DATABASE_UNREACHABLE")
    expect(route).not.toContain("Retry after checking the database connection")
  })
})
