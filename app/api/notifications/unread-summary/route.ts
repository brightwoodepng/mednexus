import { NextRequest } from "next/server"
import { measuredJson } from "@/lib/api-efficiency"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { ensureNotificationSchema } from "@/lib/notification-schema"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  const { default: pool } = await import("@/lib/db")
  await ensureNotificationSchema(pool)
  return pool
}

// GET /api/notifications/unread-summary — both inbox counts in one authenticated request.
export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()

    const pool = await getPool()
    if (!pool) {
      return measuredJson({
        route: "GET /api/notifications/unread-summary",
        queryStartedAt,
        rowCount: 0,
        payload: { broadcast: 0, personal: 0, total: 0 },
      })
    }

    const canManageBroadcasts = auth.permissions?.has("manage_broadcasts") ?? auth.role === "SUPER_ADMIN"
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int
            FROM mednexus_notifications n
            LEFT JOIN mednexus_notification_states s
              ON s.notification_id = n.id AND s.user_id = $1
           WHERE ($2 OR n.admin_only = FALSE)
             AND n.scheduled_at<=NOW() AND (n.expires_at IS NULL OR n.expires_at>NOW())
             AND (n.type='alert' OR COALESCE((SELECT announcements FROM mednexus_notification_preferences WHERE user_id=$1),TRUE))
             AND (n.audience='EVERYONE'
               OR (n.audience='STUDENTS' AND $3 NOT IN ('ADMIN','SUPER_ADMIN'))
               OR (n.audience='ADMINS' AND $3 IN ('ADMIN','SUPER_ADMIN'))
               OR (n.audience='LEVEL' AND EXISTS (SELECT 1 FROM mednexus_registered_users u WHERE u.uid=$1 AND n.audience_value ? u.class_level))
               OR (n.audience='USERS' AND n.audience_value ? $1))
             AND COALESCE(s.is_read, FALSE) = FALSE) AS broadcast,
         (SELECT COUNT(*)::int
            FROM mednexus_user_notifications un
            LEFT JOIN mednexus_notification_preferences p ON p.user_id=un.user_id
           WHERE un.user_id = $1 AND un.is_read = FALSE AND (p.user_id IS NULL
             OR (un.type IN ('module_complete','discipline_mastery','qbank_milestone') AND p.study)
             OR (un.type='group_study' AND p.group_study)
             OR (un.type IN ('economy','store','streak') AND p.rewards)
             OR (un.type='leaderboard' AND p.rankings)
             OR un.type NOT IN ('module_complete','discipline_mastery','qbank_milestone','group_study','economy','store','streak','leaderboard'))) AS personal`,
      [auth.uid, canManageBroadcasts, auth.role],
    )
    const broadcast = Number(result.rows[0]?.broadcast ?? 0)
    const personal = Number(result.rows[0]?.personal ?? 0)
    return measuredJson({
      route: "GET /api/notifications/unread-summary",
      queryStartedAt,
      rowCount: 1,
      payload: { broadcast, personal, total: broadcast + personal },
    })
  } catch (err) {
    console.error("[notification unread summary GET]", err)
    return Response.json({ error: "Server error" }, { status: 500 })
  }
}
