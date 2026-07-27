import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { STORE_ITEMS } from "@/lib/economy"

// PATCH /api/economy/inventory — use (consume) one item from inventory
export async function PATCH(req: Request) {
  const client = await pool.connect()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { itemId, sessionId, questionId } = await req.json() as {
      itemId: string; sessionId?: string; questionId?: string
    }
    const uid = auth.uid
    if (!itemId || !sessionId || !questionId) {
      return NextResponse.json({ error: "itemId, sessionId, and questionId are required" }, { status: 400 })
    }
    const item = STORE_ITEMS.find(candidate => candidate.id === itemId)
    if (!item || item.category !== "lifeline") {
      return NextResponse.json({ error: "Item is not an implemented consumable" }, { status: 400 })
    }

    await client.query("BEGIN")
    const session = await client.query(
      `SELECT question_ids FROM mednexus_exam_sessions
       WHERE id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE`,
      [sessionId, uid],
    )
    if (!session.rows[0] || !(session.rows[0].question_ids as unknown[]).includes(questionId)) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "Active session question not found" }, { status: 409 })
    }
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
    await client.query(
      `INSERT INTO mednexus_session_consumable_events
        (id, user_id, session_id, item_id, question_id, used_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [`consume-${crypto.randomUUID()}`, uid, sessionId, itemId, questionId],
    )
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
