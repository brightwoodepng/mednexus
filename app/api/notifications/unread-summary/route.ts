import { NextRequest } from "next/server"
import { requireAdminRequest } from "@/lib/admin-access"
import { measuredJson } from "@/lib/api-efficiency"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  const { default: pool } = await import("@/lib/db")
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

    const canManageBroadcasts = Boolean(await requireAdminRequest(req, "manage_broadcasts"))
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int
            FROM mednexus_notifications n
            LEFT JOIN mednexus_notification_states s
              ON s.notification_id = n.id AND s.user_id = $1
           WHERE ($2 OR n.admin_only = FALSE)
             AND COALESCE(s.is_read, FALSE) = FALSE) AS broadcast,
         (SELECT COUNT(*)::int
            FROM mednexus_user_notifications
           WHERE user_id = $1 AND is_read = FALSE) AS personal`,
      [auth.uid, canManageBroadcasts],
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
