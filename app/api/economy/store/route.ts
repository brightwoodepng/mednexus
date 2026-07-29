import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { isStoreItemPurchasable, SELLABLE_STORE_ITEMS, STORE_ITEMS } from "@/lib/economy"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { getActiveSeason } from "@/lib/economy-seasons"
import { countEconomyQueries, economyJson, economyMetrics } from "@/lib/economy-api"

type PurchaseSelection = { quantity?: unknown; bundleId?: unknown }

function resolvePurchase(item: (typeof STORE_ITEMS)[number], selection: PurchaseSelection) {
  if (selection.quantity !== undefined && selection.bundleId !== undefined) return null
  if (selection.quantity !== undefined && (!Number.isSafeInteger(selection.quantity) || Number(selection.quantity) < 1)) return null
  if (selection.bundleId !== undefined && (typeof selection.bundleId !== "string" || !selection.bundleId)) return null

  const options = item.purchaseOptions ?? [{ id: "single", quantity: 1, price: item.price }]
  return selection.bundleId !== undefined
    ? options.find(option => option.id === selection.bundleId) ?? null
    : options.find(option => option.quantity === (selection.quantity ?? 1)) ?? null
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const uid = auth.uid
    if (!uid) return NextResponse.json({ items: SELLABLE_STORE_ITEMS, inventory: {} })

    const { rows } = await pool.query(
      "SELECT item_id, quantity FROM mednexus_user_inventory WHERE uid = $1",
      [uid]
    )
    const inventory = Object.fromEntries(rows.map(r => [r.item_id, r.quantity]))
    return NextResponse.json({ items: SELLABLE_STORE_ITEMS, inventory })
  } catch (e) {
    console.error("store GET", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const metrics = economyMetrics()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { itemId, quantity, bundleId } = await req.json()
    const uid = auth.uid
    if (!itemId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const item = STORE_ITEMS.find(i => i.id === itemId)
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 })
    if (!isStoreItemPurchasable(item)) {
      return NextResponse.json({ error: "Item is not available for purchase" }, { status: 409 })
    }
    const purchase = resolvePurchase(item, { quantity, bundleId })
    if (!purchase) return NextResponse.json({ error: "Invalid purchase quantity or bundle" }, { status: 400 })
    const maxInventory = item.maxInventory ?? (item.maxQuantity === 1 ? 1 : ECONOMY_CONFIG.store.inventoryQuantityLimit)

    const connectedClient = await pool.connect()
    const client = countEconomyQueries(connectedClient, metrics)
    try {
      await client.query("BEGIN")
      const season = await getActiveSeason(client, true)

      const { rows: walletRows } = await client.query(
        "SELECT balance FROM mednexus_season_wallets WHERE user_id = $1 AND season_id = $2 FOR UPDATE",
        [uid, season.id]
      )
      const balance = walletRows[0]?.balance ?? 0
      if (balance < purchase.price) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }

      // Materialize the row so even a first purchase has a row-level lock. The
      // wallet and inventory remain locked until the ledger entry commits.
      await client.query(
        `INSERT INTO mednexus_user_inventory (uid, item_id, quantity, acquired_season_id)
         VALUES ($1, $2, 0, $3) ON CONFLICT (uid, item_id) DO NOTHING`,
        [uid, itemId, season.id],
      )
      const { rows: inventoryRows } = await client.query(
        "SELECT quantity FROM mednexus_user_inventory WHERE uid = $1 AND item_id = $2 FOR UPDATE",
        [uid, itemId],
      )
      const currentQuantity = Number(inventoryRows[0]?.quantity ?? 0)
      const resultingQuantity = currentQuantity + purchase.quantity
      if (resultingQuantity > maxInventory) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: item.maxQuantity === 1 ? "Already owned" : "Inventory limit reached" }, { status: 400 })
      }

      await client.query(
        "UPDATE mednexus_user_inventory SET quantity = $3 WHERE uid = $1 AND item_id = $2",
        [uid, itemId, resultingQuantity],
      )

      await client.query(
        `UPDATE mednexus_season_wallets SET balance = balance - $2, updated_at = NOW()
          WHERE user_id = $1 AND season_id = $3`,
        [uid, purchase.price, season.id]
      )
      await client.query(
        `INSERT INTO mednexus_np_transactions
           (id, user_id, season_id, source, source_id, amount, metadata)
         VALUES ($1, $2, $6, 'store_purchase', $3, $4, $5::jsonb)`,
        [
          `np-${crypto.randomUUID()}`,
          uid,
          crypto.randomUUID(),
          -purchase.price,
          JSON.stringify({
            itemId: item.id,
            unitQuantity: purchase.quantity,
            unitPrice: purchase.price / purchase.quantity,
            totalPrice: purchase.price,
            bundleId: purchase.id,
            resultingInventoryQuantity: resultingQuantity,
            price: purchase.price,
            catalogPrice: purchase.price,
            economyVersion: ECONOMY_CONFIG.economyVersion,
            catalogVersion: ECONOMY_CONFIG.catalogVersion,
            storeCategory: (ECONOMY_CONFIG.store.catalog as Record<string, { productGroup: string }>)[item.id]?.productGroup ?? "uncategorized",
            seasonId: season.id,
          }),
          season.id,
        ],
      )
      const { rows: newWallet } = await client.query(
        "SELECT balance, lifetime_earned, rank_points FROM mednexus_season_wallets WHERE user_id = $1 AND season_id = $2",
        [uid, season.id]
      )
      await client.query("COMMIT")
      return economyJson("economy.purchase", {
        ok: true,
        wallet: { balance: Number(newWallet[0].balance), lifetimeEarned: Number(newWallet[0].lifetime_earned), rankPoints: Number(newWallet[0].rank_points) },
        inventory: { [itemId]: resultingQuantity },
        balance: Number(newWallet[0].balance),
        // Kept for compatibility with clients deployed before the wallet response was expanded.
        newBalance: Number(newWallet[0].balance),
      }, metrics)
    } catch (e) {
      await client.query("ROLLBACK")
      throw e
    } finally {
      connectedClient.release()
    }
  } catch (e) {
    console.error("store POST", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
