import "server-only"

import pool from "@/lib/db"
import { STORE_ITEMS } from "@/lib/economy"
import type { RequestAuth } from "@/lib/request-auth"

export const roomError = (code: string, message: string, status: number) => ({ code, error: message, message, status })

export async function getAuthoritativeCosmetics(auth: RequestAuth) {
  const empty = { equippedTitle: null, equippedFrame: null, equippedHighlight: null, equippedAvatar: null }
  if (auth.isGuest) return empty
  const { rows } = await pool.query(
    `SELECT c.equipped_title, c.equipped_frame, c.equipped_highlight, c.equipped_avatar
       FROM mednexus_user_cosmetics c WHERE c.uid = $1`, [auth.uid],
  )
  const row = rows[0] ?? {}
  const inventory = await pool.query("SELECT item_id FROM mednexus_user_inventory WHERE uid = $1 AND quantity > 0", [auth.uid])
  const owned = new Set(inventory.rows.map(({ item_id }) => item_id))
  const valid = (id: unknown, type: string) => typeof id === "string" && owned.has(id)
    && STORE_ITEMS.some(item => item.id === id && item.cosmeticType === type) ? id : null
  return {
    equippedTitle: valid(row.equipped_title, "title"),
    equippedFrame: valid(row.equipped_frame, "frame"),
    equippedHighlight: valid(row.equipped_highlight, "highlight"),
    equippedAvatar: valid(row.equipped_avatar, "avatar"),
  }
}
