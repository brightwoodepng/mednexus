import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { bestAttempts, loadAttempts, median, percentage } from "@/lib/admin-results"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdminRequest(req, "manage_assessments")) return adminAccessDenied(req)
  const { id } = await params
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const result = await pool.query("SELECT * FROM mednexus_assessments WHERE id=$1", [id])
  const assessment = result.rows[0]
  if (!assessment) return NextResponse.json({ error: "Assessment not found" }, { status: 404 })
  const mode = req.nextUrl.searchParams.get("view") === "all" ? "all" : "best"
  const loaded = await loadAttempts(pool, id)
  const attempts = mode === "best" ? bestAttempts(loaded) : loaded
  const scores = attempts.map(percentage)
  const snapshot = Array.isArray(assessment.question_snapshot) ? assessment.question_snapshot : []
  const questionPerformance = snapshot.map((question: { id: string; vignette?: string; subject?: string; module?: string; correctAnswer?: string }) => {
    const answered = attempts.filter((attempt) => attempt.answers && Object.hasOwn(attempt.answers, question.id))
    const correct = answered.filter((attempt) => attempt.answers[question.id] === question.correctAnswer).length
    return { id: question.id, title: question.vignette || "Question", topic: question.subject || question.module || assessment.module_name, responses: answered.length, correct, accuracy: answered.length ? Math.round(correct / answered.length * 100) : 0 }
  })
  const topicMap = new Map<string, { responses: number; correct: number }>()
  for (const question of questionPerformance) {
    const current = topicMap.get(question.topic) ?? { responses: 0, correct: 0 }
    current.responses += question.responses; current.correct += question.correct
    topicMap.set(question.topic, current)
  }
  return NextResponse.json({
    assessment: { id, title: assessment.title, moduleName: assessment.module_name, passMark: assessment.pass_mark, questionCount: assessment.question_count, status: assessment.status },
    view: mode,
    metrics: { participants: attempts.length, average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, median: median(scores), highest: scores.length ? Math.max(...scores) : 0, lowest: scores.length ? Math.min(...scores) : 0, passed: scores.filter((score) => score >= assessment.pass_mark).length, failed: scores.filter((score) => score < assessment.pass_mark).length },
    attempts: attempts.sort((a, b) => percentage(b) - percentage(a)).map((attempt) => ({ ...attempt, percentage: percentage(attempt), passed: percentage(attempt) >= assessment.pass_mark })),
    questionPerformance,
    topicPerformance: [...topicMap].map(([topic, values]) => ({ topic, ...values, accuracy: values.responses ? Math.round(values.correct / values.responses * 100) : 0 })).sort((a, b) => b.accuracy - a.accuracy),
  })
}
