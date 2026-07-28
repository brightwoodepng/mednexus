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
      if (sql.includes("SELECT balance FROM mednexus_wallet")) {
        return { rows: [{ balance: state.balance }], rowCount: 1 }
      }
      if (sql.includes("UPDATE mednexus_wallet")) {
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

vi.mock("@/lib/db", () => ({ default: { connect: vi.fn(async () => createClient()) } }))
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
    expect(state.balance).toBe(700)
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
    expect(state.balance).toBe(730)
    expect(state.inventory.get("learner-1:lifeline_freeze")).toBe(3)
    expect(JSON.parse(String(state.ledger[0][4]))).toMatchObject({
      unitQuantity: 3,
      unitPrice: 90,
      totalPrice: 270,
      bundleId: "bundle_3",
      catalogVersion: "2.1.0",
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
})
