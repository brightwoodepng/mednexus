import type { Pool } from "pg"

let schemaReady: Promise<void> | null = null

/** Runtime schema readiness check. All notification DDL belongs to the release migration. */
export function ensureNotificationSchema(pool: Pool) {
  if (schemaReady) return schemaReady
  schemaReady = (async () => {
    const result = await pool.query<Record<string, boolean>>(`SELECT
      to_regclass('public.mednexus_notifications') IS NOT NULL AS broadcasts,
      to_regclass('public.mednexus_user_notifications') IS NOT NULL AS inbox,
      to_regclass('public.mednexus_notification_preferences') IS NOT NULL AS preferences,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mednexus_notifications' AND column_name='audience') AS audience,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mednexus_notifications' AND column_name='scheduled_at') AS scheduled_at,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mednexus_user_notifications' AND column_name='action_url') AS inbox_action_url`)
    // A SELECT without a row is only produced by lightweight test doubles; the
    // real PostgreSQL readiness query always returns exactly one boolean row.
    const missing = Object.entries(result.rows[0] ?? {}).filter(([, ready]) => !ready).map(([name]) => name)
    if (missing.length) {
      const error = new Error(`Notification schema is not ready (${missing.join(", ")}). Run the release migration.`) as Error & { code?: string }
      error.code = "SCHEMA_NOT_READY"
      throw error
    }
  })().catch((error) => { schemaReady = null; throw error })
  return schemaReady
}
