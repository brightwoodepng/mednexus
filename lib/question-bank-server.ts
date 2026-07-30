import "server-only"

import { questionsDatabase } from "@/lib/questions-database"
import type { Question } from "@/lib/types"

export type QuestionBankSource = "postgres" | "firestore" | "static"

export type QuestionBankStatus = {
  source: QuestionBankSource
  questions: unknown[]
  updatedAt: string | null
  postgres: { available: boolean; rowPresent: boolean; count: number; updatedAt: string | null }
  firestore: { configured: boolean; available: boolean; count: number; updatedAt: string | null }
  static: { count: number }
}

export async function getQuestionBankStatus(): Promise<QuestionBankStatus> {
  const postgres = { available: false, rowPresent: false, count: 0, updatedAt: null as string | null }
  const firestore = { configured: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY), available: false, count: 0, updatedAt: null as string | null }
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    try {
      const { default: pool } = await import("@/lib/db")
      const result = await pool.query("SELECT data, updated_at FROM mednexus_questions WHERE id = 1")
      postgres.available = true
      if (result.rows.length) {
        const questions = Array.isArray(result.rows[0].data) ? result.rows[0].data : []
        postgres.rowPresent = true
        postgres.count = questions.length
        postgres.updatedAt = result.rows[0].updated_at?.toISOString?.() ?? String(result.rows[0].updated_at)
        // A present empty row is a deliberate, live empty bank. Never fall through.
        return { source: "postgres", questions, updatedAt: postgres.updatedAt, postgres, firestore, static: { count: questionsDatabase.length } }
      }
    } catch {
    }
  }

  if (firestore.configured) {
    try {
      const { getAdminDb } = await import("@/lib/firebase-admin")
      const db = getAdminDb()
      if (db) {
        firestore.available = true
        const snapshot = await db.collection("mednexus").doc("questions").get()
        if (snapshot.exists) {
          const data = snapshot.data()!
          const questions = Array.isArray(data.data) ? data.data : []
          firestore.count = questions.length
          firestore.updatedAt = data.updatedAt?.toDate?.()?.toISOString() ?? null
          return { source: "firestore", questions, updatedAt: firestore.updatedAt, postgres, firestore, static: { count: questionsDatabase.length } }
        }
      }
    } catch {
      // Diagnostics report unavailable; a bundled bank remains a development fallback.
    }
  }

  return { source: "static", questions: questionsDatabase, updatedAt: null, postgres, firestore, static: { count: questionsDatabase.length } }
}

export type QuestionPage = {
  questions: Question[]
  total: number
  updatedAt: string | null
}

export type QuestionCatalog = {
  modules: Array<{
    name: string
    count: number
    disciplines: Array<{ name: string; count: number }>
  }>
}

/** Aggregate learner-visible navigation data without transferring question content. */
export async function getQuestionCatalog(): Promise<QuestionCatalog> {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query<{ module_name: string; discipline_name: string; count: number }>(
      `SELECT
         COALESCE(NULLIF(BTRIM(item.value->>'module'), ''), item.value->>'subject') AS module_name,
         item.value->>'subject' AS discipline_name,
         COUNT(*)::int AS count
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb)) item(value)
       WHERE source.id = 1
         AND (NULLIF(item.value->>'moduleStatus', '') IS NULL OR item.value->>'moduleStatus' = 'live')
       GROUP BY module_name, discipline_name
       ORDER BY module_name, discipline_name`,
    )
    return catalogFromCounts(result.rows.map(row => ({
      module: row.module_name,
      discipline: row.discipline_name,
      count: Number(row.count),
    })))
  }

  const status = await getQuestionBankStatus()
  const counts = new Map<string, { module: string; discipline: string; count: number }>()
  for (const question of status.questions as Question[]) {
    if (question.moduleStatus && question.moduleStatus !== "live") continue
    const module = question.module?.trim() || question.subject
    const key = `${module}\u0000${question.subject}`
    const current = counts.get(key)
    if (current) current.count++
    else counts.set(key, { module, discipline: question.subject, count: 1 })
  }
  return catalogFromCounts([...counts.values()])
}

function catalogFromCounts(rows: Array<{ module: string; discipline: string; count: number }>): QuestionCatalog {
  const modules = new Map<string, QuestionCatalog["modules"][number]>()
  for (const row of rows) {
    if (!row.module || !row.discipline) continue
    let module = modules.get(row.module)
    if (!module) {
      module = { name: row.module, count: 0, disciplines: [] }
      modules.set(row.module, module)
    }
    module.count += row.count
    module.disciplines.push({ name: row.discipline, count: row.count })
  }
  return { modules: [...modules.values()].sort((a, b) => a.name.localeCompare(b.name)) }
}

type QuestionPageOptions = {
  pageSize: number
  offset: number
  moduleName?: string
  discipline?: string
  search?: string
  publicProjection?: boolean
}

/**
 * Read only the requested JSONB slice from Postgres. Previously every learner
 * request selected the complete `data` value, even when the UI needed a small
 * subset.
 */
