import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { STORE_ITEMS } from "@/lib/economy"
import { countEconomyQueries, economyJson, economyMetrics } from "@/lib/economy-api"

// PATCH /api/economy/inventory — use (consume) one item from inventory
export async function PATCH(req: Request) {
  const metrics = economyMetrics()
  const connectedClient = await pool.connect()
  const client = countEconomyQueries(connectedClient, metrics)
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { itemId, sessionId, questionId, usageId } = await req.json() as {
      itemId: string; sessionId?: string; questionId?: string; usageId?: string
    }
    const uid = auth.uid
    if (!itemId || !sessionId || !questionId || !usageId) {
      return NextResponse.json({ error: "itemId, sessionId, questionId, and usageId are required" }, { status: 400 })
    }
    const item = STORE_ITEMS.find(candidate => candidate.id === itemId)
    if (!item || item.category !== "lifeline") {
      return NextResponse.json({ error: "Item is not an implemented consumable" }, { status: 400 })
    }

    await client.query("BEGIN")
    const session = await client.query(
      `SELECT question_ids, mode FROM mednexus_exam_sessions
       WHERE id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE`,
      [sessionId, uid],
    )
    if (!session.rows[0] || !(session.rows[0].question_ids as unknown[]).includes(questionId)) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "Active session question not found" }, { status: 409 })
    }
    if (!item.supply || !item.supply.supportedModes.includes(session.rows[0].mode)) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: `${item.name} is not supported in this game mode` }, { status: 409 })
    }
    const previous = await client.query(
      `SELECT item_id, session_id, question_id, usage_status, remaining_quantity
         FROM mednexus_session_consumable_events
        WHERE user_id = $1 AND usage_id = $2`,
      [uid, usageId],
    )
    if (previous.rows[0]) {
      const event = previous.rows[0]
      if (event.item_id !== itemId || event.session_id !== sessionId || event.question_id !== questionId) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "usageId was already used for a different activation" }, { status: 409 })
      }
      await client.query("COMMIT")
      return NextResponse.json({ ok: true, quantity: event.remaining_quantity, usageStatus: event.usage_status })
    }
    const limitOne = item.supply.perQuestionUsageLimit === 1
    const inserted = await client.query(
      `INSERT INTO mednexus_session_consumable_events
        (id, user_id, usage_id, session_id, item_id, question_id, limit_one_per_question, usage_status, used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [`consume-${crypto.randomUUID()}`, uid, usageId, sessionId, itemId, questionId, limitOne],
    )
    if (inserted.rowCount === 0) {
      const existing = await client.query(
        `SELECT usage_id, usage_status, remaining_quantity
           FROM mednexus_session_consumable_events
          WHERE user_id=$1 AND ((usage_id=$2) OR (session_id=$3 AND question_id=$4 AND item_id=$5 AND limit_one_per_question))
          ORDER BY (usage_id=$2) DESC LIMIT 1`,
        [uid, usageId, sessionId, questionId, itemId],
      )
      await client.query("COMMIT")
      const event = existing.rows[0]
      return NextResponse.json({
        ok: event?.usage_id === usageId,
        quantity: event?.remaining_quantity,
        usageStatus: event?.usage_id === usageId ? event.usage_status : "already_used",
        ...(!event || event.usage_id !== usageId ? { error: "Item already used on this question" } : {}),
      }, { status: event?.usage_id === usageId ? 200 : 409 })
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
      `UPDATE mednexus_session_consumable_events
          SET usage_status='committed', remaining_quantity=$1
        WHERE user_id=$2 AND usage_id=$3`,
      [newQty, uid, usageId],
    )
    await client.query("COMMIT")
    return economyJson("economy.inventory-use", { ok: true, quantity: newQty, usageStatus: "committed" }, metrics)
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    console.error("[inventory PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  } finally {
    connectedClient.release()
  }
}
