import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  auditAdmin,
  getPlatformSettings,
  integerSetting,
} from "@/lib/platform-settings"

export async function GET(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_system")) return adminAccessDenied(req)
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  return NextResponse.json({ settings: await getPlatformSettings(pool) })
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_system")
  if (!admin) return adminAccessDenied(req)
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const body = await req.json() as Record<string, unknown>
  if (body.confirm !== true) {
    return NextResponse.json({ error: "Confirm this platform settings change." }, { status: 400 })
  }

  const current = await getPlatformSettings(pool)
  const approvalMode = body.registrationApprovalMode === "manual" ? "manual" : "verified_index"
  const next = {
    registrationEnabled: typeof body.registrationEnabled === "boolean" ? body.registrationEnabled : current.registrationEnabled,
    guestAccessEnabled: typeof body.guestAccessEnabled === "boolean" ? body.guestAccessEnabled : current.guestAccessEnabled,
    registrationApprovalMode: approvalMode,
    maintenanceEnabled: typeof body.maintenanceEnabled === "boolean" ? body.maintenanceEnabled : current.maintenanceEnabled,
    maintenanceMessage: typeof body.maintenanceMessage === "string" && body.maintenanceMessage.trim()
      ? body.maintenanceMessage.trim().slice(0, 500) : DEFAULT_MAINTENANCE_MESSAGE,
    assessmentDefaultQuestionCount: integerSetting(body.assessmentDefaultQuestionCount, current.assessmentDefaultQuestionCount, 1, 200),
    assessmentDefaultTimeLimitMins: integerSetting(body.assessmentDefaultTimeLimitMins, current.assessmentDefaultTimeLimitMins, 1, 360),
    assessmentDefaultTriesAllowed: integerSetting(body.assessmentDefaultTriesAllowed, current.assessmentDefaultTriesAllowed, 1, 20),
    assessmentDefaultPassMark: integerSetting(body.assessmentDefaultPassMark, current.assessmentDefaultPassMark, 1, 100),
    theoryDefaultSetSize: integerSetting(body.theoryDefaultSetSize, current.theoryDefaultSetSize, 15, 20),
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      `UPDATE mednexus_system_settings SET
        registration_enabled=$1,guest_access_enabled=$2,registration_approval_mode=$3,
        maintenance_enabled=$4,maintenance_message=$5,
        assessment_default_question_count=$6,assessment_default_time_limit_mins=$7,
        assessment_default_tries_allowed=$8,assessment_default_pass_mark=$9,
        updated_at=NOW(),updated_by=$10 WHERE id=1`,
      [
        next.registrationEnabled, next.guestAccessEnabled, next.registrationApprovalMode,
        next.maintenanceEnabled, next.maintenanceMessage,
        next.assessmentDefaultQuestionCount, next.assessmentDefaultTimeLimitMins,
        next.assessmentDefaultTriesAllowed, next.assessmentDefaultPassMark, admin.uid,
      ],
    )
    await client.query(
      "UPDATE mednexus_theory_settings SET default_set_size=$1,updated_at=NOW() WHERE id=1",
      [next.theoryDefaultSetSize],
    )
    await auditAdmin(client, admin.uid, "update", "system_settings", "1", {
      registrationEnabled: next.registrationEnabled,
      guestAccessEnabled: next.guestAccessEnabled,
      registrationApprovalMode: next.registrationApprovalMode,
      maintenanceEnabled: next.maintenanceEnabled,
      assessmentDefaults: {
        questionCount: next.assessmentDefaultQuestionCount,
        timeLimitMins: next.assessmentDefaultTimeLimitMins,
        triesAllowed: next.assessmentDefaultTriesAllowed,
        passMark: next.assessmentDefaultPassMark,
      },
      theoryDefaultSetSize: next.theoryDefaultSetSize,
    })
    await client.query("COMMIT")
    return NextResponse.json({ settings: await getPlatformSettings(pool) })
  } catch (error) {
    await client.query("ROLLBACK")
    console.error("[admin/settings]", error)
    return NextResponse.json({ error: "Settings were not changed." }, { status: 500 })
  } finally {
    client.release()
  }
}
