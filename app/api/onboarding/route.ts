import { NextResponse } from "next/server"
import { z } from "zod"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { TUTORIAL_IDS, TUTORIAL_VERSION } from "@/lib/onboarding"
import pool from "@/lib/db"

function unavailable(operation: "read" | "write", uid: string, error: unknown) {
  const pg = error as { code?: string; table?: string; column?: string; constraint?: string }
  console.error("[onboarding/storage]", { operation, uid, code: pg?.code, table: pg?.table, column: pg?.column, constraint: pg?.constraint, error })
  return NextResponse.json({ tutorials: [], error: "Onboarding is temporarily unavailable", retryable: true }, { status: 503 })
}

const bodySchema = z.object({
  tutorialId: z.enum(TUTORIAL_IDS),
  tutorialVersion: z.literal(TUTORIAL_VERSION).default(TUTORIAL_VERSION),
  action: z.enum(["start", "step", "complete", "dismiss", "restart"]),
  currentStep: z.number().int().min(0).max(20).optional(),
})

const select = `SELECT tutorial_id AS "tutorialId", tutorial_version AS "tutorialVersion", status,
 current_step AS "currentStep", started_at AS "startedAt", completed_at AS "completedAt",
 dismissed_at AS "dismissedAt", updated_at AS "updatedAt" FROM mednexus_user_onboarding
 WHERE user_id = $1 AND tutorial_version = $2 ORDER BY tutorial_id`

export async function GET(request: Request) {
  const auth = await requireRegisteredUser(request)
  if (!auth) return unauthorized()
  try {
    const result = await pool.query(select, [auth.uid, TUTORIAL_VERSION])
    return NextResponse.json({ tutorials: result.rows })
  } catch (error) {
    return unavailable("read", auth.uid, error)
  }
}

export async function POST(request: Request) {
  const auth = await requireRegisteredUser(request)
  if (!auth) return unauthorized()
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid onboarding update" }, { status: 400 })
  const { tutorialId, tutorialVersion, action, currentStep = 0 } = parsed.data
  const status = action === "complete" ? "completed" : action === "dismiss" ? "dismissed" : "in_progress"
  const step = action === "restart" ? 0 : currentStep
  try {
    const result = await pool.query(`INSERT INTO mednexus_user_onboarding
    (user_id, tutorial_id, tutorial_version, status, current_step, started_at, completed_at, dismissed_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,NOW(),CASE WHEN $4='completed' THEN NOW() END,CASE WHEN $4='dismissed' THEN NOW() END,NOW())
    ON CONFLICT (user_id,tutorial_id,tutorial_version) DO UPDATE SET
      status = CASE WHEN $6='complete' AND mednexus_user_onboarding.status='completed' THEN 'completed' ELSE EXCLUDED.status END,
      current_step = CASE WHEN $6='complete' AND mednexus_user_onboarding.status='completed' THEN mednexus_user_onboarding.current_step ELSE EXCLUDED.current_step END,
      started_at = COALESCE(mednexus_user_onboarding.started_at, NOW()),
      completed_at = CASE WHEN $4='completed' THEN COALESCE(mednexus_user_onboarding.completed_at,NOW()) ELSE NULL END,
      dismissed_at = CASE WHEN $4='dismissed' THEN COALESCE(mednexus_user_onboarding.dismissed_at,NOW()) ELSE NULL END,
      updated_at = NOW()
    RETURNING tutorial_id AS "tutorialId", tutorial_version AS "tutorialVersion", status, current_step AS "currentStep",
      started_at AS "startedAt", completed_at AS "completedAt", dismissed_at AS "dismissedAt", updated_at AS "updatedAt"`,
    [auth.uid, tutorialId, tutorialVersion, status, step, action])
  const event = action === "restart" ? "replayed_from_help" : action === "complete" ? "tutorial_completed" : action === "dismiss" ? "tutorial_dismissed" : action === "start" ? "tutorial_started" : "step_viewed"
    await pool.query(`INSERT INTO mednexus_onboarding_events (user_id,tutorial_id,tutorial_version,event_type,step) VALUES ($1,$2,$3,$4,$5)`, [auth.uid,tutorialId,tutorialVersion,event,step])
    return NextResponse.json({ tutorial: result.rows[0] })
  } catch (error) {
    return unavailable("write", auth.uid, error)
  }
}
