import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { STORE_ITEMS } from "@/lib/economy"
import { countEconomyQueries, economyJson, economyMetrics } from "@/lib/economy-api"

// GET /api/economy/cosmetics?uid=xxx
// Returns the currently equipped title, frame, and highlight for a user.
export async function GET(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const uid = auth.uid
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 })

    const { rows } = await pool.query(
      "SELECT equipped_title, equipped_frame, equipped_highlight, equipped_avatar FROM mednexus_user_cosmetics WHERE uid = $1",
      [uid]
    )
    const row = rows[0] ?? {}
    return NextResponse.json({
      equipped: {
        title:     row.equipped_title     ?? null,
        frame:     row.equipped_frame     ?? null,
        highlight: row.equipped_highlight ?? null,
        avatar:    row.equipped_avatar    ?? null,
      },
    })
  } catch (e) {
    console.error("cosmetics GET", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH /api/economy/cosmetics
// Body: { uid, type: "title"|"frame"|"highlight", itemId: string|null }
// - itemId null → unequip that slot
// - itemId set  → verify ownership, then equip
export async function PATCH(req: NextRequest) {
  const metrics = economyMetrics()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { type, itemId } = await req.json()
    const uid = auth.uid

    if (!type) {
      return NextResponse.json({ error: "Missing uid or type" }, { status: 400 })
    }
    if (!["title", "frame", "highlight", "avatar"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 })
    }

    // If equipping an item, verify the user actually owns it
    if (itemId !== null && itemId !== undefined) {
      const item = STORE_ITEMS.find(i => i.id === itemId)
      if (!item || item.cosmeticType !== type) {
        return NextResponse.json({ error: "Invalid item for this slot" }, { status: 400 })
      }
      const { rows } = await countEconomyQueries(pool, metrics).query(
        "SELECT quantity FROM mednexus_user_inventory WHERE uid = $1 AND item_id = $2",
        [uid, itemId]
      )
      if (!rows[0] || rows[0].quantity < 1) {
        return NextResponse.json({ error: "Item not owned" }, { status: 403 })
      }
    }

    const col =
      type === "title"     ? "equipped_title"     :
      type === "frame"     ? "equipped_frame"      :
      type === "highlight" ? "equipped_highlight"  :
                             "equipped_avatar"

    await countEconomyQueries(pool, metrics).query(
      `INSERT INTO mednexus_user_cosmetics (uid, ${col}, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (uid) DO UPDATE SET ${col} = $2, updated_at = NOW()`,
      [uid, itemId ?? null]
    )

    const { rows } = await countEconomyQueries(pool, metrics).query(
      "SELECT equipped_title,equipped_frame,equipped_highlight,equipped_avatar FROM mednexus_user_cosmetics WHERE uid=$1", [uid])
    const equipped = rows[0] ?? {}
    return economyJson("economy.cosmetic", { ok: true, equippedCosmetics: {
      title: equipped.equipped_title ?? null, frame: equipped.equipped_frame ?? null,
      highlight: equipped.equipped_highlight ?? null, avatar: equipped.equipped_avatar ?? null,
    } }, metrics)
  } catch (e) {
    console.error("cosmetics PATCH", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
