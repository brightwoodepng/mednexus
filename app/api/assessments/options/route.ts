import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { measuredJson } from "@/lib/api-efficiency"
import { assessmentEligibilitySql, assessmentModuleSql } from "@/lib/assessment-eligibility"
import { runtimePool } from "@/lib/runtime-db"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const queryStartedAt = performance.now()
  if (!await requireAdminRequest(req, "manage_assessments")) return adminAccessDenied(req)
  try {
    const pool = await runtimePool()
    const moduleSql = assessmentModuleSql("question.value")
    const result = await pool.query<{ name: string; eligible_question_count: number; updated_at: string | null }>(
      `SELECT ${moduleSql} AS name,
              COUNT(DISTINCT question.value->>'id')::int AS eligible_question_count,
              MAX(source.updated_at) AS updated_at
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb)) question(value)
       WHERE source.id=1 AND ${assessmentEligibilitySql("question.value")}
         AND COALESCE(question.value->>'id', '') <> ''
       GROUP BY 1
       ORDER BY 1`,
    )
    const payload = {
      modules: result.rows.map(row => ({
        name: row.name,
        eligibleQuestionCount: Number(row.eligible_question_count),
      })),
      updatedAt: result.rows[0]?.updated_at ?? null,
    }
    const response = measuredJson({
      route: "GET /api/assessments/options",
      queryStartedAt,
      rowCount: result.rows.length,
      payload,
    })
    response.headers.set("Cache-Control", "private, max-age=60")
    return response
  } catch (error) {
    console.error("[assessment options GET]", error)
    return NextResponse.json({ error: "Unable to load assessment modules." }, { status: 500 })
  }
}
