import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("mobile Nexus Store contracts", () => {
  it("provides a sticky safe-area shell and bottom navigation clearance", async () => {
    const [store, shell] = await Promise.all([
      readFile("components/game-store-modal.tsx", "utf8"),
      readFile("components/learner-workspace-shell.tsx", "utf8"),
    ])
    expect(store).toContain('aria-label="Back to Nexus Store"')
    expect(store).toContain("sticky top-0 z-50")
    expect(store).toContain("env(safe-area-inset-top,0px)")
    expect(store).toContain("env(safe-area-inset-bottom,0px)")
    expect(shell).toContain("overflow-y-auto overflow-x-hidden")
    expect(shell).toContain("calc(6rem+env(safe-area-inset-bottom,0px))")
  })

  it("uses equal-width categories, compact cards, and accessible sheets", async () => {
    const [store, economy] = await Promise.all([readFile("components/game-store-modal.tsx", "utf8"), readFile("contexts/economy-context.tsx", "utf8")])
    expect(store).toContain("grid grid-cols-4")
    expect(store).not.toContain("overflow-x-auto no-scrollbar")
    expect(store).toContain("grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2")
    expect(store).not.toContain("min-[380px]:grid-cols-2")
    expect(store).toContain("min-[360px]:grid-cols-2")
    expect(store).toContain("View details")
    expect(store).toContain("Nexus Protocol")
    expect(store).toContain('role="dialog" aria-modal="true"')
    expect(store).toContain('event.key === "Escape"')
    expect(store).toContain("returnFocus.current?.focus()")
    expect(store).toContain("min-h-11")
  })

  it("does not market non-sellable Vault products", async () => {
    const store = await readFile("components/game-store-modal.tsx", "utf8")
    expect(store).toContain('SELLABLE_STORE_ITEMS.some(i => i.category === "vault")')
    expect(store).toContain("Coming soon")
    expect(store).toContain('aria-disabled="true"')
  })

  it("keeps purchase feedback anchored and errors beside their cards", async () => {
    const [store, economy] = await Promise.all([
      readFile("components/game-store-modal.tsx", "utf8"),
      readFile("contexts/economy-context.tsx", "utf8"),
    ])
    expect(store).toContain('id={`store-item-${item.id}`}')
    expect(store).toContain('role="alert"')
    expect(store).toContain('aria-live="polite"')
    expect(store).toContain("NP remaining")
    expect(economy).toContain("setInventory(data.inventory ?? {})")
  })

  it("moves phone cosmetic actions into an accessible detail sheet", async () => {
    const store = await readFile("components/game-store-modal.tsx", "utf8")
    expect(store).toContain('options.length === 1 ? "hidden sm:grid sm:grid-cols-1"')
    expect(store).toContain("Buy ${selected.quantity} · ${selected.price.toLocaleString()} NP")
    expect(store).toContain('aria-label="Open dressing room"')
    expect(store).toContain('Filter · {rarity==="all"?"All rarities":rarity}')
    expect(store).toContain("sm:h-[72px] sm:w-[72px]")
    expect(store).toContain("Try in room")
    expect(store).not.toContain("transition-all")
  })
})
