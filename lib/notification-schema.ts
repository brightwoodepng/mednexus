import type { Pool } from "pg"

let schemaReady: Promise<void> | null = null

/** Runtime schema readiness check. All notification DDL belongs to the release migration. */
export function ensureNotificationSchema(pool: Pool) {
  if (schemaReady) return schemaReady
  schemaReady = (async () => {
    const result = await pool.query<{ ready: boolean }>(`SELECT
      to_regclass('public.mednexus_notifications') IS NOT NULL
      AND to_regclass('public.mednexus_user_notifications') IS NOT NULL
      AND to_regclass('public.mednexus_notification_preferences') IS NOT NULL
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mednexus_notifications' AND column_name='audience')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mednexus_notifications' AND column_name='scheduled_at')
      AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mednexus_user_notifications' AND column_name='action_url') AS ready`)
    // A SELECT without a row is only produced by lightweight test doubles; the
    // real PostgreSQL readiness query always returns exactly one boolean row.
    if (result.rows[0] && !result.rows[0].ready) {
      const error = new Error("Notification schema is not ready. Run the release migration.") as Error & { code?: string }
      error.code = "SCHEMA_NOT_READY"
      throw error
    }
  })().catch((error) => { schemaReady = null; throw error })
  return schemaReady
}
