import { NextRequest, NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"
import { STORE_ITEMS } from "@/lib/economy"

export async function GET(req: NextRequest) {
  try {
    await ensureSchema()
    const uid = req.nextUrl.searchParams.get("uid")
    if (!uid) return NextResponse.json({ items: STORE_ITEMS, inventory: {} })

    const { rows } = await pool.query(
      "SELECT item_id, quantity FROM mednexus_user_inventory WHERE uid = $1",
      [uid]
    )
    const inventory = Object.fromEntries(rows.map(r => [r.item_id, r.quantity]))
    return NextResponse.json({ items: STORE_ITEMS, inventory })
  } catch (e) {
    console.error("store GET", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSchema()
    const { uid, itemId } = await req.json()
    if (!uid || !itemId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const item = STORE_ITEMS.find(i => i.id === itemId)
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      if (item.maxQuantity === 1) {
        const { rows } = await client.query(
          "SELECT quantity FROM mednexus_user_inventory WHERE uid = $1 AND item_id = $2 FOR UPDATE",
          [uid, itemId]
        )
        if (rows[0]?.quantity >= 1) {
          await client.query("ROLLBACK")
          return NextResponse.json({ error: "Already owned" }, { status: 400 })
        }
      }

      const { rows: walletRows } = await client.query(
        "SELECT balance FROM mednexus_wallet WHERE uid = $1 FOR UPDATE",
        [uid]
      )
      const balance = walletRows[0]?.balance ?? 0
      if (balance < item.price) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }

      await client.query(
        `UPDATE mednexus_wallet SET balance = balance - $2, updated_at = NOW() WHERE uid = $1`,
        [uid, item.price]
      )
      await client.query(
        `INSERT INTO mednexus_user_inventory (uid, item_id, quantity)
         VALUES ($1, $2, 1)
         ON CONFLICT (uid, item_id) DO UPDATE SET quantity = mednexus_user_inventory.quantity + 1`,
        [uid, itemId]
      )
      const { rows: newWallet } = await client.query(
        "SELECT balance FROM mednexus_wallet WHERE uid = $1",
        [uid]
      )
      await client.query("COMMIT")
      return NextResponse.json({ ok: true, newBalance: newWallet[0].balance })
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      client.release()
    }
  } catch (e) {
    console.error("store POST", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
