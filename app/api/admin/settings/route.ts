import { NextRequest, NextResponse } from "next/server"
import type { PoolClient } from "pg"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import {
  assertSystemSettingsSchema,
  DEFAULT_MAINTENANCE_MESSAGE,
  SystemSettingsSchemaError,
  auditAdmin,
  getPlatformSettings,
  integerSetting,
} from "@/lib/platform-settings"
import pool, { CURRENT_SCHEMA_VERSION } from "@/lib/db"

function databaseCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "")
    : ""
}

function settingsFailure(error: unknown) {
  if (error instanceof SystemSettingsSchemaError) return {
    error: "System Settings needs the latest database migration before it can be managed.",
    code: "SYSTEM_SETTINGS_SCHEMA_NOT_READY",
    missing: error.missing,
  }
  if (databaseCode(error).startsWith("08")) return {
    error: "The database could not be reached. Check the configured database URL and try again.",
    code: "DATABASE_UNREACHABLE",
  }
  return {
    error: "System Settings could not be loaded. The database responded, but the settings data could not be verified.",
    code: "SYSTEM_SETTINGS_INVALID",
  }
}

export async function GET(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_system")) return adminAccessDenied(req)
  try {
    await assertSystemSettingsSchema(pool)
    const startedAt = Date.now()
    const settings = await getPlatformSettings(pool)
    const database = await pool.query("SELECT NOW() AS checked_at")
    const responseTimeMs = Date.now() - startedAt
    let audit: unknown[] = []
    try { audit = (await pool.query(`SELECT action,created_at AS "createdAt",actor_id AS "actorId" FROM mednexus_admin_audit_log WHERE resource_type='system_settings' ORDER BY created_at DESC LIMIT 5`)).rows } catch { /* Settings remain available if audit history is unavailable. */ }
    return NextResponse.json({ settings, health: { database: "operational", responseTimeMs, schemaVersion: CURRENT_SCHEMA_VERSION, checkedAt: database.rows[0]?.checked_at ?? new Date().toISOString() }, audit })
  } catch (error) {
    console.error("[admin/settings GET]", error)
    return NextResponse.json(settingsFailure(error), { status: 503 })
  }
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_system")
  if (!admin) return adminAccessDenied(req)
  let client: PoolClient | null = null
  try {
    await assertSystemSettingsSchema(pool)
    const body = await req.json() as Record<string, unknown>
    if (body.confirm !== true) {
      return NextResponse.json({ error: "Confirm this platform settings change." }, { status: 400 })
    }
    if (body.registrationApprovalMode !== undefined && body.registrationApprovalMode !== "manual" && body.registrationApprovalMode !== "verified_index") {
      return NextResponse.json({ error: "Choose a valid registration approval mode." }, { status: 400 })
    }
    client = await pool.connect()
    await client.query("BEGIN")
    await client.query("SELECT id FROM mednexus_system_settings WHERE id=1 FOR UPDATE")
    const current = await getPlatformSettings(client)
    const maintenanceEnabled = typeof body.maintenanceEnabled === "boolean" ? body.maintenanceEnabled : current.maintenanceEnabled
    const maintenanceMessage = typeof body.maintenanceMessage === "string"
      ? body.maintenanceMessage.trim().slice(0, 500)
      : current.maintenanceMessage
    if (maintenanceEnabled && !maintenanceMessage) {
      await client.query("ROLLBACK")
      return NextResponse.json({ error: "Add a learner-facing maintenance message." }, { status: 400 })
    }
    const next = {
      registrationEnabled: typeof body.registrationEnabled === "boolean" ? body.registrationEnabled : current.registrationEnabled,
      guestAccessEnabled: typeof body.guestAccessEnabled === "boolean" ? body.guestAccessEnabled : current.guestAccessEnabled,
      registrationApprovalMode: body.registrationApprovalMode === "manual" || body.registrationApprovalMode === "verified_index" ? body.registrationApprovalMode : current.registrationApprovalMode,
      maintenanceEnabled,
      maintenanceMessage: maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
      assessmentDefaultQuestionCount: integerSetting(body.assessmentDefaultQuestionCount, current.assessmentDefaultQuestionCount, 1, 200),
      assessmentDefaultTimeLimitMins: integerSetting(body.assessmentDefaultTimeLimitMins, current.assessmentDefaultTimeLimitMins, 1, 360),
      assessmentDefaultTriesAllowed: integerSetting(body.assessmentDefaultTriesAllowed, current.assessmentDefaultTriesAllowed, 1, 20),
      assessmentDefaultPassMark: integerSetting(body.assessmentDefaultPassMark, current.assessmentDefaultPassMark, 1, 100),
      theoryDefaultSetSize: integerSetting(body.theoryDefaultSetSize, current.theoryDefaultSetSize, 15, 20),
    }
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
    await client.query(`INSERT INTO mednexus_theory_settings(id,default_set_size,updated_at)
      VALUES(1,$1,NOW()) ON CONFLICT(id) DO UPDATE
      SET default_set_size=EXCLUDED.default_set_size,updated_at=NOW()`, [next.theoryDefaultSetSize])
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
    const saved = await getPlatformSettings(client)
    await client.query("COMMIT")
    return NextResponse.json({ settings: saved })
  } catch (error) {
    if (client) await client.query("ROLLBACK").catch(() => undefined)
    console.error("[admin/settings]", error)
    const malformed = error instanceof SyntaxError
    return NextResponse.json({ error: malformed ? "Send valid JSON settings." : "Settings were not changed." }, { status: malformed ? 400 : 500 })
  } finally {
    client?.release()
  }
}
