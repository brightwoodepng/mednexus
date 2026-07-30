import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin, getPlatformSettings } from "@/lib/platform-settings"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"
import { getRequestAuth } from "@/lib/request-auth"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool } = await import("@/lib/db")
    return pool
  } catch { return null }
}

function rowToAssessment(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    moduleName: row.module_name,
    questionIds: row.question_ids,
    questionCount: row.question_count,
    timeLimitMins: row.time_limit_mins,
    triesAllowed: row.tries_allowed,
    passMark: row.pass_mark,
    status: row.status,
    shareToken: row.share_token,
    createdAt: row.created_at,
    attemptsUsed: Number(row.attempts_used ?? 0),
    lastAttempt: row.last_score == null ? undefined : {
      score: Number(row.last_score),
      total: Number(row.last_total),
      percentage: Number(row.last_total) > 0
        ? Math.round(Number(row.last_score) / Number(row.last_total) * 100)
        : 0,
      submittedAt: row.last_submitted_at,
    },
  }
}

// GET /api/assessments
// Public: returns live assessments only
// Administrators receive the management view after a server-verified role check
export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  try {
    const pool = await getPool()
    if (!pool) return NextResponse.json({ assessments: [] })

    const admin = await requireAdminRequest(req, "manage_assessments")
    const canManageAssessments = Boolean(admin)
    const auth = canManageAssessments ? admin : await getRequestAuth(req, { allowGuest: true })
    const { page, pageSize, offset } = boundedPagination(req.nextUrl.searchParams)
    const result = await pool.query(
      `SELECT
        a.id, a.title, a.module_name, a.question_count, a.time_limit_mins,
        a.tries_allowed, a.pass_mark, a.status,
        CASE WHEN $1::boolean THEN a.share_token ELSE NULL END AS share_token,
        a.created_at,
        COALESCE(attempts.attempts_used, 0)::int AS attempts_used,
        attempts.last_score, attempts.last_total, attempts.last_submitted_at,
        COUNT(*) OVER()::int AS total_count
       FROM mednexus_assessments a
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS attempts_used,
           (ARRAY_AGG(score ORDER BY submitted_at DESC))[1] AS last_score,
           (ARRAY_AGG(total ORDER BY submitted_at DESC))[1] AS last_total,
           MAX(submitted_at) AS last_submitted_at
         FROM mednexus_assessment_attempts
         WHERE assessment_id = a.id
           AND user_id = $2
           AND submitted_at IS NOT NULL
       ) attempts ON $2 <> ''
       WHERE ($1::boolean OR a.status = 'live')
       ORDER BY a.created_at DESC
       LIMIT $3 OFFSET $4`,
      [canManageAssessments, auth?.uid ?? "", pageSize, offset],
    )

    const defaults = canManageAssessments ? await getPlatformSettings(pool) : null
    const payload = {
      assessments: result.rows.map(rowToAssessment),
      pagination: {
        page,
        pageSize,
        total: Number(result.rows[0]?.total_count ?? 0),
      },
      ...(defaults ? { defaults: {
        questionCount: defaults.assessmentDefaultQuestionCount,
        timeLimitMins: defaults.assessmentDefaultTimeLimitMins,
        triesAllowed: defaults.assessmentDefaultTriesAllowed,
        passMark: defaults.assessmentDefaultPassMark,
      } } : {}),
    }
    return measuredJson({
      route: "GET /api/assessments",
      queryStartedAt,
      rowCount: result.rows.length,
      payload,
    })
  } catch (err) {
    console.error("[assessments GET]", err)
    return NextResponse.json({ assessments: [] })
  }
}

// POST /api/assessments — admin only
// body: { title, moduleName, questionCount, timeLimitMins, triesAllowed, passMark }
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminRequest(req, "manage_assessments")
    if (!admin) return await adminAccessDenied(req)

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    const body = await req.json()
    const { title, moduleName, questionCount, timeLimitMins, triesAllowed, passMark } = body

    if (!title?.trim() || !moduleName?.trim()) {
      return NextResponse.json({ error: "title and moduleName are required" }, { status: 400 })
    }

    const settings = await getPlatformSettings(pool)
    const qCount = Math.max(1, Number(questionCount) || settings.assessmentDefaultQuestionCount)

    const id = `asmt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const shareToken = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`

    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const created = await client.query<{ question_count: number }>(
      `WITH eligible AS (
         SELECT DISTINCT ON (question.value->>'id') question.value AS question
         FROM mednexus_questions source
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb)) question(value)
         WHERE source.id=1
           AND COALESCE(NULLIF(question.value->>'module', ''), question.value->>'subject')=$3
           AND COALESCE(question.value->>'id', '') <> ''
         ORDER BY question.value->>'id'
       ),
       selected AS (
         SELECT question FROM eligible ORDER BY random() LIMIT $4
       )
       INSERT INTO mednexus_assessments
         (id,title,module_name,question_ids,question_snapshot,question_count,time_limit_mins,tries_allowed,pass_mark,status,share_token)
       SELECT $1,$2,$3,
         jsonb_agg(question->>'id'),
         jsonb_agg(question),
         COUNT(*)::int,$5,$6,$7,'offline',$8
       FROM selected
       HAVING COUNT(*) > 0
       RETURNING question_count`,
        [
          id, title.trim(), moduleName, qCount,
          Number(timeLimitMins) || settings.assessmentDefaultTimeLimitMins,
          Number(triesAllowed) || settings.assessmentDefaultTriesAllowed,
          Number(passMark) || settings.assessmentDefaultPassMark,
          shareToken,
        ],
      )
      if (!created.rows.length) {
        await client.query("ROLLBACK")
        return NextResponse.json({ error: "No questions found for this module" }, { status: 400 })
      }
      await auditAdmin(client, admin.uid, "create", "assessment", id, {
        title: title.trim(),
        moduleName,
        questionCount: Number(created.rows[0].question_count),
      })
      await client.query("COMMIT")
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }

    return NextResponse.json({ success: true, id, shareToken })
  } catch (err) {
    console.error("[assessments POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
