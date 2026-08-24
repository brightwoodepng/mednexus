import type { Pool } from "pg"

let schemaReady: Promise<void> | null = null

/** Additive, notification-only compatibility schema. No data rewrites or destructive DDL. */
export function ensureNotificationSchema(pool: Pool) {
  if (schemaReady) return schemaReady
  schemaReady = (async () => {
    await pool.query(`ALTER TABLE mednexus_notifications
      ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'EVERYONE',
      ADD COLUMN IF NOT EXISTS audience_value JSONB NOT NULL DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS action_url TEXT,
      ADD COLUMN IF NOT EXISTS action_label TEXT,
      ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS created_by TEXT`)
    await pool.query(`CREATE INDEX IF NOT EXISTS mednexus_notifications_delivery_idx
      ON mednexus_notifications (scheduled_at DESC, expires_at)`)
    await pool.query(`CREATE TABLE IF NOT EXISTS mednexus_notification_preferences (
      user_id TEXT PRIMARY KEY REFERENCES mednexus_registered_users(uid) ON DELETE CASCADE,
      study BOOLEAN NOT NULL DEFAULT TRUE,
      group_study BOOLEAN NOT NULL DEFAULT TRUE,
      rewards BOOLEAN NOT NULL DEFAULT TRUE,
      rankings BOOLEAN NOT NULL DEFAULT TRUE,
      announcements BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`)
  })().catch((error) => { schemaReady = null; throw error })
  return schemaReady
}
