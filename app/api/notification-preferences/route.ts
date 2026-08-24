import { NextRequest, NextResponse } from "next/server"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { ensureNotificationSchema } from "@/lib/notification-schema"

const fields = ["study", "groupStudy", "rewards", "rankings", "announcements"] as const
const columns = { study: "study", groupStudy: "group_study", rewards: "rewards", rankings: "rankings", announcements: "announcements" } as const

async function getPool() { const { default: pool } = await import("@/lib/db"); await ensureNotificationSchema(pool); return pool }

export async function GET(req: NextRequest) {
  const auth = await requireRegisteredUser(req); if (!auth) return unauthorized()
  const pool = await getPool()
  const result = await pool.query("SELECT study, group_study, rewards, rankings, announcements FROM mednexus_notification_preferences WHERE user_id=$1", [auth.uid])
  const row = result.rows[0]
  return NextResponse.json({ preferences: row ? { study: row.study, groupStudy: row.group_study, rewards: row.rewards, rankings: row.rankings, announcements: row.announcements } : { study: true, groupStudy: true, rewards: true, rankings: true, announcements: true } })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRegisteredUser(req); if (!auth) return unauthorized()
  const body = await req.json()
  if (!fields.every((field) => body[field] === undefined || typeof body[field] === "boolean")) return NextResponse.json({ error: "Invalid notification preferences" }, { status: 400 })
  const pool = await getPool()
  const values = fields.map((field) => body[field] ?? true)
  await pool.query(
    `INSERT INTO mednexus_notification_preferences(user_id,study,group_study,rewards,rankings,announcements,updated_at)
     VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(user_id) DO UPDATE SET
     study=EXCLUDED.study, group_study=EXCLUDED.group_study, rewards=EXCLUDED.rewards,
     rankings=EXCLUDED.rankings, announcements=EXCLUDED.announcements, updated_at=NOW()`,
    [auth.uid, ...values],
  )
  return NextResponse.json({ success: true, fields: Object.values(columns) })
}
