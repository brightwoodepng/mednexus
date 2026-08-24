import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { requireRegisteredUser } from "@/lib/request-auth"
import { auditAdmin } from "@/lib/platform-settings"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"
import { ensureNotificationSchema } from "@/lib/notification-schema"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool } = await import("@/lib/db")
    await ensureNotificationSchema(pool)
    return pool
  } catch {
    return null
  }
}

function isValidType(type: unknown): type is "info" | "update" | "alert" | "reward" | "reminder" {
  return type === "info" || type === "update" || type === "alert" || type === "reward" || type === "reminder"
}

const audiences = ["EVERYONE", "STUDENTS", "ADMINS", "LEVEL", "USERS"] as const
function validInternalUrl(value: unknown): value is string { return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") }

async function adminUnauthorized(req: NextRequest) {
  return adminAccessDenied(req)
}

// GET /api/notifications — broadcasts plus the authenticated user's read state.
export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return await adminUnauthorized(req)

    const pool = await getPool()
    if (!pool) return NextResponse.json({ notifications: [] })

    const canManageBroadcasts = auth.permissions?.has("manage_broadcasts") ?? auth.role === "SUPER_ADMIN"
    const { page, pageSize, offset } = boundedPagination(req.nextUrl.searchParams)
    if (req.nextUrl.searchParams.get("adminView") === "true" && canManageBroadcasts) {
      const [broadcasts, levels, automation, totals, audienceTotals] = await Promise.all([
        pool.query(
          `SELECT n.id,n.title,n.body,n.type,n.audience,n.audience_value,n.action_url,n.action_label,n.scheduled_at,n.expires_at,n.created_at,
                  COUNT(s.user_id) FILTER (WHERE s.is_read)::int AS read_count,
                  CASE n.audience
                    WHEN 'STUDENTS' THEN (SELECT COUNT(*)::int FROM mednexus_registered_users WHERE status='approved' AND role NOT IN ('ADMIN','SUPER_ADMIN'))
                    WHEN 'ADMINS' THEN (SELECT COUNT(*)::int FROM mednexus_registered_users WHERE status='approved' AND role IN ('ADMIN','SUPER_ADMIN'))
                    WHEN 'LEVEL' THEN (SELECT COUNT(*)::int FROM mednexus_registered_users WHERE status='approved' AND class_level IN (SELECT jsonb_array_elements_text(n.audience_value)))
                    WHEN 'USERS' THEN jsonb_array_length(n.audience_value)
                    ELSE (SELECT COUNT(*)::int FROM mednexus_registered_users WHERE status='approved') END AS recipient_count,
                  COUNT(*) OVER()::int AS total_count
             FROM mednexus_notifications n LEFT JOIN mednexus_notification_states s ON s.notification_id=n.id
            GROUP BY n.id ORDER BY n.created_at DESC LIMIT $1 OFFSET $2`,
          [pageSize, offset],
        ),
        pool.query("SELECT class_level,COUNT(*)::int AS count FROM mednexus_registered_users WHERE status='approved' AND class_level<>'' GROUP BY class_level ORDER BY class_level"),
        pool.query(`SELECT un.id,un.type,un.message,un.created_at,u.name FROM mednexus_user_notifications un LEFT JOIN mednexus_registered_users u ON u.uid=un.user_id ORDER BY un.created_at DESC LIMIT 30`),
        pool.query(`SELECT COUNT(*) FILTER (WHERE scheduled_at<=NOW() AND (expires_at IS NULL OR expires_at>NOW()))::int AS sent, COUNT(*) FILTER (WHERE scheduled_at>NOW())::int AS scheduled, COUNT(*) FILTER (WHERE expires_at IS NOT NULL AND expires_at<=NOW())::int AS expired FROM mednexus_notifications`),
        pool.query(`SELECT COUNT(*)::int AS everyone, COUNT(*) FILTER (WHERE role NOT IN ('ADMIN','SUPER_ADMIN'))::int AS students, COUNT(*) FILTER (WHERE role IN ('ADMIN','SUPER_ADMIN'))::int AS admins FROM mednexus_registered_users WHERE status='approved'`),
      ])
      return NextResponse.json({
        notifications: broadcasts.rows.map((row) => ({ id:row.id,title:row.title,body:row.body,type:row.type,audience:row.audience,audienceValue:row.audience_value,actionUrl:row.action_url,actionLabel:row.action_label,scheduledAt:row.scheduled_at,expiresAt:row.expires_at,createdAt:row.created_at,readCount:row.read_count,recipientCount:row.recipient_count,status:row.expires_at && new Date(row.expires_at)<=new Date()?"expired":new Date(row.scheduled_at)>new Date()?"scheduled":"sent" })),
        levels: levels.rows.map((row) => ({ value:row.class_level,count:row.count })), automated: automation.rows,
        audienceCounts: audienceTotals.rows[0] ?? { everyone:0,students:0,admins:0 },
        summary: totals.rows[0] ?? { sent:0,scheduled:0,expired:0 },
        pagination: { page,pageSize,total:Number(broadcasts.rows[0]?.total_count ?? 0) },
      })
    }
    const res = await pool.query(
      `SELECT n.id, n.title, n.body, n.type, n.admin_only, n.action_url, n.action_label, n.created_at,
              COALESCE(s.is_read, FALSE) AS is_read,
              COUNT(*) OVER()::int AS total_count
         FROM mednexus_notifications n
         LEFT JOIN mednexus_notification_states s
           ON s.notification_id = n.id AND s.user_id = $1
        WHERE ($2 OR n.admin_only = FALSE)
          AND n.scheduled_at <= NOW() AND (n.expires_at IS NULL OR n.expires_at > NOW())
          AND (n.type='alert' OR COALESCE((SELECT announcements FROM mednexus_notification_preferences WHERE user_id=$1),TRUE))
          AND (n.audience='EVERYONE'
            OR (n.audience='STUDENTS' AND $5 NOT IN ('ADMIN','SUPER_ADMIN'))
            OR (n.audience='ADMINS' AND $5 IN ('ADMIN','SUPER_ADMIN'))
            OR (n.audience='LEVEL' AND EXISTS (SELECT 1 FROM mednexus_registered_users u WHERE u.uid=$1 AND n.audience_value ? u.class_level))
            OR (n.audience='USERS' AND n.audience_value ? $1))
        ORDER BY n.created_at DESC
        LIMIT $3 OFFSET $4`,
      [auth.uid, canManageBroadcasts, pageSize, offset, auth.role],
    )

    const payload = {
      notifications: res.rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        type: r.type,
        adminOnly: r.admin_only,
        actionUrl: r.action_url,
        actionLabel: r.action_label,
        isRead: r.is_read,
        createdAt: r.created_at,
      })),
      pagination: {
        page,
        pageSize,
        total: Number(res.rows[0]?.total_count ?? 0),
      },
    }
    return measuredJson({
      route: "GET /api/notifications",
      queryStartedAt,
      rowCount: res.rows.length,
      payload,
    })
  } catch (err) {
    console.error("[notifications GET]", err)
    return NextResponse.json({ notifications: [] })
  }
}

