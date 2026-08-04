import { NextRequest } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { boundedPagination, measuredJson } from "@/lib/api-efficiency"
import { runtimePool } from "@/lib/runtime-db"

export async function GET(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_assessments")) return adminAccessDenied(req)
  const queryStartedAt = performance.now()
  const pool = await runtimePool()
  const search = (req.nextUrl.searchParams.get("search") ?? "").trim().slice(0, 200)
  const moduleName = req.nextUrl.searchParams.get("module") ?? ""
  const status = req.nextUrl.searchParams.get("status") ?? ""
  const { page, pageSize, offset } = boundedPagination(req.nextUrl.searchParams)

  const [result, modulesResult] = await Promise.all([
    pool.query(
      `WITH filtered_assessments AS (
        SELECT id,title,module_name,question_count,pass_mark,status,created_at
        FROM mednexus_assessments
        WHERE ($1='' OR title ILIKE '%'||$1||'%' OR module_name ILIKE '%'||$1||'%')
          AND ($2='' OR module_name=$2)
          AND ($3='' OR status=$3)
      ),
      raw_attempts AS (
        SELECT assessment_id,user_id AS participant_id,is_guest,score,total,submitted_at
        FROM mednexus_assessment_attempts
        WHERE submitted_at IS NOT NULL
        UNION ALL
        SELECT assessment_id,'legacy:'||guest_name,TRUE,score,total,submitted_at
        FROM mednexus_guest_analytics
      ),
      ranked_attempts AS (
        SELECT raw_attempts.*,
          ROW_NUMBER() OVER (
            PARTITION BY assessment_id,is_guest,participant_id
            ORDER BY score::numeric/NULLIF(total,0) DESC,submitted_at DESC
          ) AS attempt_rank
        FROM raw_attempts
      ),
      summaries AS (
        SELECT a.id,a.title,a.module_name,a.question_count,a.pass_mark,a.status,a.created_at,
          COUNT(r.participant_id)::int AS participants,
          COALESCE(ROUND(AVG(100.0*r.score/NULLIF(r.total,0))),0)::int AS average,
          COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY 100.0*r.score/NULLIF(r.total,0)
          )),0)::int AS median,
          COALESCE(ROUND(MAX(100.0*r.score/NULLIF(r.total,0))),0)::int AS highest,
          COALESCE(ROUND(MIN(100.0*r.score/NULLIF(r.total,0))),0)::int AS lowest,
          COUNT(*) FILTER (WHERE 100.0*r.score/NULLIF(r.total,0)>=a.pass_mark)::int AS passed,
          COUNT(*) FILTER (WHERE 100.0*r.score/NULLIF(r.total,0)<a.pass_mark)::int AS failed
        FROM filtered_assessments a
        LEFT JOIN ranked_attempts r ON r.assessment_id=a.id AND r.attempt_rank=1
        GROUP BY a.id,a.title,a.module_name,a.question_count,a.pass_mark,a.status,a.created_at
      )
      SELECT summaries.*,
        COUNT(*) OVER()::int AS total_count,
        SUM(participants) OVER()::int AS all_participants,
        COALESCE(ROUND(SUM(average*participants) OVER()
          /NULLIF(SUM(participants) OVER(),0)),0)::int AS all_average,
        COALESCE(ROUND(100.0*SUM(passed) OVER()
          /NULLIF(SUM(passed+failed) OVER(),0)),0)::int AS all_pass_rate
      FROM summaries
      ORDER BY created_at DESC
      LIMIT $4 OFFSET $5`,
      [search, moduleName, status, pageSize, offset],
    ),
    pool.query(
      "SELECT DISTINCT module_name FROM mednexus_assessments WHERE module_name<>'' ORDER BY module_name",
    ),
  ])

  const summaries = result.rows.map(row => ({
    id: row.id,
    title: row.title,
    moduleName: row.module_name,
    questionCount: Number(row.question_count),
    passMark: Number(row.pass_mark),
    status: row.status,
    createdAt: row.created_at,
    participants: Number(row.participants),
    average: Number(row.average),
    median: Number(row.median),
    highest: Number(row.highest),
    lowest: Number(row.lowest),
    passed: Number(row.passed),
    failed: Number(row.failed),
  }))
  const first = result.rows[0]
  const payload = {
    summaries,
    total: Number(first?.total_count ?? 0),
    page,
    pageSize,
    modules: modulesResult.rows.map(row => row.module_name),
    metrics: {
      assessments: Number(first?.total_count ?? 0),
      participants: Number(first?.all_participants ?? 0),
      average: Number(first?.all_average ?? 0),
      passRate: Number(first?.all_pass_rate ?? 0),
    },
  }
  return measuredJson({
    route: "GET /api/admin/results",
    queryStartedAt,
    rowCount: summaries.length,
    payload,
  })
}
