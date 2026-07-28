import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { isStoreItemPurchasable, SELLABLE_STORE_ITEMS, STORE_ITEMS } from "@/lib/economy"
import { ECONOMY_CONFIG } from "@/lib/economy-config"

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

    const client = await pool.connect()
    try {
      await client.query("BEGIN")

      const { rows: walletRows } = await client.query(
        "SELECT balance FROM mednexus_wallet WHERE uid = $1 FOR UPDATE",
        [uid]
      )
      const balance = walletRows[0]?.balance ?? 0
      if (balance < purchase.price) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
      }

      // Materialize the row so even a first purchase has a row-level lock. The
      // wallet and inventory remain locked until the ledger entry commits.
      await client.query(
        `INSERT INTO mednexus_user_inventory (uid, item_id, quantity)
         VALUES ($1, $2, 0) ON CONFLICT (uid, item_id) DO NOTHING`,
        [uid, itemId],
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
        `UPDATE mednexus_wallet SET balance = balance - $2, updated_at = NOW() WHERE uid = $1`,
        [uid, purchase.price]
      )
      await client.query(
        `INSERT INTO mednexus_np_transactions
           (id, user_id, source, source_id, amount, metadata)
         VALUES ($1, $2, 'store_purchase', $3, $4, $5::jsonb)`,
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
          }),
        ],
      )
      const { rows: newWallet } = await client.query(
        "SELECT balance, lifetime_earned, rank_points FROM mednexus_wallet WHERE uid = $1",
        [uid]
      )
      await client.query("COMMIT")
      return NextResponse.json({
        ok: true,
        balance: Number(newWallet[0].balance),
        lifetimeEarned: Number(newWallet[0].lifetime_earned),
        rankPoints: Number(newWallet[0].rank_points),
        // Kept for compatibility with clients deployed before the wallet response was expanded.
        newBalance: Number(newWallet[0].balance),
      })
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
