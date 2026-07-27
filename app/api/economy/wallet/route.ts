import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { forbidden, requireAdminPermission, requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { applyNPCredits } from "@/lib/np-ledger"
import { ECONOMY_CONFIG } from "@/lib/economy-config"

// Admin-only: forcefully overwrite a wallet balance. Database provisioning is performed by db:migrate.
export async function PATCH(req: NextRequest) {
  try {
    if (!await requireAdminPermission(req, "manage_system")) {
      return await requireRegisteredUser(req) ? forbidden() : unauthorized()
    }
    const { uid, balance } = await req.json()
    if (
      typeof uid !== "string"
      || !uid
      || !Number.isSafeInteger(balance)
      || balance < 0
      || balance > 1_000_000_000
    ) {
      return NextResponse.json({ error: "A valid uid and non-negative integer balance are required" }, { status: 400 })
    }
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const current = await client.query(
        "SELECT balance FROM mednexus_wallet WHERE uid = $1 FOR UPDATE",
        [uid],
      )
      const previous = Number(current.rows[0]?.balance ?? 0)
      let finalBalance = balance
      if (balance > previous) {
        const award = await applyNPCredits(client, uid, [{
          source: "admin_award",
          sourceId: crypto.randomUUID(),
          amount: balance - previous,
          metadata: { targetBalance: balance },
        }])
        finalBalance = award.newBalance
      } else {
        await client.query(
          `INSERT INTO mednexus_wallet (uid, balance, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (uid) DO UPDATE
             SET balance = EXCLUDED.balance, updated_at = NOW()`,
          [uid, balance],
        )
        if (balance < previous) {
          await client.query(
            `INSERT INTO mednexus_np_transactions
               (id, user_id, source, source_id, amount, metadata)
             VALUES ($1, $2, 'admin_adjustment', $3, $4, $5::jsonb)`,
            [
              `np-${crypto.randomUUID()}`,
              uid,
              crypto.randomUUID(),
              balance - previous,
              JSON.stringify({ targetBalance: balance, economyVersion: ECONOMY_CONFIG.economyVersion }),
            ],
          )
        }
      }
      await client.query("COMMIT")
      const wallet = await client.query(
        "SELECT balance, lifetime_earned, rank_points FROM mednexus_wallet WHERE uid = $1",
        [uid],
      )
      return NextResponse.json({
        ok: true,
        balance: Number(wallet.rows[0]?.balance ?? finalBalance),
        lifetimeEarned: Number(wallet.rows[0]?.lifetime_earned ?? 0),
        rankPoints: Number(wallet.rows[0]?.rank_points ?? 0),
      })
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } catch (e) {
    console.error("wallet PATCH", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const uid = auth.uid
    if (!uid) return NextResponse.json({ error: "uid required" }, { status: 400 })
    const { rows } = await pool.query(
      "SELECT balance, lifetime_earned, rank_points FROM mednexus_wallet WHERE uid = $1",
      [uid]
    )
    return NextResponse.json({
      balance: Number(rows[0]?.balance ?? 0),
      lifetimeEarned: Number(rows[0]?.lifetime_earned ?? 0),
      rankPoints: Number(rows[0]?.rank_points ?? 0),
    })
  } catch (e) {
    console.error("wallet GET", e)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