// POST /api/notifications — verified admins create broadcasts.
export async function POST(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_broadcasts")
  if (!admin) return await adminUnauthorized(req)

  try {
    const { title, body, type = "info", adminOnly = false, audience = "EVERYONE", audienceValue = [], actionUrl, actionLabel, scheduledAt, expiresAt } = await req.json()
    if (typeof title !== "string" || typeof body !== "string" || !title.trim() || !body.trim()) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 })
    }
    if (!isValidType(type)) return NextResponse.json({ error: "invalid type" }, { status: 400 })
    if (typeof adminOnly !== "boolean") return NextResponse.json({ error: "adminOnly must be a boolean" }, { status: 400 })
    if (!audiences.includes(audience)) return NextResponse.json({ error: "invalid audience" }, { status: 400 })
    if (!Array.isArray(audienceValue) || !audienceValue.every((value) => typeof value === "string")) return NextResponse.json({ error: "invalid audience selection" }, { status: 400 })
    if (actionUrl && !validInternalUrl(actionUrl)) return NextResponse.json({ error: "Action must be an internal MedNexus path" }, { status: 400 })
    const schedule = scheduledAt ? new Date(scheduledAt) : new Date()
    const expiry = expiresAt ? new Date(expiresAt) : null
    if (Number.isNaN(schedule.getTime()) || (expiry && Number.isNaN(expiry.getTime()))) return NextResponse.json({ error: "Invalid delivery date" }, { status: 400 })
    if (expiry && expiry <= schedule) return NextResponse.json({ error: "Expiry must be after delivery" }, { status: 400 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    let resolvedAudience = audienceValue.map((value) => value.trim()).filter(Boolean)
    if (audience === "USERS") {
      const matches = await pool.query("SELECT uid FROM mednexus_registered_users WHERE LOWER(index_number)=ANY($1::text[]) AND status='approved'", [resolvedAudience.map((value) => value.toLowerCase())])
      resolvedAudience = matches.rows.map((row) => row.uid)
      if (!resolvedAudience.length) return NextResponse.json({ error: "No approved users matched those index numbers" }, { status: 400 })
    }
    if ((audience === "LEVEL" || audience === "USERS") && !resolvedAudience.length) return NextResponse.json({ error: "Select at least one recipient" }, { status: 400 })
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    await pool.query(
      `INSERT INTO mednexus_notifications (id,title,body,type,admin_only,audience,audience_value,action_url,action_label,scheduled_at,expires_at,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
      [id,title.trim(),body.trim(),type,adminOnly,audience,JSON.stringify(resolvedAudience),actionUrl||null,typeof actionLabel==="string"?actionLabel.trim()||null:null,schedule.toISOString(),expiry?.toISOString()??null,admin.uid],
    )
    await auditAdmin(pool, admin.uid, "create", "broadcast", id, { title: title.trim(), type, audience, scheduledAt:schedule.toISOString() })
    return NextResponse.json({ success: true, id, status: schedule>new Date()?"scheduled":"sent" })
  } catch (err) {
    console.error("[notifications POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// PATCH /api/notifications — update the caller's read state, or edit a broadcast as an admin.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.markAllRead === true) {
      const auth = await requireRegisteredUser(req)
      if (!auth) return await adminUnauthorized(req)
      const pool = await getPool()
      if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

      const result = await pool.query(
        `INSERT INTO mednexus_notification_states (notification_id, user_id, is_read, updated_at)
         SELECT id, $1, TRUE, NOW()
           FROM mednexus_notifications
          WHERE ($2 OR admin_only = FALSE)
            AND scheduled_at<=NOW() AND (expires_at IS NULL OR expires_at>NOW())
            AND (type='alert' OR COALESCE((SELECT announcements FROM mednexus_notification_preferences WHERE user_id=$1),TRUE))
            AND (audience='EVERYONE'
              OR (audience='STUDENTS' AND $3 NOT IN ('ADMIN','SUPER_ADMIN'))
              OR (audience='ADMINS' AND $3 IN ('ADMIN','SUPER_ADMIN'))
              OR (audience='LEVEL' AND EXISTS (SELECT 1 FROM mednexus_registered_users u WHERE u.uid=$1 AND audience_value ? u.class_level))
              OR (audience='USERS' AND audience_value ? $1))
         ON CONFLICT (notification_id, user_id)
         DO UPDATE SET is_read = TRUE, updated_at = NOW()
         WHERE mednexus_notification_states.is_read = FALSE`,
        [auth.uid, auth.permissions?.has("manage_broadcasts") ?? auth.role === "SUPER_ADMIN", auth.role],
      )
      return NextResponse.json({ success: true, updated: result.rowCount ?? 0 })
    }

    const { id } = body
    if (typeof id !== "string" || !id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    // Read-state requests are intentionally separate from broadcast content.
    if (typeof body.isRead === "boolean") {
      const auth = await requireRegisteredUser(req)
      if (!auth) return await adminUnauthorized(req)
      const pool = await getPool()
      if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

      const result = await pool.query(
        `INSERT INTO mednexus_notification_states (notification_id, user_id, is_read, updated_at)
         SELECT id, $2, $3, NOW() FROM mednexus_notifications WHERE id = $1
         ON CONFLICT (notification_id, user_id)
         DO UPDATE SET is_read = EXCLUDED.is_read, updated_at = NOW()
         RETURNING notification_id`,
        [id, auth.uid, body.isRead],
      )
      if (result.rowCount === 0) return NextResponse.json({ error: "Notification not found" }, { status: 404 })
      return NextResponse.json({ success: true, isRead: body.isRead })
    }

    // Broadcast edits can only be made with a verified administrator session.
    const admin = await requireAdminRequest(req, "manage_broadcasts")
    if (!admin) return await adminUnauthorized(req)
    const updates: string[] = []
    const values: unknown[] = []
    if (typeof body.title === "string") {
      if (!body.title.trim()) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 })
      values.push(body.title.trim()); updates.push(`title = $${values.length}`)
    }
    if (typeof body.body === "string") {
      if (!body.body.trim()) return NextResponse.json({ error: "body cannot be empty" }, { status: 400 })
      values.push(body.body.trim()); updates.push(`body = $${values.length}`)
    }
    if (body.type !== undefined) {
      if (!isValidType(body.type)) return NextResponse.json({ error: "invalid type" }, { status: 400 })
      values.push(body.type); updates.push(`type = $${values.length}`)
    }
    if (body.adminOnly !== undefined) {
      if (typeof body.adminOnly !== "boolean") return NextResponse.json({ error: "adminOnly must be a boolean" }, { status: 400 })
      values.push(body.adminOnly); updates.push(`admin_only = $${values.length}`)
    }
    if (!updates.length) return NextResponse.json({ error: "No broadcast fields supplied" }, { status: 400 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })
    values.push(id)
    const result = await pool.query(
      `UPDATE mednexus_notifications SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING id`,
      values,
    )
    if (result.rowCount === 0) return NextResponse.json({ error: "Notification not found" }, { status: 404 })
    await auditAdmin(pool, admin.uid, "update", "broadcast", id, { fields: updates.map((update) => update.split(" =")[0]) })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[notifications PATCH]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// DELETE /api/notifications — verified admins permanently remove broadcasts.
export async function DELETE(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_broadcasts")
  if (!admin) return await adminUnauthorized(req)

  try {
    const { id, confirm } = await req.json()
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    if (confirm !== true) return NextResponse.json({ error: "Confirmation required." }, { status: 400 })
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })
    await pool.query("DELETE FROM mednexus_notifications WHERE id = $1", [id])
    await auditAdmin(pool, admin.uid, "delete", "broadcast", id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[notifications DELETE]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
