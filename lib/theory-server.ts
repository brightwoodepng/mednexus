import "server-only"

import crypto from "node:crypto"
import type { Pool, PoolClient } from "pg"
import type { TheoryConfidence, TheorySelfRating, TheoryStatus } from "@/lib/types"
import { runtimePool } from "@/lib/runtime-db"

export const THEORY_PAGE_SIZE = 20
export const THEORY_MAX_PAGE_SIZE = 50

export function theoryDatabaseAvailable() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL)
}

export async function theoryPool(): Promise<Pool> {
  if (!theoryDatabaseAvailable()) throw new Error("Theory Vault database is not configured.")
  return runtimePool()
}

export function theoryId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

export function pagination(url: URL) {
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1)
  const pageSize = Math.min(
    THEORY_MAX_PAGE_SIZE,
    Math.max(1, Number.parseInt(url.searchParams.get("pageSize") ?? String(THEORY_PAGE_SIZE), 10) || THEORY_PAGE_SIZE),
  )
  return { page, pageSize, offset: (page - 1) * pageSize }
}

export function requiredText(value: unknown, field: string, maxLength = 50_000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required.`)
  const text = value.trim()
  if (text.length > maxLength) throw new Error(`${field} is too long.`)
  return text
}

export function optionalText(value: unknown, maxLength = 50_000) {
  if (value == null) return ""
  if (typeof value !== "string") throw new Error("Expected text.")
  if (value.length > maxLength) throw new Error("Text is too long.")
  return value
}

export function stringArray(value: unknown, maxItems = 100) {
  if (!Array.isArray(value)) return []
  return value.slice(0, maxItems).filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean)
}

export function theoryStatus(value: unknown): TheoryStatus {
  if (value === "draft" || value === "review" || value === "published" || value === "archived") return value
  return "draft"
}

export function intInRange(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback
}

export function wordCount(markdown: string) {
  return markdown.trim() ? markdown.trim().split(/\s+/u).length : 0
}

export function theorySetNumberExpression(alias = "s") {
  return `(SELECT COUNT(*)::int
    FROM mednexus_theory_sets numbered_set
    WHERE numbered_set.status='published'
      AND numbered_set.collection_id=${alias}.collection_id
      AND numbered_set.module_id IS NOT DISTINCT FROM ${alias}.module_id
      AND numbered_set.discipline_id IS NOT DISTINCT FROM ${alias}.discipline_id
      AND ROW(COALESCE(numbered_set.sort_order,0),COALESCE(numbered_set.name,''),numbered_set.id)
        <= ROW(COALESCE(${alias}.sort_order,0),COALESCE(${alias}.name,''),${alias}.id))`
}

/** Stable learner-only set numbering; editorial set names remain unchanged. */
export function theorySetDisplayProjection(alias = "s") {
  const number = theorySetNumberExpression(alias)
  return `CASE WHEN ${alias}.id IS NULL THEN NULL ELSE ${number} END AS "setNumber",
    CASE WHEN ${alias}.id IS NULL THEN NULL ELSE CONCAT('Set ', ${number}) END AS "setLabel"`
}

export function theoryRatingOutcome(rating: TheorySelfRating): {
  confidence: TheoryConfidence
  revisionAction: "add" | "preserve" | "remove"
} {
  if (rating === "excellent") return { confidence: "high", revisionAction: "remove" }
  if (rating === "partial") return { confidence: "medium", revisionAction: "preserve" }
  return { confidence: "low", revisionAction: "add" }
}

export async function withTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await work(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function auditTheory(
  client: Pool | PoolClient,
  adminId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: Record<string, unknown> = {},
) {
  await client.query(
    `INSERT INTO mednexus_theory_audit_log
      (admin_id, action, resource_type, resource_id, details)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, action, resourceType, resourceId, details],
  )
}

export const theoryQuestionProjection = `
  q.id,
  q.collection_id AS "collectionId",
  q.module_id AS "moduleId",
  q.discipline_id AS "disciplineId",
  q.set_id AS "setId",
  q.title,
  q.prompt,
  q.model_answer AS "modelAnswer",
  q.key_marking_points AS "keyMarkingPoints",
  q.marks,
  q.media,
  q.tags,
  q.source_metadata AS "sourceMetadata",
  q.difficulty,
  q.estimated_study_minutes AS "estimatedStudyMinutes",
  q.status,
  q.deleted_at AS "deletedAt",
  q.previous_status AS "previousStatus",
  (TRIM(q.model_answer) <> '' AND CASE WHEN jsonb_typeof(q.key_marking_points)='array' THEN jsonb_array_length(q.key_marking_points) ELSE 0 END > 0) AS "hasAnswer",
  CASE
    WHEN TRIM(q.prompt) = '' THEN 'missing_prompt'
    WHEN q.set_id IS NULL THEN 'missing_set'
    WHEN TRIM(q.model_answer) = '' OR CASE WHEN jsonb_typeof(q.key_marking_points)='array' THEN jsonb_array_length(q.key_marking_points) ELSE 0 END = 0 THEN 'prompt_only'
    ELSE 'ready'
  END AS "readiness",
  q.sort_order AS "sortOrder"
`
