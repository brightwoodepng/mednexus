import "server-only"

import { questionsDatabase } from "@/lib/questions-database"
import { isSupportedSoloQuestion } from "@/lib/game-question-pool"
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
  totalCount: number
  updatedAt: string | null
  modules: Array<{
    name: string
    count: number
    disciplines: Array<{
      name: string
      count: number
      topics: Array<{ name: string; count: number }>
    }>
  }>
}

/** Aggregate learner-visible navigation data without transferring question content. */
export async function getQuestionCatalog(): Promise<QuestionCatalog> {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query<{ module_name: string; discipline_name: string; topic_name: string; count: number; updated_at: Date | string | null }>(
      `SELECT
         COALESCE(NULLIF(BTRIM(item.value->>'module'), ''), item.value->>'subject') AS module_name,
         item.value->>'subject' AS discipline_name,
         COALESCE(NULLIF(BTRIM(item.value->>'topic'), ''), NULLIF(BTRIM(item.value->'tags'->>0), ''), 'General') AS topic_name,
         COUNT(*)::int AS count,
         MAX(source.updated_at) AS updated_at
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb)) item(value)
       WHERE source.id = 1
         AND (NULLIF(item.value->>'moduleStatus', '') IS NULL OR item.value->>'moduleStatus' = 'live')
         AND (NULLIF(item.value->>'status', '') IS NULL OR item.value->>'status' = 'live')
       GROUP BY module_name, discipline_name, topic_name
       ORDER BY module_name, discipline_name, topic_name`,
    )
    return catalogFromCounts(result.rows.map(row => ({
      module: row.module_name,
      discipline: row.discipline_name,
      topic: row.topic_name,
      count: Number(row.count),
    })), result.rows[0]?.updated_at ? new Date(result.rows[0].updated_at).toISOString() : null)
  }

  // Learner startup must never read the monolithic Firestore bank. Imports and
  // mutations maintain this compact aggregate beside it.
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    const { getAdminDb } = await import("@/lib/firebase-admin")
    const snapshot = await getAdminDb()?.collection("mednexus").doc("questionCatalog").get()
    if (snapshot?.exists) return snapshot.data() as QuestionCatalog
  }

  return buildQuestionCatalog(questionsDatabase)
}

/** Compact navigation counts limited to questions supported by game modes. */
export async function getGameQuestionCatalog(): Promise<QuestionCatalog> {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query<{ module_name: string; discipline_name: string; topic_name: string; count: number; updated_at: Date | string | null }>(
      `SELECT
         COALESCE(NULLIF(BTRIM(item.value->>'module'), ''), item.value->>'subject') AS module_name,
         item.value->>'subject' AS discipline_name,
         COALESCE(NULLIF(BTRIM(item.value->>'topic'), ''), NULLIF(BTRIM(item.value->'tags'->>0), ''), 'General') AS topic_name,
         COUNT(*)::int AS count,
         MAX(source.updated_at) AS updated_at
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb)) item(value)
       WHERE source.id = 1
         AND (NULLIF(item.value->>'moduleStatus', '') IS NULL OR item.value->>'moduleStatus' = 'live')
         AND (NULLIF(item.value->>'status', '') IS NULL OR item.value->>'status' = 'live')
         AND (NULLIF(item.value->>'questionType', '') IS NULL OR item.value->>'questionType' = 'STANDARD_MCQ')
         AND jsonb_typeof(item.value->'correctAnswer') = 'string'
         AND jsonb_typeof(item.value->'options') = 'array'
         AND jsonb_array_length(item.value->'options') >= 2
         AND EXISTS (
           SELECT 1
           FROM jsonb_array_elements(item.value->'options') option
           WHERE option->>'id' = item.value->>'correctAnswer'
         )
       GROUP BY module_name, discipline_name, topic_name
       ORDER BY module_name, discipline_name, topic_name`,
    )
    return catalogFromCounts(result.rows.map(row => ({
      module: row.module_name,
      discipline: row.discipline_name,
      topic: row.topic_name,
      count: Number(row.count),
    })), result.rows[0]?.updated_at ? new Date(result.rows[0].updated_at).toISOString() : null)
  }

  return buildQuestionCatalog(questionsDatabase.filter(isSupportedSoloQuestion))
}

