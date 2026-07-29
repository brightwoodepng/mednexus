import { NextRequest, NextResponse } from "next/server"
import { measuredJson } from "@/lib/api-efficiency"
import { requireAuthenticatedUser } from "@/lib/request-auth"

function sameAnswer(actual: unknown, expected: unknown) {
  if (Array.isArray(actual) && Array.isArray(expected)) {
    const left = actual.filter((value): value is string => typeof value === "string").sort()
    const right = expected.filter((value): value is string => typeof value === "string").sort()
    return left.length === right.length && left.every((value, index) => value === right[index])
  }
  return typeof actual === "string" && actual === expected
}

/**
 * Reveal the key and explanation only in response to an answer submission.
 * The public question-list projection never contains either field.
 */
export async function POST(req: NextRequest) {
  const queryStartedAt = performance.now()
  try {
    if (!await requireAuthenticatedUser(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await req.json() as { questionId?: unknown; answer?: unknown }
    if (typeof body.questionId !== "string" || !body.questionId.trim()) {
      return NextResponse.json({ error: "questionId is required." }, { status: 400 })
    }
    if (typeof body.answer !== "string" && !Array.isArray(body.answer)) {
      return NextResponse.json({ error: "answer is required." }, { status: 400 })
    }

    const { default: pool } = await import("@/lib/db")
    const result = await pool.query<{
      correct_answer: unknown
      explanation: unknown
    }>(
      `SELECT
        question.value->'correctAnswer' AS correct_answer,
        question.value->'explanation' AS explanation
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb))
         AS question(value)
       WHERE source.id = 1 AND question.value->>'id' = $1
       LIMIT 1`,
      [body.questionId],
    )
    if (!result.rows.length) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 })
    }
    const row = result.rows[0]
    const payload = {
      questionId: body.questionId,
      isCorrect: sameAnswer(body.answer, row.correct_answer),
      correctAnswer: row.correct_answer,
      explanation: row.explanation,
    }
    return measuredJson({
      route: "POST /api/questions/answer",
      queryStartedAt,
      rowCount: 1,
      payload,
    })
  } catch (error) {
    console.error("[questions/answer POST]", error)
    return NextResponse.json({ error: "Unable to check this answer." }, { status: 500 })
  }
}
