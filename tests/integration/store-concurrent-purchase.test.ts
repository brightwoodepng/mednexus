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
        state.inventory.set(key, 1)
        return { rows: [{ quantity: 1 }], rowCount: 1 }
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
})
