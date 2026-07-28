import { NextResponse } from "next/server"
import { requireAdminPermission, forbidden } from "@/lib/request-auth"
import pool, { ensureSchema } from "@/lib/db"

export async function GET(request: Request) {
  const auth = await requireAdminPermission(request, "manage_users")
  if (!auth) return forbidden()
  await ensureSchema()
  const result = await pool.query(`SELECT tutorial_id AS "tutorialId", tutorial_version AS "tutorialVersion", status, COUNT(*)::int AS users FROM mednexus_user_onboarding GROUP BY tutorial_id,tutorial_version,status ORDER BY tutorial_id,status`)
  return NextResponse.json({ completionRates: result.rows })
}