export async function getQuestionPage(options: QuestionPageOptions): Promise<QuestionPage> {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query<{
      question: Question
      total_count: number
      updated_at: Date | string | null
    }>(
      `WITH filtered AS (
        SELECT item.value, item.ordinality, source.updated_at
        FROM mednexus_questions source
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb))
          WITH ORDINALITY AS item(value, ordinality)
        WHERE source.id = 1
          AND ($1 = '' OR COALESCE(NULLIF(item.value->>'module', ''), item.value->>'subject', '') = $1)
          AND ($2 = '' OR COALESCE(item.value->>'subject', '') = $2)
          AND (
            $3 = ''
            OR COALESCE(item.value->>'vignette', '') ILIKE '%' || $3 || '%'
            OR COALESCE(item.value->>'subject', '') ILIKE '%' || $3 || '%'
            OR COALESCE(item.value->>'module', '') ILIKE '%' || $3 || '%'
          )
      ),
      counted AS (
        SELECT value, ordinality, updated_at, COUNT(*) OVER()::int AS total_count
        FROM filtered
      )
      SELECT
        CASE WHEN $6::boolean THEN
          jsonb_build_object(
            'id', value->'id',
            'questionNumber', COALESCE(value->'questionNumber', to_jsonb(ordinality)),
            'module', value->'module',
            'moduleStatus', value->'moduleStatus',
            'subject', value->'subject',
            'vignette', value->'vignette',
            'questionType', value->'questionType',
            'options', value->'options',
            'status', value->'status'
          )
        ELSE value - 'createdAt' - 'updatedAt' - 'audit' - 'sourceMetadata'
        END AS question,
        total_count,
        updated_at
      FROM counted
      ORDER BY ordinality
      LIMIT $4 OFFSET $5`,
      [
        options.moduleName ?? "",
        options.discipline ?? "",
        options.search ?? "",
        options.pageSize,
        options.offset,
        Boolean(options.publicProjection),
      ],
    )
    return {
      questions: result.rows.map(row => row.question),
      total: Number(result.rows[0]?.total_count ?? 0),
      updatedAt: result.rows[0]?.updated_at
        ? new Date(result.rows[0].updated_at).toISOString()
        : null,
    }
  }

  const status = await getQuestionBankStatus()
  const search = options.search?.toLowerCase() ?? ""
  const filtered = (status.questions as Question[]).filter(question => {
    const effectiveModule = question.module?.trim() || question.subject
    return (!options.moduleName || effectiveModule === options.moduleName)
      && (!options.discipline || question.subject === options.discipline)
      && (!search || `${question.vignette} ${question.module ?? ""} ${question.subject}`.toLowerCase().includes(search))
  })
  const questions = filtered
    .slice(options.offset, options.offset + options.pageSize)
    .map((question, index) => options.publicProjection
      ? {
          id: question.id,
          questionNumber: options.offset + index + 1,
          module: question.module,
          moduleStatus: question.moduleStatus,
          subject: question.subject,
          vignette: question.vignette,
          questionType: question.questionType,
          options: question.options,
          status: question.status,
          correctAnswer: null,
          explanation: null,
        }
      : question)
  return { questions, total: filtered.length, updatedAt: status.updatedAt }
}

export async function getQuestionBankMetadata() {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query<{
      count: number
      updated_at: Date | string | null
    }>(
      `SELECT jsonb_array_length(COALESCE(data, '[]'::jsonb))::int AS count, updated_at
       FROM mednexus_questions WHERE id = 1`,
    )
    return {
      count: Number(result.rows[0]?.count ?? 0),
      updatedAt: result.rows[0]?.updated_at
        ? new Date(result.rows[0].updated_at).toISOString()
        : null,
    }
  }
  const status = await getQuestionBankStatus()
  return { count: status.questions.length, updatedAt: status.updatedAt }
}

/** Lightweight source diagnostics for status pages. Never transfers bank data. */
export async function getQuestionBankDiagnostics() {
  const postgres = { available: false, rowPresent: false, count: 0, updatedAt: null as string | null }
  const firestore = {
    configured: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY),
    available: false,
    count: 0,
    updatedAt: null as string | null,
  }
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    try {
      const { default: pool } = await import("@/lib/db")
      const result = await pool.query<{ count: number; updated_at: Date | string | null }>(
        `SELECT jsonb_array_length(COALESCE(data, '[]'::jsonb))::int AS count, updated_at
         FROM mednexus_questions WHERE id=1`,
      )
      postgres.available = true
      postgres.rowPresent = result.rows.length > 0
      postgres.count = Number(result.rows[0]?.count ?? 0)
      postgres.updatedAt = result.rows[0]?.updated_at
        ? new Date(result.rows[0].updated_at).toISOString()
        : null
      if (postgres.rowPresent) {
        return {
          source: "postgres" as const,
          count: postgres.count,
          updatedAt: postgres.updatedAt,
          postgres,
          firestore,
          static: { count: questionsDatabase.length },
        }
      }
    } catch {
      // Status pages still report the bundled fallback if PostgreSQL is unavailable.
    }
  }
  return {
    source: "static" as const,
    count: questionsDatabase.length,
    updatedAt: null,
    postgres,
    firestore,
    static: { count: questionsDatabase.length },
  }
}
