import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("economy UI consistency", () => {
  it("shares compact presentation primitives across quests and the Store landing", async () => {
    const [ui, quests, store] = await Promise.all([
      readFile("components/economy-ui.ts", "utf8"),
      readFile("components/economy-panel.tsx", "utf8"),
      readFile("components/game-store-modal.tsx", "utf8"),
    ])

    expect(ui).toContain('rounded-2xl border border-border/80 bg-card/80')
    expect(ui).toContain('transition-[background-color,border-color,box-shadow]')
    expect(quests).toContain("ECONOMY_SECTION")
    expect(quests).toContain("ECONOMY_ROW")
    expect(store).toContain("ECONOMY_ROW")
  })

  it("uses Lucide icons and restrained semantic accents for reward rows", async () => {
    const quests = await readFile("components/economy-panel.tsx", "utf8")
    const panel = quests.slice(quests.indexOf("export function DailyBountiesPanel"), quests.indexOf("export function StoreModal"))

    expect(panel).toContain("bountyIcons")
    expect(panel).toContain("weeklyIcons")
    expect(panel).toContain("bg-violet-500")
    expect(panel).toContain("bg-cyan-500")
    expect(panel).toContain("text-amber-600")
    expect(panel).toContain("bg-emerald-500")
    expect(panel).not.toContain("bounty.icon")
    expect(panel).not.toContain("transition-all")
  })

  it("keeps reward and Store actions while removing landing-page gradients", async () => {
    const [quests, store] = await Promise.all([
      readFile("components/economy-panel.tsx", "utf8"),
      readFile("components/game-store-modal.tsx", "utf8"),
    ])
    const hub = store.slice(store.indexOf("export function NexusStoreHub"), store.indexOf("function SupplyCard"))

    expect(quests).toContain("claimBounty(bountyId)")
    expect(quests).toContain("disabled={claiming === bounty.id}")
    expect(hub).toContain("navigate(department.screen)")
    expect(hub).toContain('aria-disabled="true"')
    expect(hub).toContain("BalancePill")
    expect(hub).not.toContain("bg-gradient-to-br")
  })
})
