import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { STORE_ITEMS } from "@/lib/economy"

const cosmeticIds = new Set(STORE_ITEMS.filter(item => item.category === "cosmetic").map(item => item.id))

export async function GET(_req: Request, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { uid } = await params
    const profile = await pool.query(
      `SELECT r.uid, r.status,
              COALESCE(array_agg(i.item_id) FILTER (WHERE i.quantity > 0), ARRAY[]::text[]) AS owned_cosmetics
         FROM mednexus_registered_users r
         LEFT JOIN mednexus_user_inventory i ON i.uid = r.uid
        WHERE r.uid = $1
        GROUP BY r.uid, r.status`,
      [uid],
    )
    if (!profile.rows[0] || profile.rows[0].status !== "approved") {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })
    }
    const ownedCosmetics = (profile.rows[0].owned_cosmetics as string[]).filter(id => cosmeticIds.has(id))
    return NextResponse.json({ ownedCosmetics })
  } catch (error) {
    console.error("[leaderboard profile GET]", error)
    return NextResponse.json({ error: "Profile unavailable" }, { status: 500 })
  }
}
