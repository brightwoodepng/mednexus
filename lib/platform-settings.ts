import "server-only"

import type { Pool, PoolClient } from "pg"

export type RegistrationApprovalMode = "verified_index" | "manual"

export interface PlatformSettings {
  registrationEnabled: boolean
  guestAccessEnabled: boolean
  registrationApprovalMode: RegistrationApprovalMode
  maintenanceEnabled: boolean
  maintenanceMessage: string
  assessmentDefaultQuestionCount: number
  assessmentDefaultTimeLimitMins: number
  assessmentDefaultTriesAllowed: number
  assessmentDefaultPassMark: number
  theoryDefaultSetSize: number
  updatedAt: string | null
  updatedBy: string | null
}

type Queryable = Pick<Pool | PoolClient, "query">

export const DEFAULT_MAINTENANCE_MESSAGE =
  "MedNexus study workspaces are temporarily unavailable while scheduled maintenance is completed."

export function defaultPlatformSettings(): PlatformSettings {
  return {
    registrationEnabled: true,
    guestAccessEnabled: true,
    registrationApprovalMode: "verified_index",
    maintenanceEnabled: false,
    maintenanceMessage: DEFAULT_MAINTENANCE_MESSAGE,
    assessmentDefaultQuestionCount: 10,
    assessmentDefaultTimeLimitMins: 30,
    assessmentDefaultTriesAllowed: 1,
    assessmentDefaultPassMark: 50,
    theoryDefaultSetSize: 20,
    updatedAt: null,
    updatedBy: null,
  }
}

export async function getPlatformSettings(db: Queryable): Promise<PlatformSettings> {
  const result = await db.query(`
    SELECT s.registration_enabled AS "registrationEnabled",
      s.guest_access_enabled AS "guestAccessEnabled",
      s.registration_approval_mode AS "registrationApprovalMode",
      s.maintenance_enabled AS "maintenanceEnabled",
      s.maintenance_message AS "maintenanceMessage",
      s.assessment_default_question_count AS "assessmentDefaultQuestionCount",
      s.assessment_default_time_limit_mins AS "assessmentDefaultTimeLimitMins",
      s.assessment_default_tries_allowed AS "assessmentDefaultTriesAllowed",
      s.assessment_default_pass_mark AS "assessmentDefaultPassMark",
      s.updated_at AS "updatedAt", s.updated_by AS "updatedBy",
      COALESCE(t.default_set_size, 20)::int AS "theoryDefaultSetSize"
    FROM mednexus_system_settings s
    LEFT JOIN mednexus_theory_settings t ON t.id=1
    WHERE s.id=1
  `)
  const row = result.rows[0]
  return {
    registrationEnabled: row?.registrationEnabled !== false,
    guestAccessEnabled: row?.guestAccessEnabled !== false,
    registrationApprovalMode: row?.registrationApprovalMode === "manual" ? "manual" : "verified_index",
    maintenanceEnabled: row?.maintenanceEnabled === true,
    maintenanceMessage: row?.maintenanceMessage || DEFAULT_MAINTENANCE_MESSAGE,
    assessmentDefaultQuestionCount: Number(row?.assessmentDefaultQuestionCount ?? 10),
    assessmentDefaultTimeLimitMins: Number(row?.assessmentDefaultTimeLimitMins ?? 30),
    assessmentDefaultTriesAllowed: Number(row?.assessmentDefaultTriesAllowed ?? 1),
    assessmentDefaultPassMark: Number(row?.assessmentDefaultPassMark ?? 50),
    theoryDefaultSetSize: Number(row?.theoryDefaultSetSize ?? 20),
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    updatedBy: row?.updatedBy ?? null,
  }
}

export async function auditAdmin(
  db: Queryable,
  actorId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: Record<string, unknown> = {},
) {
  await db.query(
    `INSERT INTO mednexus_admin_audit_log
      (actor_id,action,resource_type,resource_id,details)
     VALUES ($1,$2,$3,$4,$5::jsonb)`,
    [actorId, action, resourceType, resourceId, JSON.stringify(details)],
  )
}

export function integerSetting(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}
