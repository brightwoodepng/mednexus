import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { requireAdminPermission, requireRegisteredUser, forbidden, unauthorized } from "@/lib/request-auth"

export async function GET(req: NextRequest) {
  const user = await requireRegisteredUser(req)
  if (!user) return unauthorized()
  if (!await requireAdminPermission(req, "manage_system")) return forbidden()
  const seasons = await pool.query(`SELECT s.*,
    COUNT(w.user_id)::int member_count, COALESCE(SUM(w.lifetime_earned),0)::bigint currency_created,
    c.executed_at cutover_completed_at
    FROM mednexus_economy_seasons s LEFT JOIN mednexus_season_wallets w ON w.season_id=s.id
    LEFT JOIN mednexus_economy_cutovers c ON c.to_season_id=s.id GROUP BY s.id,c.executed_at ORDER BY s.starts_at DESC`)
  const dryRun = await pool.query(`SELECT
    COUNT(*) FILTER(WHERE status='approved')::int approved_users,
    COUNT(*) FILTER(WHERE status<>'approved')::int ineligible_users
    FROM mednexus_registered_users`)
  const payload = { seasons: seasons.rows, openingGrant: 500, dryRunReport: dryRun.rows[0], confirmationPhrase: "ACTIVATE MEDNEXUS SEASON 1" }
  if (req.nextUrl.searchParams.get("download") === "1") {
    return new NextResponse(JSON.stringify(payload, null, 2), { headers: { "content-type": "application/json", "content-disposition": "attachment; filename=mednexus-season-dry-run.json" } })
  }
  return NextResponse.json(payload)
}
