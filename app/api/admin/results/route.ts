import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { bestAttempts, loadAttempts, median, percentage } from "@/lib/admin-results"

export async function GET(req: NextRequest) {
  if (!await requireAdminRequest(req, "manage_assessments")) return adminAccessDenied(req)
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const search = (req.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase()
  const moduleName = req.nextUrl.searchParams.get("module") ?? ""
  const status = req.nextUrl.searchParams.get("status") ?? ""
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1)
  const pageSize = Math.min(50, Math.max(5, Number(req.nextUrl.searchParams.get("pageSize")) || 20))
  const [assessmentResult, attempts] = await Promise.all([
    pool.query("SELECT id,title,module_name,question_count,pass_mark,status,created_at FROM mednexus_assessments ORDER BY created_at DESC"),
    loadAttempts(pool),
  ])
  const filtered = assessmentResult.rows.filter((assessment) =>
    (!search || `${assessment.title} ${assessment.module_name}`.toLowerCase().includes(search))
    && (!moduleName || assessment.module_name === moduleName)
    && (!status || assessment.status === status))
  const summaries = filtered.map((assessment) => {
    const selected = bestAttempts(attempts.filter((attempt) => attempt.assessmentId === assessment.id))
    const scores = selected.map(percentage)
    return {
      id: assessment.id, title: assessment.title, moduleName: assessment.module_name,
      questionCount: assessment.question_count, passMark: assessment.pass_mark,
      status: assessment.status, createdAt: assessment.created_at,
      participants: selected.length,
      average: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
      median: median(scores), highest: scores.length ? Math.max(...scores) : 0,
      lowest: scores.length ? Math.min(...scores) : 0,
      passed: scores.filter((score) => score >= assessment.pass_mark).length,
      failed: scores.filter((score) => score < assessment.pass_mark).length,
    }
  })
  const filteredIds = new Set(filtered.map((assessment) => assessment.id))
  const allBest = bestAttempts(attempts.filter((attempt) => filteredIds.has(attempt.assessmentId)))
  const allScores = allBest.map(percentage)
  const passMarks = new Map(assessmentResult.rows.map((assessment) => [assessment.id, Number(assessment.pass_mark)]))
  return NextResponse.json({
    summaries: summaries.slice((page - 1) * pageSize, page * pageSize),
    total: summaries.length, page, pageSize,
    modules: [...new Set(assessmentResult.rows.map((row) => row.module_name).filter(Boolean))].sort(),
    metrics: {
      assessments: filtered.length, participants: allBest.length,
      average: allScores.length ? Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length) : 0,
      passRate: allBest.length ? Math.round(allBest.filter((attempt) => percentage(attempt) >= (passMarks.get(attempt.assessmentId) ?? 50)).length / allBest.length * 100) : 0,
    },
  })
}
