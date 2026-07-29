import { NextResponse } from "next/server"
import { measuredJson } from "@/lib/api-efficiency"

export const dynamic = "force-dynamic"

export async function GET() {
  const queryStartedAt = performance.now()
  try {
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query<{
      module: string
      discipline: string
      question_count: number
    }>(
      `SELECT
        COALESCE(NULLIF(question.value->>'module', ''), question.value->>'subject', 'Unassigned') AS module,
        COALESCE(NULLIF(question.value->>'subject', ''), 'Unassigned') AS discipline,
        COUNT(*)::int AS question_count
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb))
         AS question(value)
       WHERE source.id = 1
       GROUP BY 1, 2
       ORDER BY 1, 2`,
    )
    const modules = new Map<string, Array<{ name: string; questionCount: number }>>()
    for (const row of result.rows) {
      const disciplines = modules.get(row.module) ?? []
      disciplines.push({ name: row.discipline, questionCount: Number(row.question_count) })
      modules.set(row.module, disciplines)
    }
    const payload = {
      modules: [...modules].map(([name, disciplines]) => ({
        name,
        questionCount: disciplines.reduce((sum, item) => sum + item.questionCount, 0),
        disciplines,
      })),
    }
    const response = measuredJson({
      route: "GET /api/questions/taxonomy",
      queryStartedAt,
      rowCount: result.rows.length,
      payload,
    })
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600")
    return response
  } catch (error) {
    console.error("[questions/taxonomy GET]", error)
    return NextResponse.json({ modules: [] }, { status: 500 })
  }
}
