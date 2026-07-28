import { NextResponse } from "next/server"
import pool from "@/lib/db"

const requiredTables = ["mednexus_registered_users", "mednexus_economy_seasons", "mednexus_season_wallets", "mednexus_user_onboarding", "mednexus_onboarding_events"]

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        ARRAY(SELECT name FROM unnest($1::text[]) AS r(name) WHERE to_regclass('public.' || name) IS NULL) AS missing_tables,
        (SELECT count(*)::int FROM mednexus_economy_seasons WHERE status='active') AS active_seasons,
        EXISTS(SELECT 1 FROM mednexus_economy_seasons WHERE id='season-1') AS season_1_exists,
        EXISTS(SELECT 1 FROM mednexus_economy_seasons WHERE id='legacy') AS legacy_exists`, [requiredTables])
    const state = result.rows[0]
    const ready = state.missing_tables.length === 0 && state.active_seasons === 1 && state.season_1_exists && state.legacy_exists
    return NextResponse.json({ status: ready ? "ready" : "migration_required", ...state }, { status: ready ? 200 : 503 })
  } catch (error) {
    const pg = error as { code?: string; table?: string; column?: string; constraint?: string }
    console.error("[health/database]", { code: pg?.code, table: pg?.table, column: pg?.column, constraint: pg?.constraint, error })
    return NextResponse.json({ status: "unavailable", code: pg?.code ?? "UNKNOWN" }, { status: 503 })
  }
}
