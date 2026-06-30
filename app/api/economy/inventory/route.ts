import { NextResponse } from "next/server"
import pool, { ensureSchema } from "@/lib/db"

// PATCH /api/economy/inventory — use (consume) one item from inventory
export async function PATCH(req: Request) {
  const client = await pool.connect()
  try {
    await ensureSchema()
    const { uid, itemId } = await req.json() as { uid: string; itemId: string }
    if (!uid || !itemId) return NextResponse.json({ error: "Missing uid or itemId" }, { status: 400 })

    await client.query("BEGIN")
    const res = await client.query(
      "SELECT quantity FROM mednexus_user_inventory WHERE uid=$1 AND item_id=$2 FOR UPDATE",
      [uid, itemId]
    )
    if (res.rows.length === 0 || res.rows[0].quantity <= 0) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "Item not in inventory" }, { status: 409 })
    }
    const newQty = res.rows[0].quantity - 1
    if (newQty === 0) {
      await client.query("DELETE FROM mednexus_user_inventory WHERE uid=$1 AND item_id=$2", [uid, itemId])
    } else {
      await client.query("UPDATE mednexus_user_inventory SET quantity=$1 WHERE uid=$2 AND item_id=$3", [newQty, uid, itemId])
    }
    await client.query("COMMIT")
    return NextResponse.json({ ok: true, newQty })
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("[inventory PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  } finally {
    client.release()
  }
}