export async function getRandomGameQuestions(options: {
  quantity: number
  moduleName?: string
  discipline?: string
}): Promise<QuestionPage> {
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query<{ question: Question; total_count: number; updated_at: Date | string | null }>(
      `WITH eligible AS (
         SELECT item.value, source.updated_at
         FROM mednexus_questions source
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb)) item(value)
         WHERE source.id = 1
           AND ($1 = '' OR COALESCE(NULLIF(BTRIM(item.value->>'module'), ''), item.value->>'subject', '') = $1)
           AND ($2 = '' OR COALESCE(item.value->>'subject', '') = $2)
           AND (NULLIF(item.value->>'moduleStatus', '') IS NULL OR item.value->>'moduleStatus' = 'live')
           AND (NULLIF(item.value->>'status', '') IS NULL OR item.value->>'status' = 'live')
           AND (NULLIF(item.value->>'questionType', '') IS NULL OR item.value->>'questionType' = 'STANDARD_MCQ')
           AND jsonb_typeof(item.value->'correctAnswer') = 'string'
           AND jsonb_typeof(item.value->'options') = 'array'
           AND jsonb_array_length(item.value->'options') >= 2
           AND EXISTS (
             SELECT 1
             FROM jsonb_array_elements(item.value->'options') option
             WHERE option->>'id' = item.value->>'correctAnswer'
           )
       ),
       counted AS (
         SELECT value, updated_at, COUNT(*) OVER()::int AS total_count
         FROM eligible
       )
       SELECT
         value - 'createdAt' - 'updatedAt' - 'audit' - 'sourceMetadata' AS question,
         total_count,
         updated_at
       FROM counted
       ORDER BY random()
       LIMIT $3`,
      [options.moduleName ?? "", options.discipline ?? "", options.quantity],
    )
    return {
      questions: result.rows.map(row => row.question),
      total: Number(result.rows[0]?.total_count ?? 0),
      updatedAt: result.rows[0]?.updated_at ? new Date(result.rows[0].updated_at).toISOString() : null,
    }
  }

  const eligible = questionsDatabase.filter(question =>
    isSupportedSoloQuestion(question)
    && (!options.moduleName || (question.module?.trim() || question.subject) === options.moduleName)
    && (!options.discipline || question.subject === options.discipline),
  )
  return {
    questions: [...eligible].sort(() => Math.random() - 0.5).slice(0, options.quantity),
    total: eligible.length,
    updatedAt: null,
  }
}

export function buildQuestionCatalog(questions: readonly Question[], updatedAt: string | null = null): QuestionCatalog {
  const counts = new Map<string, { module: string; discipline: string; topic: string; count: number }>()
  for (const question of questions) {
    if ((question.moduleStatus && question.moduleStatus !== "live") || (question.status && question.status !== "live")) continue
    const module = question.module?.trim() || question.subject
    const topic = (question as Question & { topic?: string }).topic?.trim() || question.tags?.[0]?.trim() || "General"
    const key = `${module}\u0000${question.subject}\u0000${topic}`
    const current = counts.get(key)
    if (current) current.count++
    else counts.set(key, { module, discipline: question.subject, topic, count: 1 })
  }
  return catalogFromCounts([...counts.values()], updatedAt)
}

function catalogFromCounts(rows: Array<{ module: string; discipline: string; topic: string; count: number }>, updatedAt: string | null): QuestionCatalog {
  const modules = new Map<string, QuestionCatalog["modules"][number]>()
  for (const row of rows) {
    if (!row.module || !row.discipline) continue
    let module = modules.get(row.module)
    if (!module) {
      module = { name: row.module, count: 0, disciplines: [] }
      modules.set(row.module, module)
    }
    module.count += row.count
    let discipline = module.disciplines.find(item => item.name === row.discipline)
    if (!discipline) {
      discipline = { name: row.discipline, count: 0, topics: [] }
      module.disciplines.push(discipline)
    }
    discipline.count += row.count
    discipline.topics.push({ name: row.topic, count: row.count })
  }
  const result = [...modules.values()].sort((a, b) => a.name.localeCompare(b.name))
  return { modules: result, totalCount: result.reduce((sum, module) => sum + module.count, 0), updatedAt }
}

type QuestionPageOptions = {
  pageSize: number
  offset: number
  moduleName?: string
  discipline?: string
  topic?: string
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
          AND ($7 = '' OR COALESCE(NULLIF(BTRIM(item.value->>'topic'), ''), NULLIF(BTRIM(item.value->'tags'->>0), ''), 'General') = $7)
          AND (NULLIF(item.value->>'moduleStatus', '') IS NULL OR item.value->>'moduleStatus' = 'live')
          AND (NULLIF(item.value->>'status', '') IS NULL OR item.value->>'status' = 'live')
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
        options.topic ?? "",
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
      && (!options.topic || (question as Question & { topic?: string }).topic === options.topic || question.tags?.[0] === options.topic)
      && (!question.moduleStatus || question.moduleStatus === "live")
      && (!question.status || question.status === "live")
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
