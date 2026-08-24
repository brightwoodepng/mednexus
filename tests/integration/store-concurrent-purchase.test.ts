import { beforeEach, describe, expect, it, vi } from "vitest"

const state = {
  balance: 1_000,
  inventory: new Map<string, number>(),
  ledger: [] as unknown[][],
}

let inventoryLock = Promise.resolve()

function createClient() {
  let releaseInventoryLock: (() => void) | undefined

  return {
    release: vi.fn(),
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql === "BEGIN") return { rows: [], rowCount: 0 }
      if (sql === "COMMIT" || sql === "ROLLBACK") {
        releaseInventoryLock?.()
        releaseInventoryLock = undefined
        return { rows: [], rowCount: 0 }
      }
      if (sql.includes("FROM mednexus_economy_seasons")) return { rows: [{ id: "season-1", name: "Season 1", economy_version: "2.0", starts_at: "2026-01-01", opening_grant: 500 }], rowCount: 1 }

      if (sql.includes("INSERT INTO mednexus_user_inventory")) {
        const previousLock = inventoryLock
        inventoryLock = new Promise<void>(resolve => { releaseInventoryLock = resolve })
        await previousLock

        const key = `${params[0]}:${params[1]}`
        if (state.inventory.has(key)) return { rows: [], rowCount: 0 }
        state.inventory.set(key, 0)
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes("SELECT quantity FROM mednexus_user_inventory")) {
        const key = `${params[0]}:${params[1]}`
        return { rows: [{ quantity: state.inventory.get(key) ?? 0 }], rowCount: 1 }
      }
      if (sql.includes("UPDATE mednexus_user_inventory")) {
        state.inventory.set(`${params[0]}:${params[1]}`, Number(params[2]))
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes("SELECT balance FROM mednexus_season_wallets")) {
        return { rows: [{ balance: state.balance }], rowCount: 1 }
      }
      if (sql.includes("UPDATE mednexus_season_wallets")) {
        state.balance -= Number(params[1])
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes("INSERT INTO mednexus_np_transactions")) {
        state.ledger.push(params)
        return { rows: [], rowCount: 1 }
      }
      if (sql.includes("SELECT balance, lifetime_earned")) {
        return { rows: [{ balance: state.balance, lifetime_earned: 1_000, rank_points: 0 }], rowCount: 1 }
      }
      throw new Error(`Unexpected query: ${sql}`)
    }),
  }
}

vi.mock("@/lib/db", () => ({
  default: {
    connect: vi.fn(async () => createClient()),
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      if (sql.includes("SELECT quantity FROM mednexus_user_inventory")) {
        const quantity = state.inventory.get(`${params[0]}:${params[1]}`)
        return { rows: quantity === undefined ? [] : [{ quantity }], rowCount: quantity === undefined ? 0 : 1 }
      }
      if (sql.includes("INSERT INTO mednexus_user_cosmetics")) return { rows: [], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    }),
  },
}))
vi.mock("@/lib/request-auth", () => ({
  requireRegisteredUser: vi.fn(async () => ({ uid: "learner-1" })),
  unauthorized: vi.fn(),
}))

describe("store purchase concurrency", () => {
  beforeEach(() => {
    state.balance = 1_000
    state.inventory.clear()
    state.ledger.length = 0
    inventoryLock = Promise.resolve()
  })

  it("only charges and grants one of two simultaneous cosmetic purchases", async () => {
    const { POST } = await import("@/app/api/economy/store/route")
    const purchase = () => POST(new Request("http://mednexus.test/api/economy/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: "title_pre_med" }),
    }) as never)

    const responses = await Promise.all([purchase(), purchase()])
    const bodies = await Promise.all(responses.map(response => response.json()))

    expect(responses.map(response => response.status).sort()).toEqual([200, 400])
    expect(bodies).toContainEqual(expect.objectContaining({ ok: true }))
    expect(bodies).toContainEqual({ error: "Already owned" })
    expect(state.balance).toBe(0)
    expect(state.ledger).toHaveLength(1)
    expect(state.inventory.get("learner-1:title_pre_med")).toBe(1)
  })

  it("uses the configured bundle price and records complete purchase metadata", async () => {
    const { POST } = await import("@/app/api/economy/store/route")
    const response = await POST(new Request("http://mednexus.test/api/economy/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: "lifeline_freeze", bundleId: "bundle_3" }),
    }) as never)

    expect(response.status).toBe(200)
    expect(state.balance).toBe(325)
    expect(state.inventory.get("learner-1:lifeline_freeze")).toBe(3)
    expect(JSON.parse(String(state.ledger[0][4]))).toMatchObject({
      unitQuantity: 3,
      unitPrice: 225,
      totalPrice: 675,
      bundleId: "bundle_3",
      catalogVersion: "3.0.0",
      resultingInventoryQuantity: 3,
    })
  })

  it("rejects a bundle that would exceed the configured inventory cap", async () => {
    state.inventory.set("learner-1:lifeline_freeze", 9)
    const { POST } = await import("@/app/api/economy/store/route")
    const response = await POST(new Request("http://mednexus.test/api/economy/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: "lifeline_freeze", quantity: 3 }),
    }) as never)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Inventory limit reached" })
    expect(state.balance).toBe(1_000)
    expect(state.inventory.get("learner-1:lifeline_freeze")).toBe(9)
    expect(state.ledger).toHaveLength(0)
  })

  it("filters unavailable products from the store response", async () => {
    const { GET } = await import("@/app/api/economy/store/route")
    const response = await GET(new Request("http://mednexus.test/api/economy/store") as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.stringMatching(/^vault_/) }),
    ]))
  })

  it("rejects a direct purchase attempt for an unavailable product before charging", async () => {
    const { POST } = await import("@/app/api/economy/store/route")
    const response = await POST(new Request("http://mednexus.test/api/economy/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: "vault_sepsis_cascade" }),
    }) as never)

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "Item is not available for purchase" })
    expect(state.balance).toBe(1_000)
    expect(state.inventory.size).toBe(0)
    expect(state.ledger).toHaveLength(0)
  })

  it("keeps a retired cosmetic equipable by its owner but rejects a new purchase", async () => {
    state.inventory.set("learner-1:frame_fire", 1)
    const { POST } = await import("@/app/api/economy/store/route")
    const { PATCH } = await import("@/app/api/economy/cosmetics/route")

    const purchaseResponse = await POST(new Request("http://mednexus.test/api/economy/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId: "frame_fire" }),
    }) as never)
    const equipResponse = await PATCH(new Request("http://mednexus.test/api/economy/cosmetics", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "frame", itemId: "frame_fire" }),
    }) as never)

    expect(purchaseResponse.status).toBe(409)
    expect(await purchaseResponse.json()).toEqual({ error: "Item is not available for purchase" })
    expect(equipResponse.status).toBe(200)
    expect(await equipResponse.json()).toMatchObject({ ok: true })
    expect(state.balance).toBe(1_000)
    expect(state.ledger).toHaveLength(0)
  })
})
